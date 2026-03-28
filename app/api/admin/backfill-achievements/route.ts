import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';
import { backfillPlayerAchievements } from '@/lib/achievement-checker';

// POST /api/admin/backfill-achievements
// Retroactively awards achievements to all existing players based on their stats and history
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = getSupabaseAdminClient();

  // Fetch all players
  const { data: players, error } = await admin
    .from('players')
    .select('id, xp, level, total_sessions, research_graduated, personal_best_score')
    .order('created_at', { ascending: true });

  if (error || !players) {
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }

  const results: { playerId: string; awarded: string[] }[] = [];
  let totalAwarded = 0;

  for (const row of players) {
    const p = row as Record<string, unknown>;
    const playerId = p.id as string;

    // Fetch supplementary data for new achievement checks
    const [{ count: researchCount }, { data: h2hStatsRow }] = await Promise.all([
      admin.from('answers').select('id', { count: 'exact', head: true })
        .eq('player_id', playerId).eq('game_mode', 'research'),
      admin.from('h2h_player_stats').select('wins, best_win_streak, peak_rank_points')
        .eq('player_id', playerId).eq('season', 'season-0').maybeSingle(),
    ]);

    const player = {
      id: playerId,
      xp: p.xp as number,
      level: p.level as number,
      totalSessions: p.total_sessions as number,
      researchGraduated: p.research_graduated as boolean,
      personalBestScore: p.personal_best_score as number,
      researchAnswersSubmitted: researchCount ?? 0,
      h2hWins: h2hStatsRow?.wins ?? 0,
      h2hBestStreak: h2hStatsRow?.best_win_streak ?? 0,
      h2hPeakRankPoints: h2hStatsRow?.peak_rank_points ?? 0,
    };

    try {
      const awarded = await backfillPlayerAchievements(admin, player);
      if (awarded.length > 0) {
        results.push({ playerId: player.id, awarded });
        totalAwarded += awarded.length;
      }
    } catch {
      // Continue with other players if one fails
    }
  }

  return NextResponse.json({
    playersProcessed: players.length,
    playersAwarded: results.length,
    totalAchievementsAwarded: totalAwarded,
    details: results,
  });
}
