import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  type RoguelikeRunState,
  ROGUELIKE_FLOORS,
  ROGUELIKE_CARDS_PER_FLOOR,
  ROGUELIKE_DEFAULT_LIVES,
  ROGUELIKE_MAX_LIVES,
  ROGUELIKE_SESSION_TTL,
} from '@/lib/roguelike';
import { generateOperationName } from '@/lib/roguelike-operations';
import { assignGimmicks } from '@/lib/roguelike-gimmicks';
import { selectFloorCards } from '@/lib/roguelike-cards';
import { hasUpgrade } from '@/lib/roguelike-upgrades';
import type { UpgradeId } from '@/lib/roguelike-upgrades';
import type { Card } from '@/lib/types';

// POST /api/roguelike/start — Begin a new roguelike run
export async function POST() {
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

    // ── Look up player (must be research_graduated) ──
    const [{ data: player, error: playerError }, { data: globalSettings }] = await Promise.all([
      admin.from('players').select('id, research_graduated, feature_flags').eq('auth_id', user.id).single(),
      admin.from('app_settings').select('value').eq('key', 'feature_flags').maybeSingle(),
    ]);

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    if (!player.research_graduated) {
      return NextResponse.json({ error: 'Must complete research graduation to play Roguelike mode' }, { status: 403 });
    }

    // Feature flag gate (override mode: global true OR per-player true)
    const globalFlags = (globalSettings?.value as Record<string, boolean>) ?? {};
    const playerFlags = (player.feature_flags as Record<string, boolean>) ?? {};
    if (globalFlags.deadlock !== true && playerFlags.deadlock !== true) {
      return NextResponse.json({ error: 'DEADLOCK mode is not yet available' }, { status: 403 });
    }

    const playerId: string = player.id;

    // ── Check for paused run — return it so client can offer resume/abandon ──
    const { data: pausedRun } = await admin
      .from('roguelike_runs')
      .select('id, operation_name, score, floor_reached, floors_cleared, lives_remaining, deaths')
      .eq('player_id', playerId)
      .eq('status', 'paused')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pausedRun) {
      return NextResponse.json({
        pausedRun: {
          runId: pausedRun.id,
          operationName: pausedRun.operation_name,
          score: pausedRun.score,
          floorReached: pausedRun.floor_reached,
          floorsCleared: pausedRun.floors_cleared,
          livesRemaining: pausedRun.lives_remaining,
          deaths: pausedRun.deaths,
        },
      });
    }

    // ── Rate limit: max 30 run starts per player per hour ──
    const rlKey = `ratelimit:roguelike-start:${playerId}`;
    const startCount = await redis.incr(rlKey);
    if (startCount === 1) await redis.expire(rlKey, 3600);
    if (startCount > 30) {
      return NextResponse.json({ error: 'Too many runs. Try again later.' }, { status: 429 });
    }

    // ── Check for stale active run — auto-abandon if state is missing or expired ──
    const existingRunId = await redis.get<string>(`roguelike:active:${playerId}`);
    if (existingRunId) {
      const existingState = await redis.get<string>(`roguelike:run:${existingRunId}`);
      if (!existingState) {
        // State expired but active key lingered — clean up and proceed
        await redis.del(`roguelike:active:${playerId}`);
        // Mark the DB record as abandoned
        await admin.from('roguelike_runs').update({ status: 'abandoned', ended_at: new Date().toISOString() }).eq('id', existingRunId);
      } else {
        // Active run still has valid state — abandon it to allow a fresh start
        await redis.del(`roguelike:active:${playerId}`);
        await redis.del(`roguelike:run:${existingRunId}`);
        await admin.from('roguelike_runs').update({ status: 'abandoned', ended_at: new Date().toISOString() }).eq('id', existingRunId);
        console.warn(`[roguelike/start] Auto-abandoned stale run ${existingRunId} for player ${playerId}`);
      }
    }

    // ── Fetch player's permanent upgrades ──
    const { data: upgradeRows } = await admin
      .from('roguelike_upgrades')
      .select('upgrade_id')
      .eq('player_id', playerId);
    const ownedUpgrades: UpgradeId[] = (upgradeRows ?? []).map((r) => r.upgrade_id as UpgradeId);

    // ── Generate operation name + assign floor gimmicks ──
    const operationName = generateOperationName();
    const { primary: floorGimmicks, secondary: floorSecondaryGimmicks } = assignGimmicks(ROGUELIKE_FLOORS);

    // ── Fetch card pool from DB ──
    let { data: dbRows } = await admin
      .from('cards_generated')
      .select('card_id, pool, type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status')
      .eq('pool', 'roguelike');

    // Fallback to freeplay + expert if no roguelike-specific cards exist
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
      return NextResponse.json({ error: 'No cards available for roguelike mode' }, { status: 500 });
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

    // ── Select floor 0 cards ──
    const floor0Assignments = selectFloorCards(cards, 0, [], ROGUELIKE_CARDS_PER_FLOOR);
    const floor0CardIds = floor0Assignments.map((a) => a.cardId);
    const floor0Cards = floor0CardIds
      .map((id) => cards.find((c) => c.id === id))
      .filter((c): c is Card => c !== undefined);

    // ── Apply permanent upgrade effects ──
    let startLives = ROGUELIKE_DEFAULT_LIVES;
    let freeInspections = 0;
    let intelMultiplier = 1;
    let shopSlots = 3;
    let perkDiscount = 1;

    if (hasUpgrade(ownedUpgrades, 'THICK_SKIN')) startLives = 4;
    if (hasUpgrade(ownedUpgrades, 'ANALYST_EYE')) freeInspections = 1;
    if (hasUpgrade(ownedUpgrades, 'HAZARD_PAY')) intelMultiplier = 1.15;
    if (hasUpgrade(ownedUpgrades, 'BLACK_MARKET')) shopSlots = 4;
    if (hasUpgrade(ownedUpgrades, 'INSIDER_TRADING')) perkDiscount = 0.9;

    // ── Create roguelike_runs DB record ──
    const { data: runRecord, error: insertError } = await admin
      .from('roguelike_runs')
      .insert({
        player_id: playerId,
        operation_name: operationName,
        score: 0,
        floor_reached: 0,
        floors_cleared: 0,
        lives_remaining: startLives,
        lives_max: ROGUELIKE_MAX_LIVES,
        intel_earned: 0,
        intel_spent: 0,
        clearance_earned: 0,
        gimmick_assignments: floorGimmicks,
        perks_purchased: [],
        cards_answered: 0,
        cards_correct: 0,
        best_streak: 0,
        deaths: 0,
        status: 'active',
      })
      .select('id')
      .single();

    if (insertError || !runRecord) {
      console.error('[roguelike/start] DB insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
    }

    const runId: string = runRecord.id;
    const now = new Date().toISOString();

    // ── Build RoguelikeRunState ──
    const state: RoguelikeRunState = {
      runId,
      operationName,
      playerId,
      currentFloor: 0,
      totalFloors: ROGUELIKE_FLOORS,
      lives: startLives,
      maxLives: ROGUELIKE_MAX_LIVES,
      intel: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      deaths: 0,
      perks: [],
      floorsCleared: 0,
      cardHistory: [],
      cardsCorrect: 0,
      currentFloorCardIds: floor0CardIds,
      currentCardIndex: 0,
      currentGimmick: floorGimmicks[0] ?? null,
      floorGimmicks,
      floorSecondaryGimmicks,
      startedAt: now,
      completedAt: null,
      status: 'active',
      // Phase 2 upgrade state
      activeUpgrades: ownedUpgrades.length > 0 ? ownedUpgrades : undefined,
      freeInspections: freeInspections > 0 ? freeInspections : undefined,
      intelMultiplier: intelMultiplier !== 1 ? intelMultiplier : undefined,
      shopSlots: shopSlots !== 3 ? shopSlots : undefined,
      perkDiscount: perkDiscount !== 1 ? perkDiscount : undefined,
    };

    // ── Store state, cards, and assignments in Redis (Fix 12: handle errors) ──
    try {
      await Promise.all([
        redis.set(`roguelike:run:${runId}`, JSON.stringify(state), { ex: ROGUELIKE_SESSION_TTL }),
        redis.set(`roguelike:active:${playerId}`, runId, { ex: ROGUELIKE_SESSION_TTL }),
        redis.set(`roguelike:cards:${runId}:0`, JSON.stringify(floor0Cards), { ex: ROGUELIKE_SESSION_TTL }),
        redis.set(`roguelike:assignments:${runId}:0`, JSON.stringify(floor0Assignments), { ex: ROGUELIKE_SESSION_TTL }),
      ]);
    } catch (err) {
      console.error(`[roguelike/start] Redis write failed for run ${runId}:`, err);
      await admin.from('roguelike_runs').delete().eq('id', runId);
      return NextResponse.json({ error: 'Failed to initialize run' }, { status: 500 });
    }

    // ── Return safe card data (no answers) + run info ──
    const safeCards = floor0Cards.map((c) => ({
      id: c.id,
      type: c.type,
      difficulty: c.difficulty,
      from: c.from,
      subject: c.subject,
      body: c.body,
    }));

    return NextResponse.json({
      runId,
      operationName,
      currentFloor: 0,
      totalFloors: ROGUELIKE_FLOORS,
      lives: startLives,
      maxLives: ROGUELIKE_MAX_LIVES,
      intel: 0,
      score: 0,
      gimmick: floorGimmicks[0] ?? null,
      secondaryGimmick: floorSecondaryGimmicks[0] ?? null,
      activeUpgrades: ownedUpgrades.length > 0 ? ownedUpgrades : undefined,
      freeInspections: freeInspections > 0 ? freeInspections : undefined,
      cards: safeCards,
      assignments: floor0Assignments,
    });
  } catch (err) {
    console.error('[roguelike/start] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
