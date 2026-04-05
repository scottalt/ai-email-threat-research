import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  type RoguelikeRunState,
  ROGUELIKE_CARDS_PER_FLOOR,
  ROGUELIKE_SESSION_TTL,
  INTEL_CORRECT,
  INTEL_SPEED_BONUS,
  INTEL_SPEED_THRESHOLD_MS,
  INTEL_STREAK_BONUS,
  INTEL_STREAK_MIN,
  INTEL_FLOOR_CLEAR,
  INTEL_WRONG,
  INTEL_WAGER_MULTIPLIER,
  calculateCardScore,
  calculateStreakIntel,
} from '@/lib/roguelike';
import { hasPerk, hasSynergy } from '@/lib/roguelike-perks';
import type { Card } from '@/lib/types';
import type { RoguelikeCardAssignment } from '@/lib/roguelike-cards';

// Fix 6: Allowed wager values
const VALID_WAGERS = new Set([5, 10, 20]);

// POST /api/roguelike/[runId]/answer — Submit an answer for the current card
export async function POST(
  req: NextRequest,
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

    const admin = getSupabaseAdminClient();
    const { data: player } = await admin
      .from('players')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    const playerId: string = player.id;

    // ── Parse body ──
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { cardIndex, userAnswer, timeFromRenderMs, wager } = body as {
      cardIndex: number;
      userAnswer: 'phishing' | 'legit';
      timeFromRenderMs: number;
      wager?: number;
    };

    if (typeof cardIndex !== 'number' || cardIndex < 0) {
      return NextResponse.json({ error: 'Invalid cardIndex' }, { status: 400 });
    }
    if (userAnswer !== 'phishing' && userAnswer !== 'legit') {
      return NextResponse.json({ error: 'Invalid userAnswer' }, { status: 400 });
    }
    if (typeof timeFromRenderMs !== 'number' || timeFromRenderMs < 0) {
      return NextResponse.json({ error: 'Invalid timeFromRenderMs' }, { status: 400 });
    }

    // ── Load run state from Redis ──
    const stored = await redis.get<string>(`roguelike:run:${runId}`);
    if (!stored) return NextResponse.json({ error: 'Run expired. Sessions last 1 hour.' }, { status: 404 });

    let state: RoguelikeRunState = typeof stored === 'string' ? JSON.parse(stored) : stored;

    // ── Verify ownership ──
    if (state.playerId !== playerId) {
      return NextResponse.json({ error: 'Not your run' }, { status: 403 });
    }

    // ── Verify status and card index ──
    if (state.status !== 'active') {
      return NextResponse.json({ error: 'Run is not active' }, { status: 409 });
    }
    if (cardIndex !== state.currentCardIndex) {
      return NextResponse.json(
        { error: `Expected card index ${state.currentCardIndex}, got ${cardIndex}` },
        { status: 400 },
      );
    }

    // ── Load full cards from Redis for current floor ──
    const cardsStored = await redis.get<string>(`roguelike:cards:${runId}:${state.currentFloor}`);
    if (!cardsStored) return NextResponse.json({ error: 'Floor cards not found' }, { status: 404 });
    const floorCards: Card[] = typeof cardsStored === 'string' ? JSON.parse(cardsStored) : cardsStored;

    // ── Load assignments for modifier count ──
    const assignStored = await redis.get<string>(`roguelike:assignments:${runId}:${state.currentFloor}`);
    const assignments: RoguelikeCardAssignment[] = assignStored
      ? (typeof assignStored === 'string' ? JSON.parse(assignStored) : assignStored)
      : [];

    // ── Find the current card ──
    const currentCardId = state.currentFloorCardIds[cardIndex];
    if (!currentCardId) return NextResponse.json({ error: 'Card ID not found' }, { status: 404 });

    const card = floorCards.find((c) => c.id === currentCardId);
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

    const assignment = assignments.find((a) => a.cardId === currentCardId);
    const modifierCount = assignment?.modifiers.length ?? 0;

    // ── Check correctness ──
    const correct = (userAnswer === 'phishing') === card.isPhishing;

    // ── Calculate card score ──
    const cardScore = calculateCardScore(
      correct,
      state.currentFloor,
      modifierCount,
      timeFromRenderMs,
      INTEL_SPEED_THRESHOLD_MS,
    );

    // ── Update streak ──
    let newStreak = correct ? state.streak + 1 : 0;
    let streakBroken = !correct && state.streak > 0;
    let synergyRefund = 0;

    // STREAK_SAVER perk: preserve streak on wrong answer (consumed after use)
    if (!correct && streakBroken && hasPerk(state, 'STREAK_SAVER')) {
      // FAILSAFE synergy check before consuming the perk
      if (hasSynergy(state, 'FAILSAFE')) synergyRefund += 4; // 25% of 18
      newStreak = state.streak;
      streakBroken = false;
      // Remove STREAK_SAVER from perks (one-time use)
      const saverIdx = state.perks.indexOf('STREAK_SAVER');
      state = { ...state, perks: state.perks.filter((_, i) => i !== saverIdx), usedDefensivePerk: true };
    }

    const newBestStreak = Math.max(state.bestStreak, newStreak);
    let streakMilestone: { type: 'intel' | 'life'; amount: number } | null = null;

    // ── Update lives and deaths ──
    let newLives = state.lives;
    let newDeaths = state.deaths;

    if (!correct) {
      // SHIELD perk: negate life loss (one-time use)
      if (hasPerk(state, 'SHIELD')) {
        // FAILSAFE synergy check before consuming the perk
        if (hasSynergy(state, 'FAILSAFE')) synergyRefund += 8; // 25% of 35
        const shieldIdx = state.perks.indexOf('SHIELD');
        state = { ...state, perks: state.perks.filter((_, i) => i !== shieldIdx), usedDefensivePerk: true };
      } else {
        newLives = state.lives - 1;
        newDeaths = state.deaths + 1;
      }
    }

    // ── Calculate intel earned ──
    let intelDelta = 0;
    if (correct) {
      let earned = INTEL_CORRECT;

      // Speed bonus
      if (timeFromRenderMs <= INTEL_SPEED_THRESHOLD_MS) {
        earned += INTEL_SPEED_BONUS;
      }

      // HAZARD_PAY upgrade: +15% Intel from correct answers
      if (state.intelMultiplier && state.intelMultiplier > 1) {
        earned = Math.round(earned * state.intelMultiplier);
      }

      // LAST_STAND upgrade: at 1 life, correct answers give +3 Intel bonus
      if (newLives === 1 && state.activeUpgrades?.includes('LAST_STAND')) {
        earned += 3;
      }

      // DOUBLE_INTEL perk: doubles this card's intel (one-time use)
      if (hasPerk(state, 'DOUBLE_INTEL')) {
        earned *= 2;
        const diIdx = state.perks.indexOf('DOUBLE_INTEL');
        state = { ...state, perks: state.perks.filter((_, i) => i !== diIdx) };
      }

      intelDelta += earned;

      // Streak bonus (MOMENTUM synergy: double streak intel if SLOW_TIME + STREAK_SAVER owned)
      let streakIntel = calculateStreakIntel(newStreak, INTEL_STREAK_MIN);
      if (streakIntel > 0 && hasSynergy(state, 'MOMENTUM')) {
        streakIntel *= 2;
      }
      intelDelta += streakIntel;
    } else {
      intelDelta = INTEL_WRONG;
    }

    // Streak milestones (only trigger on the exact streak count)
    if (correct && newStreak === 5) {
      intelDelta += 5;
      streakMilestone = { type: 'intel', amount: 5 };
    } else if (correct && newStreak === 10) {
      if (newLives < state.maxLives) {
        newLives += 1;
        streakMilestone = { type: 'life', amount: 1 };
      } else {
        intelDelta += 10;
        streakMilestone = { type: 'intel', amount: 10 };
      }
    }

    // ── Handle wager (Fix 6: validate against allowed values) ──
    let wagerDelta = 0;
    if (typeof wager === 'number' && wager > 0 && VALID_WAGERS.has(wager) && state.intel >= wager) {
      wagerDelta = correct ? wager * (INTEL_WAGER_MULTIPLIER - 1) : -wager;
    }

    // ── Update intel and score ──
    const newIntel = Math.max(0, state.intel + intelDelta + wagerDelta + synergyRefund);
    const newScore = state.score + cardScore;

    // ── Update card history and card index ──
    const newCardHistory = [...state.cardHistory, currentCardId];
    const newCardIndex = cardIndex + 1;
    const floorComplete = newCardIndex >= ROGUELIKE_CARDS_PER_FLOOR;

    // ── Determine new status ──
    let newStatus: RoguelikeRunState['status'] = state.status;
    let newFloorsCleared = state.floorsCleared;
    let newIntelFinal = newIntel;

    let finalLives = newLives;

    if (newLives <= 0) {
      newStatus = 'dead';
    } else if (floorComplete) {
      // Floor completed — award floor clear intel bonus
      const floorClearBonus = INTEL_FLOOR_CLEAR[Math.min(state.currentFloor, INTEL_FLOOR_CLEAR.length - 1)] ?? 10;
      newIntelFinal = newIntel + floorClearBonus;
      newFloorsCleared = state.floorsCleared + 1;

      // FIELD_MEDIC upgrade: heal 1 life on floor clear (if below max)
      if (state.activeUpgrades?.includes('FIELD_MEDIC') && finalLives < state.maxLives) {
        finalLives = finalLives + 1;
      }

      // Status stays 'active'; client will call shop/next-floor
    }

    // ── Build updated state ──
    const updatedState: RoguelikeRunState = {
      ...state,
      streak: newStreak,
      bestStreak: newBestStreak,
      deaths: newDeaths,
      lives: finalLives,
      intel: newIntelFinal,
      score: newScore,
      cardHistory: newCardHistory,
      cardsCorrect: (state.cardsCorrect ?? 0) + (correct ? 1 : 0),
      currentCardIndex: newCardIndex,
      floorsCleared: newFloorsCleared,
      status: newStatus,
      completedAt: state.completedAt, // Only PATCH finalize sets completedAt
    };

    // ── Save updated state to Redis ──
    await redis.set(`roguelike:run:${runId}`, JSON.stringify(updatedState), {
      ex: ROGUELIKE_SESSION_TTL,
    });

    // If run ended, remove active key
    if (newStatus !== 'active') {
      await redis.del(`roguelike:active:${playerId}`);
    }

    return NextResponse.json({
      correct,
      isPhishing: card.isPhishing,
      explanation: card.explanation,
      technique: card.technique ?? null,
      cardScore,
      lives: finalLives,
      intel: newIntelFinal,
      score: newScore,
      streak: newStreak,
      status: newStatus,
      floorCleared: floorComplete && newStatus === 'active',
      floorsCleared: newFloorsCleared,
      modifiers: assignment?.modifiers ?? [],
      streakMilestone,
    });
  } catch (err) {
    console.error(`[roguelike/${runId}/answer] Unhandled error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
