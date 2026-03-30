import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  type RoguelikeRunState,
  type PerkId,
  ROGUELIKE_SESSION_TTL,
  calculateRunClearance,
  calculateFinalScore,
} from '@/lib/roguelike';
import { checkRoguelikeAchievements } from '@/lib/achievement-checker';
import { getLevelFromXp } from '@/lib/xp';

async function getPlayerId(userId: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from('players').select('id').eq('auth_id', userId).single();
  return data?.id ?? null;
}

async function loadState(runId: string): Promise<RoguelikeRunState | null> {
  const stored = await redis.get<string>(`roguelike:run:${runId}`);
  if (!stored) return null;
  return typeof stored === 'string' ? JSON.parse(stored) : stored;
}

async function authAndLoad(
  userId: string,
  runId: string,
): Promise<{ playerId: string; state: RoguelikeRunState } | NextResponse> {
  const playerId = await getPlayerId(userId);
  if (!playerId) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const state = await loadState(runId);
  if (!state) return NextResponse.json({ error: 'Run not found or expired' }, { status: 404 });
  if (state.playerId !== playerId) return NextResponse.json({ error: 'Not your run' }, { status: 403 });

  return { playerId, state };
}

// GET /api/roguelike/[runId] — Get current run state
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const result = await authAndLoad(user.id, runId);
    if (result instanceof NextResponse) return result;
    const { state } = result;

    return NextResponse.json({
      runId: state.runId,
      operationName: state.operationName,
      currentFloor: state.currentFloor,
      totalFloors: state.totalFloors,
      lives: state.lives,
      maxLives: state.maxLives,
      intel: state.intel,
      score: state.score,
      streak: state.streak,
      bestStreak: state.bestStreak,
      deaths: state.deaths,
      perks: state.perks,
      floorsCleared: state.floorsCleared,
      currentCardIndex: state.currentCardIndex,
      currentGimmick: state.currentGimmick,
      floorGimmicks: state.floorGimmicks,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      status: state.status,
    });
  } catch (err) {
    console.error(`[roguelike/${runId}] Unhandled error in GET:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/roguelike/[runId] — Finalize run, calculate score, award clearance
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const result = await authAndLoad(user.id, runId);
    if (result instanceof NextResponse) return result;
    const { playerId, state } = result;

    // Fix 4: Idempotency — prevent double finalization
    if (state.completedAt) {
      return NextResponse.json({ error: 'Run already finalized' }, { status: 409 });
    }

    // Only finalize if in a terminal state
    if (state.status === 'active') {
      return NextResponse.json({ error: 'Run is still active' }, { status: 409 });
    }

    // ── Calculate final score and clearance ──
    const finalScore = calculateFinalScore(
      state.score,
      state.floorsCleared,
      state.deaths,
      state.bestStreak,
      state.totalFloors,
    );
    const clearance = calculateRunClearance(state.floorsCleared, state.deaths, state.totalFloors);
    const completedAt = new Date().toISOString();

    const admin = getSupabaseAdminClient();

    // ── Update DB record (Fix 9: check for errors) ──
    const dbStatus = state.status === 'completed' ? 'complete' : 'abandoned';
    const { error: updateError } = await admin
      .from('roguelike_runs')
      .update({
        score: finalScore,
        floor_reached: state.currentFloor,
        floors_cleared: state.floorsCleared,
        lives_remaining: state.lives,
        intel_earned: state.intel,
        clearance_earned: clearance,
        perks_purchased: state.perks,
        best_streak: state.bestStreak,
        deaths: state.deaths,
        cards_answered: state.cardHistory.length,
        cards_correct: state.cardsCorrect ?? 0,
        status: dbStatus,
        ended_at: completedAt,
      })
      .eq('id', runId);

    if (updateError) {
      console.error(`[roguelike/${runId}] DB update failed:`, updateError);
      return NextResponse.json({ error: 'Failed to save run' }, { status: 500 });
    }

    // ── Award clearance to player (Fix 10: atomic SQL increment) ──
    if (clearance > 0) {
      const { error: clErr } = await admin.rpc('increment_roguelike_clearance', {
        player_id: playerId,
        amount: clearance,
      });
      if (clErr) {
        // Fallback: read-then-write with error logging
        console.warn(`[roguelike/${runId}] RPC increment failed, falling back:`, clErr);
        const { data: pData } = await admin
          .from('players')
          .select('roguelike_clearance')
          .eq('id', playerId)
          .single();
        if (pData) {
          const { error: fbErr } = await admin
            .from('players')
            .update({ roguelike_clearance: (pData.roguelike_clearance ?? 0) + clearance })
            .eq('id', playerId);
          if (fbErr) console.error(`[roguelike/${runId}] Clearance fallback write failed:`, fbErr);
        }
      }
    }

    // ── Update Redis leaderboard (sorted set) ──
    const { data: playerRow } = await admin
      .from('players')
      .select('display_name')
      .eq('id', playerId)
      .single();

    const displayName = playerRow?.display_name ?? playerId;

    // Fix 1: Only update leaderboard if new score is higher than existing
    const existingScore = await redis.zscore('leaderboard:roguelike', playerId);

    // ── Store run metadata in Redis for leaderboard display ──
    const runMeta = {
      runId,
      playerId,
      displayName,
      operationName: state.operationName,
      score: finalScore,
      floorsCleared: state.floorsCleared,
      totalFloors: state.totalFloors,
      deaths: state.deaths,
      bestStreak: state.bestStreak,
      clearance,
      completedAt,
    };

    if (existingScore === null || (existingScore as number) < finalScore) {
      await redis.zadd('leaderboard:roguelike', { score: finalScore, member: playerId });
      await redis.set(`roguelike:meta:${playerId}`, JSON.stringify(runMeta), {
        ex: ROGUELIKE_SESSION_TTL * 24 * 7, // keep for 7 days
      });
    }

    // ── Clean up active run key ──
    await redis.del(`roguelike:active:${playerId}`);

    // ── Check roguelike achievements ──
    // Track defensive perk usage: usedDefensivePerk flag set when SHIELD/STREAK_SAVER consumed
    // EXTRA_LIFE stays in perks array (not consumed), so check it directly
    const defensivePerksUsed = state.usedDefensivePerk === true || state.perks.includes('EXTRA_LIFE' as PerkId);

    // Count total completed runs for the rl_dedicated achievement
    const { count: totalRunsCount } = await admin
      .from('roguelike_runs')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .not('ended_at', 'is', null);

    // Fetch peak Intel from Redis state history (use current intel as proxy for max)
    // floor1TimeMs: not tracked in state — pass 0 to skip rl_speed_demon for now
    let newAchievements: string[] = [];
    try {
      newAchievements = await checkRoguelikeAchievements(admin, playerId, {
        floorsCleared: state.floorsCleared,
        totalFloors: state.totalFloors,
        deaths: state.deaths,
        maxIntel: state.intel,
        hadWagerWin20: false, // TODO: track wager wins in state
        floor1TimeMs: 0,     // TODO: track per-floor timing in state
        survivedWithOneLife: state.lives === 1 && state.floorsCleared > 0,
        defensivePerksUsed,
        totalRuns: totalRunsCount ?? 0,
      });
    } catch (err) {
      console.error(`[roguelike/${runId}] Achievement check failed:`, err);
    }

    // ── Award XP for the run ──
    const XP_PER_CORRECT = 10;
    const XP_WIN_BONUS = 50;
    const XP_FLOOR_BONUS = 20;

    const xpEarned = ((state.cardsCorrect ?? 0) * XP_PER_CORRECT)
      + (state.floorsCleared * XP_FLOOR_BONUS)
      + (state.floorsCleared >= state.totalFloors ? XP_WIN_BONUS : 0);

    let levelUp = false;
    if (xpEarned > 0) {
      const { data: playerRow } = await admin
        .from('players')
        .select('xp, level')
        .eq('id', playerId)
        .single();

      if (playerRow) {
        const newXp = (playerRow.xp ?? 0) + xpEarned;
        const newLevel = getLevelFromXp(newXp);
        levelUp = newLevel > (playerRow.level ?? 0);

        await admin
          .from('players')
          .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() })
          .eq('id', playerId);
      }
    }

    // Fix 5: Return clearanceEarned (not clearance) to match client expectation
    return NextResponse.json({
      finalScore,
      clearanceEarned: clearance,
      floorsCleared: state.floorsCleared,
      totalFloors: state.totalFloors,
      deaths: state.deaths,
      bestStreak: state.bestStreak,
      cardsAnswered: state.cardHistory.length,
      cardsCorrect: state.cardsCorrect ?? 0,
      operationName: state.operationName,
      status: state.status,
      completedAt,
      newAchievements,
      xpEarned,
      levelUp,
    });
  } catch (err) {
    console.error(`[roguelike/${runId}] Unhandled error in PATCH:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
