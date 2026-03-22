import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { CURRENT_SEASON, getRankFromPoints } from '@/lib/h2h';

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

// GET /api/h2h/stats — authenticated player's H2H stats for the current season
export async function GET() {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();

  const { data: player } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', authId)
    .single();

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const { data: stats } = await admin
    .from('h2h_player_stats')
    .select('rank_points, wins, losses, win_streak, best_win_streak, peak_rank_points, rated_matches_today')
    .eq('player_id', player.id)
    .eq('season', CURRENT_SEASON)
    .single();

  const rankPoints = stats?.rank_points ?? 0;
  const rank = getRankFromPoints(rankPoints);

  return NextResponse.json({
    season: CURRENT_SEASON,
    rankPoints,
    rank: rank.tier,
    rankLabel: rank.label.toUpperCase(),
    rankColor: rank.color,
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
    winStreak: stats?.win_streak ?? 0,
    bestWinStreak: stats?.best_win_streak ?? 0,
    peakRankPoints: stats?.peak_rank_points ?? 0,
    ratedMatchesToday: stats?.rated_matches_today ?? 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
