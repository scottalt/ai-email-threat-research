import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  type RoguelikeRunState,
  ROGUELIKE_SESSION_TTL,
} from '@/lib/roguelike';

// POST /api/roguelike/[runId]/resume — Resume a paused run
// Rehydrates the paused state back into Redis so the client can load the shop.
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

    // Load paused run from DB
    const { data: run } = await admin
      .from('roguelike_runs')
      .select('id, player_id, status, paused_state')
      .eq('id', runId)
      .single();

    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    if (run.player_id !== player.id) return NextResponse.json({ error: 'Not your run' }, { status: 403 });
    if (run.status !== 'paused') return NextResponse.json({ error: 'Run is not paused' }, { status: 409 });
    if (!run.paused_state) return NextResponse.json({ error: 'No saved state found' }, { status: 500 });

    const state = run.paused_state as RoguelikeRunState;

    // Rehydrate state back into Redis as active (at end of cleared floor)
    const resumedState: RoguelikeRunState = { ...state, status: 'active' };

    await Promise.all([
      redis.set(`roguelike:run:${runId}`, JSON.stringify(resumedState), { ex: ROGUELIKE_SESSION_TTL }),
      redis.set(`roguelike:active:${player.id}`, runId, { ex: ROGUELIKE_SESSION_TTL }),
      admin.from('roguelike_runs').update({ status: 'active', paused_state: null }).eq('id', runId),
    ]);

    return NextResponse.json({
      resumed: true,
      runId,
      operationName: state.operationName,
      currentFloor: state.currentFloor,
      totalFloors: state.totalFloors,
      lives: state.lives,
      maxLives: state.maxLives,
      intel: state.intel,
      score: state.score,
      perks: state.perks,
      streak: state.streak,
      bestStreak: state.bestStreak,
      deaths: state.deaths,
      activeUpgrades: state.activeUpgrades,
      freeInspections: state.freeInspections,
    });
  } catch (err) {
    console.error(`[roguelike/${runId}/resume] Unhandled error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
