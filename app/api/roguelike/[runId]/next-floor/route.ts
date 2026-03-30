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

// POST /api/roguelike/[runId]/next-floor — Advance to the next floor
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  try {
    // ── Auth ──
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

    const playerId = await getPlayerId(user.id);
    if (!playerId) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    // ── Load state ──
    const state = await loadState(runId);
    if (!state) return NextResponse.json({ error: 'Run expired. Sessions last 1 hour.' }, { status: 404 });
    if (state.playerId !== playerId) return NextResponse.json({ error: 'Not your run' }, { status: 403 });
    if (state.status !== 'active') return NextResponse.json({ error: 'Run is not active' }, { status: 409 });

    // Fix 3: Guard that the current floor's cards are all answered
    if (state.currentCardIndex < ROGUELIKE_CARDS_PER_FLOOR) {
      return NextResponse.json({ error: 'Current floor not yet complete' }, { status: 409 });
    }

    const nextFloor = state.currentFloor + 1;

    // ── Check if run is complete ──
    if (nextFloor >= state.totalFloors) {
      const updatedState: RoguelikeRunState = {
        ...state,
        currentFloor: nextFloor,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
      await redis.set(`roguelike:run:${runId}`, JSON.stringify(updatedState), {
        ex: ROGUELIKE_SESSION_TTL,
      });
      await redis.del(`roguelike:active:${playerId}`);
      return NextResponse.json({
        runComplete: true,
        status: 'completed',
        score: updatedState.score,
        floorsCleared: updatedState.floorsCleared,
      });
    }

    // ── Fetch card pool from DB ──
    const admin = getSupabaseAdminClient();
    let { data: dbRows } = await admin
      .from('cards_generated')
      .select('card_id, pool, type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status')
      .eq('pool', 'roguelike');

    if (!dbRows || dbRows.length === 0) {
      // Fix 13: Log card pool fallback
      console.warn('[roguelike] Roguelike card pool empty, falling back to freeplay+expert');
      const { data: fallbackRows } = await admin
        .from('cards_generated')
        .select('card_id, pool, type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status')
        .in('pool', ['freeplay', 'expert']);
      dbRows = fallbackRows ?? [];
    }

    if (!dbRows || dbRows.length === 0) {
      return NextResponse.json({ error: 'No cards available' }, { status: 500 });
    }

    // ── Convert DB rows to Card objects ──
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

    // ── Select cards for the next floor (exclude all previously seen cards) ──
    const nextFloorAssignments = selectFloorCards(
      cards,
      nextFloor,
      state.cardHistory,
      ROGUELIKE_CARDS_PER_FLOOR,
    );
    const nextFloorCardIds = nextFloorAssignments.map((a) => a.cardId);
    const nextFloorCards = nextFloorCardIds
      .map((id) => cards.find((c) => c.id === id))
      .filter((c): c is Card => c !== undefined);

    const nextGimmick = state.floorGimmicks[nextFloor] ?? null;

    // ── Update state ──
    const updatedState: RoguelikeRunState = {
      ...state,
      currentFloor: nextFloor,
      currentFloorCardIds: nextFloorCardIds,
      currentCardIndex: 0,
      currentGimmick: nextGimmick,
    };

    // ── Store updated state and floor data in Redis ──
    await Promise.all([
      redis.set(`roguelike:run:${runId}`, JSON.stringify(updatedState), { ex: ROGUELIKE_SESSION_TTL }),
      redis.set(`roguelike:cards:${runId}:${nextFloor}`, JSON.stringify(nextFloorCards), { ex: ROGUELIKE_SESSION_TTL }),
      redis.set(`roguelike:assignments:${runId}:${nextFloor}`, JSON.stringify(nextFloorAssignments), { ex: ROGUELIKE_SESSION_TTL }),
    ]);

    // ── Return safe card data (no answers) ──
    const safeCards = nextFloorCards.map((c) => ({
      id: c.id,
      type: c.type,
      difficulty: c.difficulty,
      from: c.from,
      subject: c.subject,
      body: c.body,
      authStatus: c.authStatus,
    }));

    return NextResponse.json({
      runComplete: false,
      currentFloor: nextFloor,
      gimmick: nextGimmick,
      cards: safeCards,
      assignments: nextFloorAssignments,
      lives: updatedState.lives,
      intel: updatedState.intel,
      score: updatedState.score,
    });
  } catch (err) {
    console.error(`[roguelike/${runId}/next-floor] Unhandled error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
