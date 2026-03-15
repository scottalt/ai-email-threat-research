import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * GET /api/admin/player-investigation
 *
 * Investigates answer patterns for players matching a given background (or all).
 * Surfaces per-player breakdowns with anomaly flags to help identify suspicious
 * 100% accuracy or other irregular patterns.
 *
 * Query params:
 *   background - filter by background value: infosec, technical, other,
 *                prefer_not_to_say, unset (null backgrounds), or "all" (default: all)
 *   mode       - game mode filter (default: research)
 */

const PAGE_SIZE = 1000;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const bgFilter = searchParams.get('background') ?? 'all';
  const modeFilter = searchParams.get('mode') ?? 'research';

  const supabase = getSupabaseAdminClient();

  // Paginate through all matching answers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allAnswers: any[] = [];
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('answers')
      .select(
        'id, correct, is_phishing, user_answer, confidence, technique, difficulty, ' +
        'time_from_render_ms, headers_opened, url_inspected, scroll_depth_pct, ' +
        'answer_ordinal, card_id, session_id, created_at, player_id, ' +
        'players!player_id(id, background, display_name, research_graduated, xp, created_at)'
      )
      .eq('game_mode', modeFilter)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      done = true;
    } else {
      allAnswers.push(...data);
      if (data.length < PAGE_SIZE) done = true;
      else from += PAGE_SIZE;
    }
  }

  // Filter by background
  const filtered = allAnswers.filter((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const joined = a.players as any;
    const player = Array.isArray(joined) ? joined[0] ?? null : joined;
    const bg = player?.background ?? 'unset';

    if (bgFilter === 'all') return true;
    if (bgFilter === 'undisclosed') return bg === 'unset' || bg === 'prefer_not_to_say';
    if (bgFilter === 'unset') return bg === 'unset';
    return bg === bgFilter;
  });

  // Group by player
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerMap = new Map<string, { player: any; answers: any[] }>();
  for (const a of filtered) {
    const pid = a.player_id ?? 'anonymous';
    if (!playerMap.has(pid)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joined = a.players as any;
      const player = Array.isArray(joined) ? joined[0] ?? null : joined;
      playerMap.set(pid, { player, answers: [] });
    }
    playerMap.get(pid)!.answers.push(a);
  }

  // Build per-player analysis
  const players = Array.from(playerMap.entries()).map(([playerId, { player, answers }]) => {
    const total = answers.length;
    const correct = answers.filter((a: { correct: boolean }) => a.correct).length;
    const accuracyRate = total ? Math.round((correct / total) * 100) : 0;

    // Timing analysis
    const times = answers
      .map((a: { time_from_render_ms: number | null }) => a.time_from_render_ms)
      .filter((t: number | null): t is number => t != null);
    const avgTimeMs = times.length ? Math.round(times.reduce((s: number, t: number) => s + t, 0) / times.length) : null;
    const minTimeMs = times.length ? Math.min(...times) : null;
    const maxTimeMs = times.length ? Math.max(...times) : null;

    // Confidence distribution
    const confDist: Record<string, number> = {};
    for (const a of answers) {
      const c = a.confidence ?? 'unknown';
      confDist[c] = (confDist[c] ?? 0) + 1;
    }

    // Accuracy by confidence
    const confAccuracy: Record<string, { total: number; correct: number; rate: number }> = {};
    for (const a of answers) {
      const c = a.confidence ?? 'unknown';
      if (!confAccuracy[c]) confAccuracy[c] = { total: 0, correct: 0, rate: 0 };
      confAccuracy[c].total++;
      if (a.correct) confAccuracy[c].correct++;
    }
    for (const c of Object.keys(confAccuracy)) {
      confAccuracy[c].rate = Math.round((confAccuracy[c].correct / confAccuracy[c].total) * 100);
    }

    // Phishing vs legit breakdown
    const phishingAnswers = answers.filter((a: { is_phishing: boolean }) => a.is_phishing);
    const legitAnswers = answers.filter((a: { is_phishing: boolean }) => !a.is_phishing);
    const phishingCorrect = phishingAnswers.filter((a: { correct: boolean }) => a.correct).length;
    const legitCorrect = legitAnswers.filter((a: { correct: boolean }) => a.correct).length;

    // Tool usage
    const headersUsed = answers.filter((a: { headers_opened: boolean }) => a.headers_opened).length;
    const urlUsed = answers.filter((a: { url_inspected: boolean }) => a.url_inspected).length;

    // Streak analysis — longest correct streak
    let maxStreak = 0;
    let currentStreak = 0;
    for (const a of answers) {
      if (a.correct) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    // Session timing — time between sessions
    const sessions = [...new Set(answers.map((a: { session_id: string }) => a.session_id))];
    const sessionDates = sessions.map((sid) => {
      const sessionAnswers = answers.filter((a: { session_id: string }) => a.session_id === sid);
      return { sessionId: sid, firstAnswer: sessionAnswers[0]?.created_at };
    }).sort((a: { firstAnswer: string }, b: { firstAnswer: string }) =>
      new Date(a.firstAnswer).getTime() - new Date(b.firstAnswer).getTime()
    );

    // Unique cards answered
    const uniqueCards = new Set(answers.map((a: { card_id: string }) => a.card_id)).size;

    // Scroll depth analysis
    const scrollDepths = answers
      .map((a: { scroll_depth_pct: number | null }) => a.scroll_depth_pct)
      .filter((s: number | null): s is number => s != null);
    const avgScrollDepth = scrollDepths.length
      ? Math.round(scrollDepths.reduce((s: number, d: number) => s + d, 0) / scrollDepths.length)
      : null;

    // Anomaly flags
    const flags: string[] = [];
    if (accuracyRate === 100 && total >= 10) flags.push('PERFECT_ACCURACY');
    if (accuracyRate >= 95 && total >= 20) flags.push('NEAR_PERFECT');
    if (minTimeMs !== null && minTimeMs < 2000) flags.push('SUSPICIOUSLY_FAST_ANSWER');
    if (avgTimeMs !== null && avgTimeMs < 5000) flags.push('LOW_AVG_TIME');
    if (maxStreak >= 20) flags.push('LONG_STREAK_20+');
    else if (maxStreak >= 10) flags.push('LONG_STREAK_10+');
    if (total > 0 && headersUsed === 0 && urlUsed === 0 && accuracyRate >= 90) {
      flags.push('HIGH_ACCURACY_NO_TOOLS');
    }

    // Per-answer timeline
    const timeline = answers.map((a: {
      card_id: string; user_answer: string; correct: boolean; is_phishing: boolean;
      confidence: string; time_from_render_ms: number | null; headers_opened: boolean;
      url_inspected: boolean; scroll_depth_pct: number | null; technique: string | null;
      difficulty: string; answer_ordinal: number | null; session_id: string; created_at: string;
    }) => ({
      cardId: a.card_id,
      userAnswer: a.user_answer,
      correct: a.correct,
      isPhishing: a.is_phishing,
      confidence: a.confidence,
      timeMs: a.time_from_render_ms,
      headersOpened: a.headers_opened,
      urlInspected: a.url_inspected,
      scrollDepth: a.scroll_depth_pct,
      technique: a.technique,
      difficulty: a.difficulty,
      ordinal: a.answer_ordinal,
      sessionId: a.session_id,
      createdAt: a.created_at,
    }));

    return {
      playerId,
      background: player?.background ?? null,
      displayName: player?.display_name ?? null,
      researchGraduated: player?.research_graduated ?? false,
      xp: player?.xp ?? 0,
      playerCreatedAt: player?.created_at ?? null,
      summary: {
        totalAnswers: total,
        uniqueCards,
        correct,
        wrong: total - correct,
        accuracyRate,
        phishing: { total: phishingAnswers.length, correct: phishingCorrect, rate: phishingAnswers.length ? Math.round((phishingCorrect / phishingAnswers.length) * 100) : 0 },
        legit: { total: legitAnswers.length, correct: legitCorrect, rate: legitAnswers.length ? Math.round((legitCorrect / legitAnswers.length) * 100) : 0 },
        sessions: sessions.length,
        maxCorrectStreak: maxStreak,
      },
      timing: { avgMs: avgTimeMs, minMs: minTimeMs, maxMs: maxTimeMs },
      toolUsage: { headersOpened: headersUsed, urlInspected: urlUsed, headersRate: total ? Math.round((headersUsed / total) * 100) : 0, urlRate: total ? Math.round((urlUsed / total) * 100) : 0 },
      confidenceDistribution: confDist,
      confidenceAccuracy: confAccuracy,
      scrollDepth: { avg: avgScrollDepth },
      sessionTimeline: sessionDates,
      flags,
      timeline,
    };
  });

  // Sort: flagged players first, then by accuracy descending
  players.sort((a, b) => {
    if (a.flags.length !== b.flags.length) return b.flags.length - a.flags.length;
    return b.summary.accuracyRate - a.summary.accuracyRate;
  });

  return NextResponse.json({
    filter: { background: bgFilter, mode: modeFilter },
    totalPlayers: players.length,
    totalAnswers: filtered.length,
    flaggedPlayers: players.filter((p) => p.flags.length > 0).length,
    players,
  });
}
