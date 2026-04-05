import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import type { RoguelikeRunState } from '@/lib/roguelike';
import { ROGUELIKE_CARDS_PER_FLOOR } from '@/lib/roguelike';

// POST /api/roguelike/[runId]/pause — Pause a run at end of floor
export async function POST(
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

    const admin = getSupabaseAdminClient();
    const { data: player } = await admin.from('players').select('id').eq('auth_id', user.id).single();
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    // Load state from Redis
    const stored = await redis.get<string>(`roguelike:run:${runId}`);
    if (!stored) return NextResponse.json({ error: 'Run not found or expired' }, { status: 404 });
    const state: RoguelikeRunState = typeof stored === 'string' ? JSON.parse(stored) : stored;

    if (state.playerId !== player.id) return NextResponse.json({ error: 'Not your run' }, { status: 403 });
    if (state.status !== 'active') return NextResponse.json({ error: 'Run is not active' }, { status: 409 });

    // Only allow pause at end of a floor
    if (state.currentCardIndex < ROGUELIKE_CARDS_PER_FLOOR) {
      return NextResponse.json({ error: 'Can only pause after completing a floor' }, { status: 409 });
    }

    // Save full state snapshot to DB
    const pausedState: RoguelikeRunState = { ...state, status: 'paused' };
    const { error: updateError } = await admin
      .from('roguelike_runs')
      .update({
        status: 'paused',
        paused_state: pausedState,
        score: state.score,
        floor_reached: state.currentFloor,
        floors_cleared: state.floorsCleared,
        lives_remaining: state.lives,
        intel_earned: state.intel,
        cards_answered: state.cardHistory.length,
        cards_correct: state.cardsCorrect,
        best_streak: state.bestStreak,
        deaths: state.deaths,
      })
      .eq('id', runId);

    if (updateError) {
      console.error(`[roguelike/${runId}/pause] DB update failed:`, updateError);
      return NextResponse.json({ error: 'Failed to pause run' }, { status: 500 });
    }

    // Clean up Redis keys
    await Promise.all([
      redis.del(`roguelike:run:${runId}`),
      redis.del(`roguelike:active:${player.id}`),
      // Clean up floor card/assignment keys
      ...Array.from({ length: state.totalFloors }, (_, i) =>
        Promise.all([
          redis.del(`roguelike:cards:${runId}:${i}`),
          redis.del(`roguelike:assignments:${runId}:${i}`),
        ])
      ).flat(),
    ]);

    return NextResponse.json({ paused: true });
  } catch (err) {
    console.error(`[roguelike/${runId}/pause] Unhandled error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
