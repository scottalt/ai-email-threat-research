import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  const admin = getSupabaseAdminClient();

  // Count total players who have at least 1 session (active players only)
  const { count: totalPlayers } = await admin
    .from('players')
    .select('id', { count: 'exact', head: true })
    .gte('total_sessions', 1);

  if (!totalPlayers || totalPlayers === 0) {
    return NextResponse.json(
      { stats: {}, totalPlayers: 0 },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } },
    );
  }

  // Count players per achievement
  const { data: achievementCounts } = await admin
    .from('player_achievements')
    .select('achievement_id');

  const counts: Record<string, number> = {};
  for (const row of achievementCounts ?? []) {
    counts[row.achievement_id] = (counts[row.achievement_id] ?? 0) + 1;
  }

  // Convert to percentages
  const stats: Record<string, number> = {};
  for (const [id, count] of Object.entries(counts)) {
    stats[id] = Math.round((count / totalPlayers) * 100);
  }

  return NextResponse.json(
    { stats, totalPlayers },
    { headers: { 'Cache-Control': 'public, s-maxage=300' } },
  );
}
