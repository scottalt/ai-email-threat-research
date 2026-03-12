import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';
import { getLevelFromXp, getXpForRound } from '@/lib/xp';

/**
 * GET /api/admin/xp-audit
 *
 * Identifies suspected XP spam by finding players with abnormally high session
 * frequency in freeplay/expert modes. Returns per-player breakdown with
 * legitimate vs suspicious XP so you can review before taking action.
 *
 * Query params:
 *   threshold - min sessions per day to flag (default: 10)
 *   since     - ISO date to look back from (default: 7 days ago)
 *
 * DELETE /api/admin/xp-audit
 *
 * Recalculates XP from scratch for flagged players by summing actual answers.
 * Removes XP from any sessions that have zero answers in the DB (phantom sessions).
 *
 * Body: { playerIds: string[] }  — player UUIDs (from the GET response)
 */

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const threshold = Math.max(1, parseInt(url.searchParams.get('threshold') ?? '10', 10));
  const sinceParam = url.searchParams.get('since');
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const supabase = getSupabaseAdminClient();

  // Find all sessions in freeplay/expert with a completed_at since the cutoff
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('session_id, game_mode, completed_at, final_score, cards_answered')
    .in('game_mode', ['freeplay', 'expert'])
    .not('completed_at', 'is', null)
    .gte('completed_at', since.toISOString())
    .order('completed_at', { ascending: true });

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

  // Map session_ids to their player via the answers table
  const sessionIds = (sessions ?? []).map(s => s.session_id);
  if (sessionIds.length === 0) {
    return NextResponse.json({ flaggedPlayers: [], totalSessions: 0 });
  }

  // Get all answers for these sessions to map player_id
  const { data: answers, error: ansErr } = await supabase
    .from('answers')
    .select('session_id, player_id, correct, game_mode')
    .in('session_id', sessionIds)
    .not('player_id', 'is', null);

  if (ansErr) return NextResponse.json({ error: ansErr.message }, { status: 500 });

  // Group answers by session, then by player
  type SessionInfo = {
    sessionId: string;
    playerId: string;
    gameMode: string;
    correctCount: number;
    totalCount: number;
    completedAt: string;
  };

  const sessionMap = new Map<string, SessionInfo>();
  for (const a of (answers ?? [])) {
    const key = a.session_id;
    if (!sessionMap.has(key)) {
      const sess = (sessions ?? []).find(s => s.session_id === a.session_id);
      sessionMap.set(key, {
        sessionId: a.session_id,
        playerId: a.player_id,
        gameMode: sess?.game_mode ?? 'freeplay',
        correctCount: 0,
        totalCount: 0,
        completedAt: sess?.completed_at ?? '',
      });
    }
    const info = sessionMap.get(key)!;
    info.totalCount++;
    if (a.correct) info.correctCount++;
  }

  // Group by player and count sessions per day
  type PlayerDay = { date: string; sessions: SessionInfo[] };
  const playerDays = new Map<string, PlayerDay[]>();

  for (const info of sessionMap.values()) {
    const day = info.completedAt.slice(0, 10);
    if (!playerDays.has(info.playerId)) playerDays.set(info.playerId, []);
    const days = playerDays.get(info.playerId)!;
    let dayEntry = days.find(d => d.date === day);
    if (!dayEntry) {
      dayEntry = { date: day, sessions: [] };
      days.push(dayEntry);
    }
    dayEntry.sessions.push(info);
  }

  // Flag players who exceed threshold on any day
  type FlaggedPlayer = {
    playerId: string;
    displayName: string | null;
    currentXp: number;
    currentLevel: number;
    legitimateXp: number;
    suspiciousXp: number;
    totalSessionsInWindow: number;
    peakSessionsPerDay: number;
    peakDate: string;
    days: { date: string; sessionCount: number; xpEarned: number }[];
  };

  const flaggedPlayerIds: string[] = [];
  const flaggedDetails = new Map<string, FlaggedPlayer>();

  for (const [playerId, days] of playerDays) {
    let peakCount = 0;
    let peakDate = '';
    let totalSessions = 0;
    let suspiciousXp = 0;
    let legitimateXp = 0;
    const dayDetails: { date: string; sessionCount: number; xpEarned: number }[] = [];

    for (const day of days) {
      const count = day.sessions.length;
      totalSessions += count;
      if (count > peakCount) {
        peakCount = count;
        peakDate = day.date;
      }

      let dayXp = 0;
      for (const sess of day.sessions) {
        dayXp += getXpForRound(sess.correctCount, sess.totalCount || 10, sess.gameMode);
      }
      dayDetails.push({ date: day.date, sessionCount: count, xpEarned: dayXp });

      // Sessions beyond threshold in a day are suspicious
      if (count > threshold) {
        // Sort by time, first N are legit, rest are suspicious
        const sorted = [...day.sessions].sort((a, b) =>
          a.completedAt.localeCompare(b.completedAt)
        );
        for (let i = 0; i < sorted.length; i++) {
          const xp = getXpForRound(sorted[i].correctCount, sorted[i].totalCount || 10, sorted[i].gameMode);
          if (i < threshold) {
            legitimateXp += xp;
          } else {
            suspiciousXp += xp;
          }
        }
      } else {
        legitimateXp += dayXp;
      }
    }

    if (peakCount > threshold) {
      flaggedPlayerIds.push(playerId);
      flaggedDetails.set(playerId, {
        playerId,
        displayName: null,
        currentXp: 0,
        currentLevel: 0,
        legitimateXp,
        suspiciousXp,
        totalSessionsInWindow: totalSessions,
        peakSessionsPerDay: peakCount,
        peakDate,
        days: dayDetails.sort((a, b) => b.sessionCount - a.sessionCount),
      });
    }
  }

  // Fetch player details for flagged players
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
  }

  const flagged = [...flaggedDetails.values()].sort(
    (a, b) => b.suspiciousXp - a.suspiciousXp
  );

  return NextResponse.json({
    flaggedPlayers: flagged,
    totalSessions: sessionIds.length,
    since: since.toISOString(),
    threshold,
  });
}

/**
 * DELETE /api/admin/xp-audit
 *
 * Recalculates a player's XP from scratch based on actual answer records.
 * This is the nuclear option — it recomputes XP as if every valid session
 * was played once, ignoring any phantom/duplicate awards.
 */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const playerIds: string[] = Array.isArray(body.playerIds) ? body.playerIds : [];
  if (playerIds.length === 0) {
    return NextResponse.json({ error: 'playerIds required' }, { status: 400 });
  }
  if (playerIds.length > 20) {
    return NextResponse.json({ error: 'Max 20 players per request' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const results: { playerId: string; oldXp: number; newXp: number; oldLevel: number; newLevel: number }[] = [];

  for (const playerId of playerIds) {
    // Get current player
    const { data: player } = await supabase
      .from('players')
      .select('id, auth_id, xp, level')
      .eq('id', playerId)
      .single();

    if (!player) continue;

    // Get all sessions this player participated in (via answers)
    const { data: playerAnswers } = await supabase
      .from('answers')
      .select('session_id, correct, game_mode')
      .eq('player_id', playerId)
      .in('game_mode', ['freeplay', 'expert', 'research']);

    // Group by session
    const sessionGroups = new Map<string, { correct: number; total: number; mode: string }>();
    for (const a of (playerAnswers ?? [])) {
      if (!sessionGroups.has(a.session_id)) {
        sessionGroups.set(a.session_id, { correct: 0, total: 0, mode: a.game_mode });
      }
      const g = sessionGroups.get(a.session_id)!;
      g.total++;
      if (a.correct) g.correct++;
    }

    // Recalculate total XP from all legitimate sessions
    let recalculatedXp = 0;
    for (const [, group] of sessionGroups) {
      recalculatedXp += getXpForRound(group.correct, group.total || 10, group.mode);
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
