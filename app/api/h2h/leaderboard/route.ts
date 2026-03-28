import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { CURRENT_SEASON, getRankFromPoints } from '@/lib/h2h';

// GET /api/h2h/leaderboard — public seasonal H2H leaderboard
export async function GET() {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('h2h_player_stats')
    .select('player_id, rank_points, wins, losses, players!player_id(display_name)')
    .eq('season', CURRENT_SEASON)
    .order('rank_points', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }

  const leaderboard = (data ?? []).map((row, index) => {
    const player = Array.isArray(row.players) ? row.players[0] : row.players;
    const rank = getRankFromPoints(row.rank_points);

    return {
      position: index + 1,
      displayName: player?.display_name ?? 'Unknown',
      rankPoints: row.rank_points,
      rankTier: rank.tier,
      rankLabel: rank.label.toUpperCase(),
      rankColor: rank.color,
      wins: row.wins,
      losses: row.losses,
    };
  });

  return NextResponse.json({
    season: CURRENT_SEASON,
    leaderboard,
  });
}
