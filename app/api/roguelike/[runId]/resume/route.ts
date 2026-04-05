import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  type RoguelikeRunState,
  ROGUELIKE_CARDS_PER_FLOOR,
  ROGUELIKE_SESSION_TTL,
} from '@/lib/roguelike';
import { selectFloorCards } from '@/lib/roguelike-cards';
import type { Card } from '@/lib/types';

// POST /api/roguelike/[runId]/resume — Resume a paused run
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

    // The run was paused at end of a floor, so we need to advance to the next floor
    const nextFloor = state.currentFloor + 1;

    // Check if run should actually be complete
    if (nextFloor >= state.totalFloors) {
      // Mark as active so finalize can handle it
      const resumedState: RoguelikeRunState = { ...state, status: 'active' };
      await redis.set(`roguelike:run:${runId}`, JSON.stringify(resumedState), { ex: ROGUELIKE_SESSION_TTL });
      await redis.set(`roguelike:active:${player.id}`, runId, { ex: ROGUELIKE_SESSION_TTL });
      await admin.from('roguelike_runs').update({ status: 'active', paused_state: null }).eq('id', runId);

      return NextResponse.json({
        resumed: true,
        runComplete: true,
        runId,
        operationName: state.operationName,
        score: state.score,
        floorsCleared: state.floorsCleared,
      });
    }

    // Fetch card pool
    let { data: dbRows } = await admin
      .from('cards_generated')
      .select('card_id, pool, type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status')
      .eq('pool', 'roguelike');

    if (!dbRows || dbRows.length === 0) {
      const { data: fallbackRows } = await admin
        .from('cards_generated')
        .select('card_id, pool, type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status')
        .in('pool', ['freeplay', 'expert']);
      dbRows = fallbackRows ?? [];
    }

    if (!dbRows || dbRows.length === 0) {
      return NextResponse.json({ error: 'No cards available' }, { status: 500 });
    }

    const cards: Card[] = dbRows.map((r) => ({
      id: r.card_id,
      type: r.type,
      isPhishing: r.is_phishing,
      difficulty: r.difficulty,
      from: r.from_address,
      subject: r.subject,
      body: r.body,
      clues: r.clues ?? [],
      explanation: r.explanation ?? '',
      highlights: r.highlights ?? [],
      technique: r.technique,
      authStatus: r.auth_status ?? 'verified',
    }));

    // Select cards for the next floor
    const nextFloorAssignments = selectFloorCards(cards, nextFloor, state.cardHistory, ROGUELIKE_CARDS_PER_FLOOR);
    const nextFloorCardIds = nextFloorAssignments.map((a) => a.cardId);
    const nextFloorCards = nextFloorCardIds
      .map((id) => cards.find((c) => c.id === id))
      .filter((c): c is Card => c !== undefined);

    const nextGimmick = state.floorGimmicks[nextFloor] ?? null;

    // Build resumed state at start of next floor
    const resumedState: RoguelikeRunState = {
      ...state,
      status: 'active',
      currentFloor: nextFloor,
      currentFloorCardIds: nextFloorCardIds,
      currentCardIndex: 0,
      currentGimmick: nextGimmick,
    };

    // Store in Redis and update DB
    await Promise.all([
      redis.set(`roguelike:run:${runId}`, JSON.stringify(resumedState), { ex: ROGUELIKE_SESSION_TTL }),
      redis.set(`roguelike:active:${player.id}`, runId, { ex: ROGUELIKE_SESSION_TTL }),
      redis.set(`roguelike:cards:${runId}:${nextFloor}`, JSON.stringify(nextFloorCards), { ex: ROGUELIKE_SESSION_TTL }),
      redis.set(`roguelike:assignments:${runId}:${nextFloor}`, JSON.stringify(nextFloorAssignments), { ex: ROGUELIKE_SESSION_TTL }),
      admin.from('roguelike_runs').update({ status: 'active', paused_state: null }).eq('id', runId),
    ]);

    const safeCards = nextFloorCards.map((c) => ({
      id: c.id,
      type: c.type,
      difficulty: c.difficulty,
      from: c.from,
      subject: c.subject,
      body: c.body,
    }));

    return NextResponse.json({
      resumed: true,
      runComplete: false,
      runId,
      operationName: state.operationName,
      currentFloor: nextFloor,
      totalFloors: state.totalFloors,
      lives: state.lives,
      maxLives: state.maxLives,
      intel: state.intel,
      score: state.score,
      gimmick: nextGimmick,
      cards: safeCards,
      assignments: nextFloorAssignments,
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
