import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import type { PlayerBackground, PlayerProfile } from '@/lib/types';
import { RESEARCH_GRADUATION_ANSWERS } from '@/lib/xp';
import filter from 'leo-profanity';

const VALID_BACKGROUNDS: PlayerBackground[] = ['other', 'technical', 'infosec', 'prefer_not_to_say'];

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function toProfile(row: Record<string, unknown>, researchAnswersSubmitted = 0, achievements: string[] = [], streakData?: { current_streak: number; longest_streak: number } | null, seenMoments: string[] = []): PlayerProfile {
  return {
    id: row.id as string,
    authId: row.auth_id as string,
    displayName: row.display_name as string | null,
    xp: row.xp as number,
    level: row.level as number,
    totalSessions: row.total_sessions as number,
    researchSessionsCompleted: row.research_sessions_completed as number,
    researchAnswersSubmitted,
    researchGraduated: row.research_graduated as boolean,
    personalBestScore: row.personal_best_score as number,
    background: (row.background as PlayerBackground | null) ?? null,
    achievements,
    currentStreak: streakData?.current_streak ?? 0,
    longestStreak: streakData?.longest_streak ?? 0,
    featuredBadge: ((row.featured_badges as string[]) ?? [])[0] ?? (row.featured_badge as string | null) ?? null,
    bio: (row.bio as string) ?? '',
    privacyLevel: (row.privacy_level as string as 'public' | 'friends' | 'private') ?? 'public',
    featuredBadges: (row.featured_badges as string[]) ?? [],
    themeId: (row.theme_id as string | null) ?? 'phosphor',
    unlockedThemes: (row.unlocked_themes as string[]) ?? [],
    seenMoments,
  };
}

// GET /api/player — returns the signed-in player's profile
export async function GET(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .select('*')
    .eq('auth_id', authId)
    .single();

  if (error || !data) {
    // No player row yet — create one (happens when signing in via OTP, bypassing /auth/callback)
    await admin.from('players').upsert({ auth_id: authId }, { onConflict: 'auth_id', ignoreDuplicates: true });
    const { data: created } = await admin.from('players').select('*').eq('auth_id', authId).single();
    if (!created) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    return NextResponse.json(toProfile(created as unknown as Record<string, unknown>), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const row = data as unknown as Record<string, unknown>;
  const nowHour = new Date().toISOString().slice(0, 13);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [{ count: researchAnswersSubmitted }, { data: achievementRows }, { data: streakData }, { data: momentRows }, hourlyCount, dailyCount, { data: dailyAnswers }] = await Promise.all([
    admin.from('answers').select('*', { count: 'exact', head: true })
      .eq('player_id', row.id as string).eq('game_mode', 'research'),
    admin.from('player_achievements').select('achievement_id')
      .eq('player_id', row.id as string),
    admin.from('player_streaks').select('current_streak, longest_streak')
      .eq('player_id', row.id as string).maybeSingle(),
    admin.from('player_seen_moments').select('moment_id')
      .eq('player_id', row.id as string),
    redis.get<number>(`ratelimit:xp:${authId}:h:${nowHour}`),
    redis.get<number>(`ratelimit:xp:${authId}:d:${todayStr}`),
    // Check if player completed today's daily challenge (via answers → session for final_score)
    admin.from('answers')
      .select('correct, session_id')
      .eq('player_id', row.id as string)
      .eq('game_mode', 'daily')
      .gte('created_at', todayStr + 'T00:00:00.000Z'),
  ]);

  const achievements = (achievementRows ?? []).map((r: { achievement_id: string }) => r.achievement_id);
  const seenMoments = (momentRows ?? []).map((r: { moment_id: string }) => r.moment_id);

  // Retroactive graduation: if player has enough research answers but flag is false, update it
  if (!(row.research_graduated as boolean) && (researchAnswersSubmitted ?? 0) >= RESEARCH_GRADUATION_ANSWERS) {
    await admin.from('players').update({ research_graduated: true, updated_at: new Date().toISOString() }).eq('id', row.id as string);
    row.research_graduated = true;
  }

  // Compute cooldown info from current rate limit state
  const hUsed = hourlyCount ?? 0;
  const dUsed = dailyCount ?? 0;
  const MAX_HOURLY = 12;
  const MAX_DAILY = 30;
  const nextHour = new Date(nowHour + ':00:00.000Z');
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  const nextDay = new Date(todayStr + 'T00:00:00.000Z');
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  // Compute today's daily result from answer records + session final_score
  let dailyResult: { score: number; totalScore: number } | null = null;
  if (dailyAnswers && dailyAnswers.length > 0) {
    const score = dailyAnswers.filter((a: { correct: boolean }) => a.correct).length;
    // Get final_score from the session row (written by PATCH /api/sessions on round end)
    const sessionId = (dailyAnswers[0] as { session_id: string }).session_id;
    let totalScore = 0;
    if (sessionId) {
      const { data: sess } = await admin.from('sessions').select('final_score').eq('session_id', sessionId).maybeSingle();
      totalScore = (sess?.final_score as number) ?? 0;
    }
    dailyResult = { score, totalScore };
  }

  const profile = toProfile(row, researchAnswersSubmitted ?? 0, achievements, streakData, seenMoments);

  return NextResponse.json({
    ...profile,
    dailyResult,
    cooldown: {
      hourlyRemaining: Math.max(0, MAX_HOURLY - hUsed),
      dailyRemaining: Math.max(0, MAX_DAILY - dUsed),
      hourlyResetsAt: nextHour.toISOString(),
      dailyResetsAt: nextDay.toISOString(),
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// POST /api/player — update display_name and/or background
export async function POST(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Rate limit: 10 updates per hour per user
  const rlKey = `ratelimit:player-update:${authId}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60 * 60);
  if (rlCount > 10) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ('displayName' in body) {
    const displayName = typeof body.displayName === 'string'
      ? body.displayName.trim().slice(0, 20)
      : null;
    if (!displayName) return NextResponse.json({ error: 'Invalid display_name' }, { status: 400 });
    if (filter.check(displayName)) return NextResponse.json({ error: 'Keep it clean.' }, { status: 400 });

    // Enforce unique callsigns (case-insensitive)
    const adminCheck = getSupabaseAdminClient();
    const { data: existing } = await adminCheck
      .from('players')
      .select('id')
      .ilike('display_name', displayName)
      .neq('auth_id', authId)
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Callsign already taken.' }, { status: 409 });
    }

    updates.display_name = displayName;
  }

  if ('background' in body) {
    updates.background = VALID_BACKGROUNDS.includes(body.background) ? body.background as PlayerBackground : null;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .update(updates)
    .eq('auth_id', authId)
    .select('*')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  const updatedRow = data as unknown as Record<string, unknown>;
  const { data: postStreakData } = await admin.from('player_streaks').select('current_streak, longest_streak')
    .eq('player_id', updatedRow.id as string).maybeSingle();
  return NextResponse.json(toProfile(updatedRow, 0, [], postStreakData));
}
