import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * GET /api/admin/research-health
 *
 * Diagnostic endpoint to verify the research pipeline is healthy.
 * Shows: recent auth users, recent players, recent answers, silent rejection signals,
 * and players who may be stuck in a broken auth state.
 */
export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Run all queries in parallel
    const [
      recentAuthUsers,
      recentPlayers,
      recentResearchAnswers,
      recentAllAnswers,
      playersWithResearchCounts,
      recentResearchSessions,
      totalResearchAnswers,
      answersLast24h,
      answersLast7d,
    ] = await Promise.all([
      // 1. Recent Supabase auth users (last 7 days) — paginate to find all recent sign-ins
      (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allUsers: any[] = [];
        let page = 1;
        const perPage = 100;
        while (page <= 10) { // safety cap at 1000 users
          const { data } = await supabase.auth.admin.listUsers({ page, perPage });
          const users = data?.users ?? [];
          if (users.length === 0) break;
          allUsers.push(...users);
          if (users.length < perPage) break;
          page++;
        }
        return allUsers
          .filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= new Date(sevenDaysAgo))
          .sort((a, b) => new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime())
          .map((u) => ({
            authId: u.id,
            email: u.email,
            lastSignIn: u.last_sign_in_at,
            createdAt: u.created_at,
          }));
      })(),

      // 2. Players with recent activity (answered in last 7 days)
      (async () => {
        // Find distinct player_ids who submitted answers in the last 7 days
        const { data: recentAnswerRows } = await supabase
          .from('answers')
          .select('player_id, created_at')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false });

        // Deduplicate to get unique player IDs (most recent answer first)
        const seenIds = new Set<string>();
        const uniquePlayerIds: string[] = [];
        for (const row of recentAnswerRows ?? []) {
          if (!seenIds.has(row.player_id)) {
            seenIds.add(row.player_id);
            uniquePlayerIds.push(row.player_id);
          }
        }
        const topPlayerIds = uniquePlayerIds.slice(0, 50);

        if (topPlayerIds.length === 0) return { data: [] };

        // Fetch player details for those active players
        const { data: players } = await supabase
          .from('players')
          .select('id, auth_id, display_name, research_sessions_completed, research_graduated, created_at, updated_at')
          .in('id', topPlayerIds);

        // Sort by most recent activity (same order as uniquePlayerIds)
        const playerMap = new Map((players ?? []).map((p) => [p.id, p]));
        return { data: topPlayerIds.map((id) => playerMap.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)) };
      })(),

      // 3. Recent research answers (last 24h) — the key metric
      supabase
        .from('answers')
        .select('id, player_id, session_id, card_id, correct, created_at')
        .eq('game_mode', 'research')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(100),

      // 4. Recent answers across ALL modes (last 24h) — to see if freeplay works but research doesn't
      supabase
        .from('answers')
        .select('game_mode', { count: 'exact', head: false })
        .gte('created_at', oneDayAgo),

      // 5. All players with their research answer counts — find capped players
      supabase
        .from('players')
        .select('id, auth_id, display_name, research_sessions_completed, research_graduated, created_at')
        .gte('research_sessions_completed', 1)
        .order('research_sessions_completed', { ascending: false }),

      // 6. Research sessions with dealt cards (last 7 days) — if dealt but 0 answers, pipeline is broken
      supabase
        .from('sessions')
        .select('session_id, player_id, dealt_card_ids, started_at, cards_answered, game_mode')
        .eq('game_mode', 'research')
        .not('dealt_card_ids', 'is', null)
        .gte('started_at', sevenDaysAgo)
        .order('started_at', { ascending: false })
        .limit(50),

      // 7. Total research answers ever
      supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('game_mode', 'research'),

      // 7. Research answers last 24h count
      supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('game_mode', 'research')
        .gte('created_at', oneDayAgo),

      // 8. Research answers last 7 days count
      supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('game_mode', 'research')
        .gte('created_at', sevenDaysAgo),
    ]);

    // Count answers by mode in last 24h
    const modeCountsLast24h: Record<string, number> = {};
    for (const row of recentAllAnswers.data ?? []) {
      const mode = (row as { game_mode: string }).game_mode;
      modeCountsLast24h[mode] = (modeCountsLast24h[mode] ?? 0) + 1;
    }

    // Per-player activity breakdown: what are recent players actually doing?
    const recentPlayerIds = (recentPlayers.data ?? []).map((p) => p.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerActivity: { playerId: string; displayName: string | null; createdAt: string; modes: Record<string, number>; researchCapped: boolean }[] = [];

    if (recentPlayerIds.length > 0) {
      for (let i = 0; i < Math.min(recentPlayerIds.length, 60); i += 20) {
        const batch = recentPlayerIds.slice(i, i + 20);
        const { data: answerData } = await supabase
          .from('answers')
          .select('player_id, game_mode')
          .in('player_id', batch);

        const modesByPlayer: Record<string, Record<string, number>> = {};
        for (const row of answerData ?? []) {
          if (!modesByPlayer[row.player_id]) modesByPlayer[row.player_id] = {};
          modesByPlayer[row.player_id][row.game_mode] = (modesByPlayer[row.player_id][row.game_mode] ?? 0) + 1;
        }

        for (const pid of batch) {
          const player = (recentPlayers.data ?? []).find((p) => p.id === pid);
          const modes = modesByPlayer[pid] ?? {};
          playerActivity.push({
            playerId: pid,
            displayName: player?.display_name ?? null,
            createdAt: player?.created_at ?? '',
            modes,
            researchCapped: (modes['research'] ?? 0) >= 30,
          });
        }
      }
    }

    const cappedPlayers = playerActivity.filter((p) => p.researchCapped);

    // Abandoned research sessions: dealt cards but 0 answers recorded
    // This is the smoking gun — it means someone loaded research cards but their answers never saved
    const researchSessionIds = new Set((recentResearchAnswers.data ?? []).map((a) => a.session_id));
    const allResearchAnswerSessionIds = new Set<string>();
    // Also check answers older than 24h for sessions in the 7d window
    {
      const sessionIdsToCheck = (recentResearchSessions.data ?? [])
        .map((s) => s.session_id)
        .filter((sid) => !researchSessionIds.has(sid));
      if (sessionIdsToCheck.length > 0) {
        for (let i = 0; i < sessionIdsToCheck.length; i += 20) {
          const batch = sessionIdsToCheck.slice(i, i + 20);
          const { data: answerCheck } = await supabase
            .from('answers')
            .select('session_id')
            .eq('game_mode', 'research')
            .in('session_id', batch);
          for (const row of answerCheck ?? []) {
            allResearchAnswerSessionIds.add(row.session_id);
          }
        }
      }
    }
    // Merge both sets
    for (const sid of researchSessionIds) allResearchAnswerSessionIds.add(sid);

    // Classify abandoned sessions: bounce (no player activity) vs suspicious (player active elsewhere)
    const abandonedRaw = (recentResearchSessions.data ?? [])
      .filter((s) => !allResearchAnswerSessionIds.has(s.session_id));

    // Look up whether each abandoned session's player has other answers
    const abandonedPlayerIds = [...new Set(abandonedRaw.map((s) => s.player_id).filter(Boolean))] as string[];
    const activeAbandonedPlayers = new Set<string>();
    if (abandonedPlayerIds.length > 0) {
      for (let i = 0; i < abandonedPlayerIds.length; i += 20) {
        const batch = abandonedPlayerIds.slice(i, i + 20);
        const { data: activityCheck } = await supabase
          .from('answers')
          .select('player_id')
          .in('player_id', batch)
          .limit(batch.length);
        for (const row of activityCheck ?? []) {
          activeAbandonedPlayers.add(row.player_id);
        }
      }
    }

    const abandonedSessions = abandonedRaw.map((s) => {
      const hasPlayer = Boolean(s.player_id);
      const playerActive = hasPlayer && activeAbandonedPlayers.has(s.player_id!);
      return {
        sessionId: s.session_id,
        cardsDealt: Array.isArray(s.dealt_card_ids) ? s.dealt_card_ids.length : 0,
        startedAt: s.started_at,
        // suspicious = player exists AND has answers elsewhere but none in this session
        status: playerActive ? 'suspicious' : hasPlayer ? 'bounce' : 'anonymous',
      };
    });

    // Build health signals
    const signals: string[] = [];
    const suspiciousSessions = abandonedSessions.filter((s) => s.status === 'suspicious');
    const bounceSessions = abandonedSessions.filter((s) => s.status !== 'suspicious');
    if (suspiciousSessions.length > 0) {
      signals.push(`CRITICAL: ${suspiciousSessions.length} session(s) had cards dealt, player is active elsewhere, but ZERO answers saved — possible silent failure`);
    }
    if (bounceSessions.length > 0) {
      signals.push(`${bounceSessions.length} session(s) had cards dealt but no answers — likely bounced before answering`);
    }
    if ((answersLast24h.count ?? 0) === 0 && (recentAuthUsers.length > 0)) {
      signals.push('WARNING: Auth users active in last 7d but ZERO research answers in last 24h');
    }
    const playersNoActivity = playerActivity.filter((p) => Object.keys(p.modes).length === 0);
    const playersOnlyFreeplay = playerActivity.filter((p) => Object.keys(p.modes).length > 0 && !p.modes['research']);
    if (playersNoActivity.length > 0) {
      signals.push(`${playersNoActivity.length} recent player(s) signed in but have zero answers in any mode — signed in and left`);
    }
    if (playersOnlyFreeplay.length > 0) {
      signals.push(`${playersOnlyFreeplay.length} recent player(s) playing freeplay but not research — by choice, not a bug`);
    }
    if (cappedPlayers.length > 0) {
      signals.push(`${cappedPlayers.length} player(s) have hit the 30-answer lifetime research cap`);
    }
    if ((modeCountsLast24h['freeplay'] ?? 0) > 0 && (modeCountsLast24h['research'] ?? 0) === 0) {
      signals.push('WARNING: Freeplay answers recorded but ZERO research — research pipeline may be broken');
    }
    if (signals.length === 0) {
      signals.push('No anomalies detected');
    }

    return NextResponse.json({
      checkedAt: now.toISOString(),
      signals,
      counts: {
        totalResearchAnswersEver: totalResearchAnswers.count ?? 0,
        researchAnswersLast24h: answersLast24h.count ?? 0,
        researchAnswersLast7d: answersLast7d.count ?? 0,
        answersByModeLast24h: modeCountsLast24h,
      },
      recentAuthUsers: recentAuthUsers.slice(0, 20),
      playerActivity,
      cappedPlayers: cappedPlayers.map((p) => ({
        playerId: p.playerId,
        displayName: p.displayName,
        count: p.modes['research'] ?? 0,
        capped: p.researchCapped,
      })),
      abandonedSessions,
      recentResearchAnswers: (recentResearchAnswers.data ?? []).slice(0, 20).map((a) => ({
        playerId: a.player_id,
        sessionId: a.session_id,
        cardId: a.card_id,
        correct: a.correct,
        createdAt: a.created_at,
      })),
    });
  } catch (err) {
    console.error('[research-health] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
