import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { getLevelFromXp, getXpForRound, getStreakBonusXp, RESEARCH_GRADUATION_ANSWERS } from '@/lib/xp';
import { redis } from '@/lib/redis';
import { checkAchievements } from '@/lib/achievement-checker';

// Rate limits for freeplay/expert XP awards (research has its own caps in answers route)
const MAX_XP_SESSIONS_PER_HOUR = 12;  // ~1 session per 5 min
const MAX_XP_SESSIONS_PER_DAY = 30;   // ~3 sessions per waking hour
const MIN_SESSION_DURATION_MS = 15_000; // 15s — no human reads 10 emails faster than this

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// PATCH /api/player/xp
// Body: { xpEarned: number; score: number; gameMode: string; sessionCompleted: boolean; sessionId: string }
export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const gameMode = String(body.gameMode ?? 'freeplay');
  const sessionCompleted = Boolean(body.sessionCompleted);
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : null;

  const admin = getSupabaseAdminClient();
  const { data: player, error: fetchErr } = await admin
    .from('players')
    .select('id, xp, level, total_sessions, research_sessions_completed, research_graduated, personal_best_score, last_xp_session_id')
    .eq('auth_id', authId)
    .single();

  if (fetchErr || !player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const p = player as Record<string, unknown>;

  // Dedup: skip if this session was already awarded XP — check BEFORE expensive queries
  if (sessionId && (p.last_xp_session_id as string | null) === sessionId) {
    return NextResponse.json({ error: 'XP already awarded for this session' }, { status: 409 });
  }

  // Rate limit XP awards for ALL modes (preview excluded — never awards XP anyway)
  if (gameMode !== 'preview') {
    const nowHour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const hourlyKey = `ratelimit:xp:${authId}:h:${nowHour}`;
    const dailyKey = `ratelimit:xp:${authId}:d:${todayStr}`;

    const [hourlyCount, dailyCount] = await Promise.all([
      redis.get<number>(hourlyKey),
      redis.get<number>(dailyKey),
    ]);

    const hCount = hourlyCount ?? 0;
    const dCount = dailyCount ?? 0;

    if (hCount >= MAX_XP_SESSIONS_PER_HOUR || dCount >= MAX_XP_SESSIONS_PER_DAY) {
      // Next hour boundary
      const nextHour = new Date(nowHour + ':00:00.000Z');
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);
      // Next day boundary (midnight UTC)
      const nextDay = new Date(todayStr + 'T00:00:00.000Z');
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      return NextResponse.json({
        error: hCount >= MAX_XP_SESSIONS_PER_HOUR
          ? 'XP rate limit exceeded — try again later'
          : 'Daily XP limit reached',
        cooldown: {
          hourlyRemaining: Math.max(0, MAX_XP_SESSIONS_PER_HOUR - hCount),
          dailyRemaining: Math.max(0, MAX_XP_SESSIONS_PER_DAY - dCount),
          hourlyResetsAt: nextHour.toISOString(),
          dailyResetsAt: nextDay.toISOString(),
        },
      }, { status: 429 });
    }
  }

  // Validate session: check score, duration, and game_mode match
  let verifiedScore = 0;
  let verifiedGameMode = gameMode;
  if (sessionId) {
    const { data: sess } = await admin
      .from('sessions')
      .select('final_score, started_at, completed_at, game_mode')
      .eq('session_id', sessionId)
      .single();
    verifiedScore = sess?.final_score ?? 0;

    // Use the session's actual game_mode — never trust client-supplied mode
    if (sess?.game_mode) {
      verifiedGameMode = sess.game_mode;
    }

    if (sess?.started_at && sess?.completed_at) {
      const duration = new Date(sess.completed_at).getTime() - new Date(sess.started_at).getTime();
      if (duration < MIN_SESSION_DURATION_MS) {
        return NextResponse.json({ error: 'Session completed too quickly' }, { status: 400 });
      }
    }
  }

  // Compute XP server-side from answers table — never trust client-supplied xpEarned
  // Cap answer counts to ROUND_SIZE to prevent inflated XP from extra answer submissions
  const ROUND_SIZE = 10;
  let xpEarned = 0;
  // Fetch full session answers for both XP calculation and achievement checking
  let sessionAnswers: { correct: boolean; confidence: string; difficulty: string; time_from_render_ms: number | null; streak_at_answer_time: number; headers_opened: boolean; url_inspected: boolean; game_mode: string }[] = [];
  if (sessionId) {
    const { data: answerRows } = await admin
      .from('answers')
      .select('correct, confidence, difficulty, time_from_render_ms, streak_at_answer_time, headers_opened, url_inspected, game_mode')
      .eq('session_id', sessionId);
    sessionAnswers = (answerRows ?? []) as typeof sessionAnswers;
    const correctCount = Math.min(sessionAnswers.filter(a => a.correct).length, ROUND_SIZE);
    const totalCount = Math.min(sessionAnswers.length, ROUND_SIZE);
    xpEarned = getXpForRound(correctCount, totalCount, verifiedGameMode);
  }

  // --- Daily streak computation ---
  // Compute today/yesterday once to avoid UTC midnight boundary issues
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  let streakDay = 0;
  let streakBonusXp = 0;
  const playerId = p.id as string;

  // Upsert streak row (ON CONFLICT DO NOTHING handles race conditions)
  await admin.from('player_streaks').upsert(
    { player_id: playerId },
    { onConflict: 'player_id', ignoreDuplicates: true }
  );

  const { data: streakRow } = await admin
    .from('player_streaks')
    .select('current_streak, longest_streak, last_active_date')
    .eq('player_id', playerId)
    .maybeSingle();

  let newCurrentStreak = 1;
  let newLongestStreak = streakRow?.longest_streak ?? 0;
  let streakAdvanced = false;

  if (streakRow) {
    const lastActive = streakRow.last_active_date; // DATE comes as YYYY-MM-DD string

    if (lastActive === today) {
      // Same day — no advancement, return current values
      newCurrentStreak = streakRow.current_streak;
      newLongestStreak = streakRow.longest_streak;
      streakDay = newCurrentStreak;
      streakBonusXp = 0;
    } else {
      if (lastActive === yesterday) {
        newCurrentStreak = streakRow.current_streak + 1;
      } else {
        newCurrentStreak = 1;
      }
      newLongestStreak = Math.max(newLongestStreak, newCurrentStreak);
      streakDay = newCurrentStreak;
      streakBonusXp = getStreakBonusXp(newCurrentStreak);
      streakAdvanced = true;
    }
  } else {
    // No row existed (shouldn't happen after upsert, but defensive)
    streakDay = 1;
    streakBonusXp = getStreakBonusXp(1);
    streakAdvanced = true;
  }
  // --- End streak computation ---

  // --- Quest milestone rewards (one-time, server-verified) ---
  // Award XP bonuses when crossing 10/20/30 research answer thresholds
  let questBonusXp = 0;
  if (verifiedGameMode === 'research') {
    const { count: researchTotal } = await admin
      .from('answers')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .eq('game_mode', 'research');
    const total = researchTotal ?? 0;

    const questMilestones = [
      { threshold: 10, reward: 100, key: `quest-reward:${playerId}:10` },
      { threshold: 20, reward: 200, key: `quest-reward:${playerId}:20` },
      { threshold: 30, reward: 500, key: `quest-reward:${playerId}:30` },
    ];

    for (const milestone of questMilestones) {
      if (total >= milestone.threshold) {
        // SET NX — only awards if key doesn't exist (prevents double-award)
        const awarded = await redis.set(milestone.key, '1', { nx: true, ex: 365 * 24 * 3600 });
        if (awarded) {
          questBonusXp += milestone.reward;
        }
      }
    }
  }

  const newXp = (p.xp as number) + xpEarned + streakBonusXp + questBonusXp;
  const newLevel = getLevelFromXp(newXp);
  const levelUp = newLevel > (p.level as number);
  const newTotalSessions = sessionCompleted ? (p.total_sessions as number) + 1 : p.total_sessions as number;

  // Research graduation: based on total research answers submitted (not completed sessions)
  const isResearchSession = verifiedGameMode === 'research' && sessionCompleted && !!sessionId;
  const newResearchSessions = isResearchSession
    ? (p.research_sessions_completed as number) + 1
    : p.research_sessions_completed as number;
  const wasGraduated = p.research_graduated as boolean;

  let nowGraduated = wasGraduated;
  if (!wasGraduated) {
    const { count: totalResearchAnswers } = await admin
      .from('answers')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', p.id as string)
      .eq('game_mode', 'research');
    nowGraduated = (totalResearchAnswers ?? 0) >= RESEARCH_GRADUATION_ANSWERS;
  }

  const newBest = Math.max(p.personal_best_score as number, verifiedScore);

  // Conditional update: only update if last_xp_session_id hasn't changed since we read it
  // This prevents the race condition where two concurrent requests both pass the dedup check
  const currentLastSessionId = p.last_xp_session_id as string | null;
  let updateQuery = admin.from('players').update({
    xp: newXp,
    level: newLevel,
    total_sessions: newTotalSessions,
    research_sessions_completed: newResearchSessions,
    research_graduated: nowGraduated,
    personal_best_score: newBest,
    ...(sessionId ? { last_xp_session_id: sessionId } : {}),
    updated_at: new Date().toISOString(),
  }).eq('auth_id', authId);

  // Add optimistic concurrency check: only update if last_xp_session_id hasn't changed
  if (currentLastSessionId) {
    updateQuery = updateQuery.eq('last_xp_session_id', currentLastSessionId);
  } else {
    updateQuery = updateQuery.is('last_xp_session_id', null);
  }

  const { data: updated, error: updateErr } = await updateQuery.select('id');

  if (updateErr) return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
  if (!updated || updated.length === 0) {
    // Conditional update matched no rows — another request already awarded XP
    return NextResponse.json({ error: 'XP already awarded for this session' }, { status: 409 });
  }

  // Increment rate limit counters after successful XP award (freeplay/expert/daily only)
  let cooldown: { hourlyRemaining: number; dailyRemaining: number; hourlyResetsAt: string; dailyResetsAt: string } | undefined;
  if (verifiedGameMode !== 'research') {
    const nowHour = new Date().toISOString().slice(0, 13);
    const todayStr = new Date().toISOString().slice(0, 10);
    const hourlyKey = `ratelimit:xp:${authId}:h:${nowHour}`;
    const dailyKey = `ratelimit:xp:${authId}:d:${todayStr}`;

    const [hCount, dCount] = await Promise.all([
      redis.incr(hourlyKey),
      redis.incr(dailyKey),
    ]);
    // Set TTLs only on first increment to avoid resetting them
    if (hCount === 1) await redis.expire(hourlyKey, 3600);
    if (dCount === 1) await redis.expire(dailyKey, 86400);

    const nextHour = new Date(nowHour + ':00:00.000Z');
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    const nextDay = new Date(todayStr + 'T00:00:00.000Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    cooldown = {
      hourlyRemaining: Math.max(0, MAX_XP_SESSIONS_PER_HOUR - hCount),
      dailyRemaining: Math.max(0, MAX_XP_SESSIONS_PER_DAY - dCount),
      hourlyResetsAt: nextHour.toISOString(),
      dailyResetsAt: nextDay.toISOString(),
    };
  }

  // Commit streak update only after successful XP write
  if (streakAdvanced) {
    await admin.from('player_streaks').update({
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_active_date: today,
      streak_updated_at: new Date().toISOString(),
    }).eq('player_id', playerId);
  }

  // Auto-submit to daily leaderboard for daily mode
  if (verifiedGameMode === 'daily' && sessionCompleted && verifiedScore > 0) {
    const { data: playerInfo } = await admin
      .from('players')
      .select('display_name, level')
      .eq('auth_id', authId)
      .single();
    if (playerInfo?.display_name) {
      const todayDate = new Date().toISOString().slice(0, 10);
      const dailyKey = `leaderboard:daily:${todayDate}`;
      // Use plain display_name as member — no level suffix — to prevent
      // duplicate entries when a player levels up during the same day.
      const member = playerInfo.display_name;
      const existing = await redis.zscore(dailyKey, member);
      if (existing === null || (existing as number) < verifiedScore) {
        await redis.zadd(dailyKey, { score: verifiedScore, member });
        // 7-day TTL
        const expireAt = Math.floor(new Date(`${todayDate}T00:00:00Z`).getTime() / 1000) + 7 * 24 * 60 * 60;
        await redis.expireat(dailyKey, expireAt);
      }
    }
  }

  // Check for newly earned achievements
  let newAchievements: string[] = [];
  if (sessionId) {
    try {
      newAchievements = await checkAchievements(admin, {
        id: p.id as string,
        xp: newXp,
        level: newLevel,
        totalSessions: newTotalSessions,
        researchGraduated: nowGraduated,
        personalBestScore: newBest,
      }, sessionId, sessionAnswers, verifiedGameMode, newCurrentStreak);
    } catch {
      // Achievement check failure should never block XP award
    }
  }

  return NextResponse.json({
    xp: newXp,
    level: newLevel,
    xpEarned,
    levelUp,
    graduated: !wasGraduated && nowGraduated,
    researchSessionsCompleted: newResearchSessions,
    newAchievements,
    streakDay,
    streakBonusXp,
    questBonusXp,
    ...(cooldown ? { cooldown } : {}),
  });
}
