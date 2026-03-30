import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { canPurchaseUpgrade, UPGRADE_DEFS } from '@/lib/roguelike-upgrades';
import type { UpgradeId } from '@/lib/roguelike-upgrades';

async function getPlayerData(userId: string): Promise<{ id: string; clearance: number } | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('players')
    .select('id, roguelike_clearance')
    .eq('auth_id', userId)
    .single();
  if (!data) return null;
  return { id: data.id, clearance: data.roguelike_clearance ?? 0 };
}

async function getOwnedUpgrades(playerId: string): Promise<UpgradeId[]> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('roguelike_upgrades')
    .select('upgrade_id')
    .eq('player_id', playerId);
  return (data ?? []).map((r) => r.upgrade_id as UpgradeId);
}

// GET /api/roguelike/upgrades — Return player's owned upgrades + Clearance balance
export async function GET() {
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

    const player = await getPlayerData(user.id);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const upgrades = await getOwnedUpgrades(player.id);

    return NextResponse.json({ upgrades, clearance: player.clearance });
  } catch (err) {
    console.error('[roguelike/upgrades] Unhandled error in GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/roguelike/upgrades — Purchase an upgrade
export async function POST(req: NextRequest) {
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

    // Parse body
    const body = await req.json().catch(() => null);
    if (!body?.upgradeId) return NextResponse.json({ error: 'Missing upgradeId' }, { status: 400 });

    const upgradeId = body.upgradeId as string;

    // Validate upgrade exists
    const def = UPGRADE_DEFS.find(u => u.id === upgradeId);
    if (!def) return NextResponse.json({ error: 'Unknown upgrade' }, { status: 400 });

    const admin = getSupabaseAdminClient();

    // Get player data
    const player = await getPlayerData(user.id);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    // Get owned upgrades
    const ownedUpgrades = await getOwnedUpgrades(player.id);

    // Validate purchase
    const check = canPurchaseUpgrade(upgradeId as UpgradeId, ownedUpgrades, player.clearance);
    if (!check.canBuy) {
      return NextResponse.json({ error: check.reason ?? 'Cannot purchase' }, { status: 400 });
    }

    // Deduct Clearance atomically via RPC (same pattern as run finalization)
    const { error: deductErr } = await admin.rpc('increment_roguelike_clearance', {
      player_id: player.id,
      amount: -def.cost,
    });

    if (deductErr) {
      // Fallback: read-then-write
      console.warn('[roguelike/upgrades] RPC deduct failed, falling back:', deductErr);
      const { data: pData } = await admin
        .from('players')
        .select('roguelike_clearance')
        .eq('id', player.id)
        .single();

      if (!pData || (pData.roguelike_clearance ?? 0) < def.cost) {
        return NextResponse.json({ error: 'Insufficient Clearance' }, { status: 400 });
      }

      const newBalance = (pData.roguelike_clearance ?? 0) - def.cost;
      if (newBalance < 0) {
        // Balance went negative between the canPurchase check and now (race condition)
        return NextResponse.json({ error: 'Insufficient Clearance' }, { status: 400 });
      }

      const { error: fbErr } = await admin
        .from('players')
        .update({ roguelike_clearance: newBalance })
        .eq('id', player.id);

      if (fbErr) {
        console.error('[roguelike/upgrades] Clearance deduct fallback failed:', fbErr);
        return NextResponse.json({ error: 'Failed to deduct Clearance' }, { status: 500 });
      }
    }

    // Insert upgrade record
    const { error: insertErr } = await admin
      .from('roguelike_upgrades')
      .insert({ player_id: player.id, upgrade_id: upgradeId });

    if (insertErr) {
      // Refund Clearance on insert failure
      console.error('[roguelike/upgrades] Insert failed, refunding:', insertErr);
      const { error: refundErr } = await admin.rpc('increment_roguelike_clearance', {
        player_id: player.id,
        amount: def.cost,
      });
      if (refundErr) console.error('[roguelike/upgrades] Refund also failed:', refundErr);
      return NextResponse.json({ error: 'Failed to record upgrade' }, { status: 500 });
    }

    // Fetch updated state
    const newUpgrades = await getOwnedUpgrades(player.id);
    const { data: updatedPlayer } = await admin
      .from('players')
      .select('roguelike_clearance')
      .eq('id', player.id)
      .single();

    return NextResponse.json({
      ok: true,
      clearance: updatedPlayer?.roguelike_clearance ?? 0,
      upgrades: newUpgrades,
    });
  } catch (err) {
    console.error('[roguelike/upgrades] Unhandled error in POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
