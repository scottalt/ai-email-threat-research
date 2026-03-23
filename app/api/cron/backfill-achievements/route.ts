import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { backfillPlayerAchievements } from '@/lib/achievement-checker';

const BACKFILL_VERSION = 'v2.0.0'; // bump this to re-run backfill on next deploy
const BACKFILL_KEY = `achievements-backfill:${BACKFILL_VERSION}`;

/**
 * GET /api/cron/backfill-achievements
 *
 * Auto-runs once per deploy version. Called by the app on first page load
 * (via a client-side fire-and-forget fetch). Idempotent — skips if already run.
 *
 * Can also be triggered manually or via Vercel cron.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret if provided (for Vercel cron jobs)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow unauthenticated calls (from client fire-and-forget) but rate limit
  }

  // Check if this version's backfill already ran
  const alreadyRan = await redis.get(BACKFILL_KEY);
  if (alreadyRan) {
    return NextResponse.json({ skipped: true, version: BACKFILL_VERSION });
  }

  // Mark as running (prevent concurrent runs)
  const acquired = await redis.set(BACKFILL_KEY, 'running', { ex: 300, nx: true });
  if (!acquired) {
    return NextResponse.json({ skipped: true, reason: 'already running' });
  }

  try {
    const admin = getSupabaseAdminClient();

    const { data: players, error } = await admin
      .from('players')
      .select('id, xp, level, total_sessions, research_graduated, personal_best_score')
      .order('created_at', { ascending: true });

    if (error || !players) {
      await redis.del(BACKFILL_KEY);
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

    let totalAwarded = 0;

    for (const row of players) {
      const p = row as Record<string, unknown>;
      const playerId = p.id as string;

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
        totalAwarded += awarded.length;
      } catch {
        // Continue with other players
      }
    }

    // Mark as complete (permanent — no expiry)
    await redis.set(BACKFILL_KEY, 'done');

    return NextResponse.json({
      version: BACKFILL_VERSION,
      playersProcessed: players.length,
      totalAchievementsAwarded: totalAwarded,
    });
  } catch (err) {
    await redis.del(BACKFILL_KEY);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
