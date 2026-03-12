import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';
import { getLevelFromXp, getXpForRound } from '@/lib/xp';

/**
 * GET /api/admin/xp-audit
 *
 * Identifies suspected XP spam by finding players whose sessions are completed
 * in rapid succession (velocity-based detection). Instead of a flat daily cap,
 * this flags sessions where the gap from the previous session is below a
 * configurable minimum (default: 3 minutes).
 *
 * Query params:
 *   minGap   - minimum minutes between sessions to be considered legit (default: 3)
 *   dailyCap - max legit freeplay/expert sessions per day (default: 10)
 *   since    - ISO date to look back from (default: 7 days ago)
 *
 * DELETE /api/admin/xp-audit
 *
 * Recalculates XP for flagged players, dropping spam sessions.
 *
 * Body: { playerIds: string[], minGap?: number, dailyCap?: number }
 *
 * POST /api/admin/xp-audit
 *
 * Undo: restores previous XP/level values.
 * Body: { restorations: { playerId: string; xp: number; level: number }[] }
 */

// Supabase caps at 1000 rows per request — need explicit pagination
const PAGE_SIZE = 1000;

/**
 * Classify sorted sessions as legitimate or suspicious.
 * Two filters combined — a session must pass BOTH:
 *   1. Velocity: gap from previous legit session >= minGapMs
 *   2. Daily cap: no more than dailyCap legit sessions per calendar day
 */
function classifySessions<T extends { createdAt: string }>(
  sessions: T[],
  minGapMs: number,
  dailyCap: number,
): { session: T; suspicious: boolean; reason: 'ok' | 'too_fast' | 'daily_cap' }[] {
  const result: { session: T; suspicious: boolean; reason: 'ok' | 'too_fast' | 'daily_cap' }[] = [];
  let lastLegitTime: number | null = null;
  const dailyCounts = new Map<string, number>();

  for (const sess of sessions) {
    const t = new Date(sess.createdAt).getTime();
    const day = sess.createdAt.slice(0, 10);

    // Check velocity
    if (lastLegitTime !== null && (t - lastLegitTime) < minGapMs) {
      result.push({ session: sess, suspicious: true, reason: 'too_fast' });
      continue;
    }

    // Check daily cap
    const dayCount = dailyCounts.get(day) ?? 0;
    if (dayCount >= dailyCap) {
      result.push({ session: sess, suspicious: true, reason: 'daily_cap' });
      continue;
    }

    // Passed both checks
    result.push({ session: sess, suspicious: false, reason: 'ok' });
    lastLegitTime = t;
    dailyCounts.set(day, dayCount + 1);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const minGap = Math.max(1, parseInt(url.searchParams.get('minGap') ?? '3', 10));
    const minGapMs = minGap * 60 * 1000;
    const dailyCap = Math.max(1, parseInt(url.searchParams.get('dailyCap') ?? '10', 10));
    const sinceParam = url.searchParams.get('since');
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const supabase = getSupabaseAdminClient();

    // Query answers directly for freeplay/expert modes since the cutoff.
    // Paginate to avoid the default 1000-row Supabase limit.
    type AnswerRow = { session_id: string; player_id: string; correct: boolean; game_mode: string; created_at: string };
    const answers: AnswerRow[] = [];
    let offset = 0;
    while (true) {
      const { data, error: ansErr } = await supabase
        .from('answers')
        .select('session_id, player_id, correct, game_mode, created_at')
        .in('game_mode', ['freeplay', 'expert'])
        .not('player_id', 'is', null)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (ansErr) throw new Error(ansErr.message);
      if (!data || data.length === 0) break;
      answers.push(...(data as AnswerRow[]));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (answers.length === 0) {
      return NextResponse.json({ flaggedPlayers: [], totalSessions: 0, since: since.toISOString(), minGap, dailyCap });
    }

    // Group answers by session
    type SessionInfo = {
      sessionId: string;
      playerId: string;
      gameMode: string;
      correctCount: number;
      totalCount: number;
      createdAt: string; // earliest answer timestamp
    };

    const sessionMap = new Map<string, SessionInfo>();
    for (const a of answers) {
      const key = a.session_id;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          sessionId: key,
          playerId: a.player_id,
          gameMode: a.game_mode,
          correctCount: 0,
          totalCount: 0,
          createdAt: a.created_at,
        });
      }
      const info = sessionMap.get(key)!;
      info.totalCount++;
      if (a.correct) info.correctCount++;
    }

    const totalSessions = sessionMap.size;

    // Group sessions by player, sorted chronologically
    const playerSessions = new Map<string, SessionInfo[]>();
    for (const info of sessionMap.values()) {
      if (!playerSessions.has(info.playerId)) playerSessions.set(info.playerId, []);
      playerSessions.get(info.playerId)!.push(info);
    }

    // Classify each player's sessions by velocity
    type FlaggedPlayer = {
      playerId: string;
      displayName: string | null;
      currentXp: number;
      currentLevel: number;
      projectedXp: number;
      projectedLevel: number;
      legitimateXp: number;
      suspiciousXp: number;
      alreadyCorrected: boolean;
      totalSessionsInWindow: number;
      suspiciousSessionCount: number;
      fastestGapSeconds: number;
      sessions: { time: string; gapSeconds: number | null; xp: number; suspicious: boolean; reason: string }[];
    };

    const flaggedPlayerIds: string[] = [];
    const flaggedDetails = new Map<string, FlaggedPlayer>();

    for (const [playerId, sessions] of playerSessions) {
      // Sort chronologically
      sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      const classified = classifySessions(sessions, minGapMs, dailyCap);

      let legitimateXp = 0;
      let suspiciousXp = 0;
      let suspiciousCount = 0;
      let fastestGap = Infinity;
      const sessionDetails: { time: string; gapSeconds: number | null; xp: number; suspicious: boolean; reason: string }[] = [];

      for (let i = 0; i < classified.length; i++) {
        const { session: sess, suspicious, reason } = classified[i];
        const xp = getXpForRound(sess.correctCount, sess.totalCount || 10, sess.gameMode);

        let gapSeconds: number | null = null;
        if (i > 0) {
          const prevTime = new Date(classified[i - 1].session.createdAt).getTime();
          const thisTime = new Date(sess.createdAt).getTime();
          gapSeconds = Math.round((thisTime - prevTime) / 1000);
          if (gapSeconds < fastestGap) fastestGap = gapSeconds;
        }

        if (suspicious) {
          suspiciousXp += xp;
          suspiciousCount++;
        } else {
          legitimateXp += xp;
        }

        sessionDetails.push({
          time: sess.createdAt,
          gapSeconds,
          xp,
          suspicious,
          reason,
        });
      }

      // Flag if any sessions were suspicious
      if (suspiciousCount > 0) {
        flaggedPlayerIds.push(playerId);
        flaggedDetails.set(playerId, {
          playerId,
          displayName: null,
          currentXp: 0,
          currentLevel: 0,
          projectedXp: 0,
          projectedLevel: 0,
          alreadyCorrected: false,
          legitimateXp,
          suspiciousXp,
          totalSessionsInWindow: sessions.length,
          suspiciousSessionCount: suspiciousCount,
          fastestGapSeconds: fastestGap === Infinity ? 0 : fastestGap,
          sessions: sessionDetails,
        });
      }
    }

    // Fetch player details + compute projected XP (same logic as DELETE)
    if (flaggedPlayerIds.length > 0) {
      const { data: players } = await supabase
        .from('players')
        .select('id, display_name, xp, level')
        .in('id', flaggedPlayerIds);

      for (const pl of (players ?? [])) {
        const detail = flaggedDetails.get(pl.id);
        if (detail) {
          detail.displayName = pl.display_name;
          detail.currentXp = pl.xp;
          detail.currentLevel = pl.level;
        }
      }

      // For each flagged player, compute what DELETE would produce
      // (fetches ALL their answers, not just the scan window)
      for (const playerId of flaggedPlayerIds) {
        const detail = flaggedDetails.get(playerId);
        if (!detail) continue;

        type AllAnswerRow = { session_id: string; correct: boolean; game_mode: string; created_at: string };
        const allAnswers: AllAnswerRow[] = [];
        let allOffset = 0;
        while (true) {
          const { data: aData, error: aErr } = await supabase
            .from('answers')
            .select('session_id, correct, game_mode, created_at')
            .eq('player_id', playerId)
            .in('game_mode', ['freeplay', 'expert', 'research'])
            .range(allOffset, allOffset + PAGE_SIZE - 1);
          if (aErr) break;
          if (!aData || aData.length === 0) break;
          allAnswers.push(...(aData as AllAnswerRow[]));
          if (aData.length < PAGE_SIZE) break;
          allOffset += PAGE_SIZE;
        }

        // Group by session
        type SessGroup = { correct: number; total: number; mode: string; earliestAt: string };
        const sessGroups = new Map<string, SessGroup>();
        for (const a of allAnswers) {
          if (!sessGroups.has(a.session_id)) {
            sessGroups.set(a.session_id, { correct: 0, total: 0, mode: a.game_mode, earliestAt: a.created_at });
          }
          const g = sessGroups.get(a.session_id)!;
          g.total++;
          if (a.correct) g.correct++;
          if (a.created_at < g.earliestAt) g.earliestAt = a.created_at;
        }

        // Research: always kept
        let projXp = 0;
        for (const [, g] of sessGroups) {
          if (g.mode === 'research') {
            projXp += getXpForRound(g.correct, g.total || 10, g.mode);
          }
        }

        // Freeplay/expert: velocity filter
        const fpExpAll = [...sessGroups.values()]
          .filter(g => g.mode !== 'research')
          .sort((a, b) => a.earliestAt.localeCompare(b.earliestAt));

        const projClassified = classifySessions(
          fpExpAll.map(s => ({ ...s, createdAt: s.earliestAt })),
          minGapMs,
          dailyCap,
        );
        for (let i = 0; i < projClassified.length; i++) {
          if (!projClassified[i].suspicious) {
            const s = fpExpAll[i];
            projXp += getXpForRound(s.correct, s.total || 10, s.mode);
          }
        }

        detail.projectedXp = projXp;
        detail.projectedLevel = getLevelFromXp(projXp);
        detail.alreadyCorrected = detail.currentXp <= projXp;
      }
    }

    const flagged = [...flaggedDetails.values()].sort(
      (a, b) => b.suspiciousXp - a.suspiciousXp
    );

    return NextResponse.json({
      flaggedPlayers: flagged,
      totalSessions,
      since: since.toISOString(),
      minGap,
      dailyCap,
    });
  } catch (err) {
    console.error('XP audit scan failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/xp-audit
 *
 * Recalculates a player's XP from scratch based on actual answer records.
 * Drops rapid-fire freeplay/expert sessions (gap < minGap minutes).
 * Research sessions are always kept.
 */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const playerIds: string[] = Array.isArray(body.playerIds) ? body.playerIds : [];
  const minGap = Math.max(1, parseInt(body.minGap ?? '3', 10));
  const minGapMs = minGap * 60 * 1000;
  const dailyCap = Math.max(1, parseInt(body.dailyCap ?? '10', 10));

  if (playerIds.length === 0) {
    return NextResponse.json({ error: 'playerIds required' }, { status: 400 });
  }
  if (playerIds.length > 20) {
    return NextResponse.json({ error: 'Max 20 players per request' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const results: { playerId: string; oldXp: number; newXp: number; oldLevel: number; newLevel: number; sessionsKept: number; sessionsDropped: number }[] = [];

  for (const playerId of playerIds) {
    // Get current player
    const { data: player } = await supabase
      .from('players')
      .select('id, auth_id, xp, level')
      .eq('id', playerId)
      .single();

    if (!player) continue;

    // Get all answers with timestamps — paginated
    type PlayerAnswerRow = { session_id: string; correct: boolean; game_mode: string; created_at: string };
    const playerAnswers: PlayerAnswerRow[] = [];
    let paOffset = 0;
    while (true) {
      const { data, error: paErr } = await supabase
        .from('answers')
        .select('session_id, correct, game_mode, created_at')
        .eq('player_id', playerId)
        .in('game_mode', ['freeplay', 'expert', 'research'])
        .range(paOffset, paOffset + PAGE_SIZE - 1);
      if (paErr) break;
      if (!data || data.length === 0) break;
      playerAnswers.push(...(data as PlayerAnswerRow[]));
      if (data.length < PAGE_SIZE) break;
      paOffset += PAGE_SIZE;
    }

    // Group by session, tracking earliest answer time
    type SessionGroup = { correct: number; total: number; mode: string; earliestAt: string };
    const sessionGroups = new Map<string, SessionGroup>();
    for (const a of playerAnswers) {
      if (!sessionGroups.has(a.session_id)) {
        sessionGroups.set(a.session_id, { correct: 0, total: 0, mode: a.game_mode, earliestAt: a.created_at });
      }
      const g = sessionGroups.get(a.session_id)!;
      g.total++;
      if (a.correct) g.correct++;
      if (a.created_at < g.earliestAt) g.earliestAt = a.created_at;
    }

    // Research sessions: always count all XP
    let recalculatedXp = 0;
    let sessionsKept = 0;
    let sessionsDropped = 0;

    for (const [, group] of sessionGroups) {
      if (group.mode === 'research') {
        recalculatedXp += getXpForRound(group.correct, group.total || 10, group.mode);
        sessionsKept++;
      }
    }

    // Freeplay/expert: classify by velocity, drop rapid-fire sessions
    const fpExpertSessions = [...sessionGroups.values()]
      .filter(g => g.mode !== 'research')
      .sort((a, b) => a.earliestAt.localeCompare(b.earliestAt));

    const classified = classifySessions(
      fpExpertSessions.map(s => ({ ...s, createdAt: s.earliestAt })),
      minGapMs,
      dailyCap,
    );

    for (let i = 0; i < classified.length; i++) {
      const { suspicious } = classified[i];
      const sess = fpExpertSessions[i];
      if (!suspicious) {
        recalculatedXp += getXpForRound(sess.correct, sess.total || 10, sess.mode);
        sessionsKept++;
      } else {
        sessionsDropped++;
      }
    }

    const newLevel = getLevelFromXp(recalculatedXp);

    // Update player
    await supabase
      .from('players')
      .update({
        xp: recalculatedXp,
        level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', playerId);

    results.push({
      playerId,
      oldXp: player.xp,
      newXp: recalculatedXp,
      oldLevel: player.level,
      newLevel,
      sessionsKept,
      sessionsDropped,
    });
  }

  return NextResponse.json({ results });
}

/**
 * POST /api/admin/xp-audit
 *
 * Undo: restores previous XP/level values for players.
 * Body: { restorations: { playerId: string; xp: number; level: number }[] }
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const restorations: { playerId: string; xp: number; level: number }[] =
    Array.isArray(body.restorations) ? body.restorations : [];

  if (restorations.length === 0) {
    return NextResponse.json({ error: 'restorations required' }, { status: 400 });
  }
  if (restorations.length > 20) {
    return NextResponse.json({ error: 'Max 20 players per request' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const results: { playerId: string; restoredXp: number; restoredLevel: number }[] = [];

  for (const r of restorations) {
    if (typeof r.xp !== 'number' || typeof r.level !== 'number') continue;

    const { error } = await supabase
      .from('players')
      .update({
        xp: r.xp,
        level: r.level,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.playerId);

    if (!error) {
      results.push({ playerId: r.playerId, restoredXp: r.xp, restoredLevel: r.level });
    }
  }

  return NextResponse.json({ results });
}
