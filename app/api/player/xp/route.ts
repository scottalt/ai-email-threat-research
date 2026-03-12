import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { getLevelFromXp, getXpForRound, RESEARCH_GRADUATION_ANSWERS } from '@/lib/xp';
import { redis } from '@/lib/redis';

// Rate limits for freeplay/expert XP awards (research has its own caps in answers route)
const MAX_XP_SESSIONS_PER_HOUR = 6;   // ~1 session per 10 min is generous
const MAX_XP_SESSIONS_PER_DAY = 30;   // ~3 sessions per waking hour

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

  // Rate limit XP awards for freeplay/expert modes (research has its own caps)
  if (gameMode !== 'research') {
    const nowHour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const hourlyKey = `ratelimit:xp:${authId}:h:${nowHour}`;
    const dailyKey = `ratelimit:xp:${authId}:d:${todayStr}`;

    const [hourlyCount, dailyCount] = await Promise.all([
      redis.get<number>(hourlyKey),
      redis.get<number>(dailyKey),
    ]);

    if ((hourlyCount ?? 0) >= MAX_XP_SESSIONS_PER_HOUR) {
      return NextResponse.json({ error: 'XP rate limit exceeded — try again later' }, { status: 429 });
    }
    if ((dailyCount ?? 0) >= MAX_XP_SESSIONS_PER_DAY) {
      return NextResponse.json({ error: 'Daily XP limit reached' }, { status: 429 });
    }
  }

  // Compute XP server-side from answers table — never trust client-supplied xpEarned
  let xpEarned = 0;
  if (sessionId) {
    const [{ count: correctCount }, { count: totalCount }] = await Promise.all([
      admin.from('answers').select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId).eq('correct', true),
      admin.from('answers').select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId),
    ]);
    xpEarned = getXpForRound(correctCount ?? 0, totalCount ?? 10, gameMode);
  }

  // Validate personal_best_score against actual session final_score
  let verifiedScore = 0;
  if (sessionId) {
    const { data: sess } = await admin
      .from('sessions')
      .select('final_score')
      .eq('session_id', sessionId)
      .single();
    verifiedScore = sess?.final_score ?? 0;
  }

  const newXp = (p.xp as number) + xpEarned;
  const newLevel = getLevelFromXp(newXp);
  const levelUp = newLevel > (p.level as number);
  const newTotalSessions = sessionCompleted ? (p.total_sessions as number) + 1 : p.total_sessions as number;

  // Research graduation: based on total research answers submitted (not completed sessions)
  const isResearchSession = gameMode === 'research' && sessionCompleted && !!sessionId;
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

  // Increment rate limit counters after successful XP award (freeplay/expert only)
  if (gameMode !== 'research') {
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
  }

  return NextResponse.json({
    xp: newXp,
    level: newLevel,
    xpEarned,
    levelUp,
    graduated: !wasGraduated && nowGraduated,
    researchSessionsCompleted: newResearchSessions,
  });
}
