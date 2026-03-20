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
      // 1. Recent Supabase auth users (last 7 days) — shows who's logging in
      supabase.auth.admin.listUsers({ page: 1, perPage: 50 }).then(({ data }) => {
        const users = data?.users ?? [];
        return users
          .filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= new Date(sevenDaysAgo))
          .sort((a, b) => new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime())
          .map((u) => ({
            authId: u.id,
            email: u.email,
            lastSignIn: u.last_sign_in_at,
            createdAt: u.created_at,
          }));
      }),

      // 2. Recently created/updated players (last 7 days)
      supabase
        .from('players')
        .select('id, auth_id, display_name, research_sessions_completed, research_graduated, created_at, updated_at')
        .or(`created_at.gte.${sevenDaysAgo},updated_at.gte.${sevenDaysAgo}`)
        .order('created_at', { ascending: false })
        .limit(50),

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
        .select('session_id, dealt_card_ids, started_at, cards_answered, game_mode')
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

    // Find players who signed in recently but have zero research answers
    const playerIds = new Set((recentPlayers.data ?? []).map((p) => p.id));
    const researchPlayerIds = new Set((recentResearchAnswers.data ?? []).map((a) => a.player_id));

    const recentPlayersNoResearch = (recentPlayers.data ?? []).filter(
      (p) => !researchPlayerIds.has(p.id) && p.research_sessions_completed === 0
    );

    // Count research answers per player to find who's hit the 30-answer cap
    const playerResearchCounts: Record<string, number> = {};
    for (const p of playersWithResearchCounts.data ?? []) {
      // We need actual answer counts, not just sessions
      playerResearchCounts[p.id] = 0; // will be filled below
    }

    // Get per-player research answer counts for active players
    const activePlayerIds = [...new Set([
      ...(recentPlayers.data ?? []).map((p) => p.id),
      ...(playersWithResearchCounts.data ?? []).map((p) => p.id),
    ])];

    const perPlayerCounts: { playerId: string; displayName: string | null; count: number; capped: boolean }[] = [];
    if (activePlayerIds.length > 0) {
      // Query in batches of 20
      for (let i = 0; i < Math.min(activePlayerIds.length, 60); i += 20) {
        const batch = activePlayerIds.slice(i, i + 20);
        const { data: countData } = await supabase
          .from('answers')
          .select('player_id')
          .eq('game_mode', 'research')
          .in('player_id', batch);

        const counts: Record<string, number> = {};
        for (const row of countData ?? []) {
          counts[row.player_id] = (counts[row.player_id] ?? 0) + 1;
        }

        for (const pid of batch) {
          const player = (recentPlayers.data ?? []).find((p) => p.id === pid)
            ?? (playersWithResearchCounts.data ?? []).find((p) => p.id === pid);
          perPlayerCounts.push({
            playerId: pid,
            displayName: player?.display_name ?? null,
            count: counts[pid] ?? 0,
            capped: (counts[pid] ?? 0) >= 30,
          });
        }
      }
    }

    const cappedPlayers = perPlayerCounts.filter((p) => p.capped);

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

    const abandonedSessions = (recentResearchSessions.data ?? [])
      .filter((s) => !allResearchAnswerSessionIds.has(s.session_id))
      .map((s) => ({
        sessionId: s.session_id,
        cardsDealt: Array.isArray(s.dealt_card_ids) ? s.dealt_card_ids.length : 0,
        startedAt: s.started_at,
      }));

    // Build health signals
    const signals: string[] = [];
    if (abandonedSessions.length > 0) {
      signals.push(`CRITICAL: ${abandonedSessions.length} research session(s) had cards dealt but ZERO answers saved — answers are being silently dropped`);
    }
    if ((answersLast24h.count ?? 0) === 0 && (recentAuthUsers.length > 0)) {
      signals.push('WARNING: Auth users active in last 7d but ZERO research answers in last 24h');
    }
    if (recentPlayersNoResearch.length > 0) {
      signals.push(`${recentPlayersNoResearch.length} recent player(s) signed in but have 0 research answers — possible auth cookie issue`);
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
      recentPlayersNoResearchAnswers: recentPlayersNoResearch.map((p) => ({
        playerId: p.id,
        displayName: p.display_name,
        createdAt: p.created_at,
      })),
      cappedPlayers,
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
