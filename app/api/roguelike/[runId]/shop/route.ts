import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { type RoguelikeRunState, ROGUELIKE_SESSION_TTL, PERK_DEFS } from '@/lib/roguelike';
import { getShopOfferings, applyPerkPurchase, getSynergyForPerk } from '@/lib/roguelike-perks';
import type { PerkId } from '@/lib/roguelike';

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

// GET /api/roguelike/[runId]/shop — Get shop offerings
export async function GET(
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

    // ── Get shop offerings (BLACK_MARKET upgrade: 4 slots instead of 3) ──
    const shopSlots = state.shopSlots ?? 3;
    const offeringIds = getShopOfferings(state, shopSlots);
    const offerings = offeringIds.map((id) => {
      const def = PERK_DEFS.find((d) => d.id === id);
      if (!def) return null;
      const cost = (state.perkDiscount && state.perkDiscount < 1)
        ? Math.max(0, Math.floor(def.cost * state.perkDiscount))
        : def.cost;
      const synergy = getSynergyForPerk(state, id);
      return { ...def, cost, synergy };
    }).filter(Boolean);

    // Only reveal next gimmick if player has SIGNAL_INTERCEPT upgrade
    const hasSignalIntercept = (state.activeUpgrades ?? []).includes('SIGNAL_INTERCEPT');
    const nextGimmick = hasSignalIntercept
      ? state.floorGimmicks[state.currentFloor + 1] ?? null
      : null;
    const nextSecondaryGimmick = hasSignalIntercept
      ? state.floorSecondaryGimmicks?.[state.currentFloor + 1] ?? null
      : null;

    return NextResponse.json({
      offerings,
      intel: state.intel,
      lives: state.lives,
      perks: state.perks,
      nextGimmick,
      nextSecondaryGimmick,
    });
  } catch (err) {
    console.error(`[roguelike/${runId}/shop] Unhandled error in GET:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/roguelike/[runId]/shop — Purchase a perk
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

    const playerId = await getPlayerId(user.id);
    if (!playerId) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    // ── Parse body ──
    const body = await req.json().catch(() => null);
    if (!body?.perkId) return NextResponse.json({ error: 'Missing perkId' }, { status: 400 });
    const { perkId } = body as { perkId: PerkId };

    // ── Load state ──
    const state = await loadState(runId);
    if (!state) return NextResponse.json({ error: 'Run expired. Sessions last 1 hour.' }, { status: 404 });
    if (state.playerId !== playerId) return NextResponse.json({ error: 'Not your run' }, { status: 403 });
    if (state.status !== 'active') return NextResponse.json({ error: 'Run is not active' }, { status: 409 });

    // ── Re-derive offerings to validate purchase (prevents bypassing shop RNG) ──
    const validOfferings = getShopOfferings(state, state.shopSlots ?? 3);
    if (!validOfferings.includes(perkId)) {
      return NextResponse.json({ error: 'Perk not available in current shop' }, { status: 400 });
    }

    // ── Apply purchase (throws if insufficient intel or unknown perk) ──
    // INSIDER_TRADING upgrade: 10% discount on perk prices
    let priceOverride: number | undefined;
    if (state.perkDiscount && state.perkDiscount < 1) {
      const def = PERK_DEFS.find((d) => d.id === perkId);
      if (def) priceOverride = Math.max(0, Math.floor(def.cost * state.perkDiscount));
    }

    let updatedState: RoguelikeRunState;
    try {
      updatedState = applyPerkPurchase(state, perkId, priceOverride);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // ── Save updated state ──
    await redis.set(`roguelike:run:${runId}`, JSON.stringify(updatedState), {
      ex: ROGUELIKE_SESSION_TTL,
    });

    return NextResponse.json({
      intel: updatedState.intel,
      lives: updatedState.lives,
      perks: updatedState.perks,
    });
  } catch (err) {
    console.error(`[roguelike/${runId}/shop] Unhandled error in POST:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
