import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// POST /api/promo/redeem — redeem a promo code
export async function POST(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!code || code.length > 50) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  // Rate limit: 5 attempts per minute per user
  const rlKey = `ratelimit:promo:${authId}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 5) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
  }

  const admin = getSupabaseAdminClient();

  // Look up player
  const { data: player } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', authId)
    .single();
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  // Look up promo code
  const { data: promo } = await admin
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .eq('active', true)
    .single();

  if (!promo) {
    return NextResponse.json({ error: 'INVALID_CODE', message: 'Code not recognized.' }, { status: 404 });
  }

  // Check expiration
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return NextResponse.json({ error: 'EXPIRED', message: 'This code has expired.' }, { status: 410 });
  }

  // Check uses remaining
  if (promo.current_uses >= promo.max_uses) {
    return NextResponse.json({ error: 'EXHAUSTED', message: 'All codes have been claimed.' }, { status: 410 });
  }

  // Check if player already redeemed this code
  const { data: existing } = await admin
    .from('promo_redemptions')
    .select('id')
    .eq('promo_code_id', promo.id)
    .eq('player_id', player.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'ALREADY_REDEEMED', message: 'You already redeemed this code.' }, { status: 409 });
  }

  // Atomically increment uses (check cap again to prevent race)
  const { data: updated } = await admin
    .from('promo_codes')
    .update({ current_uses: promo.current_uses + 1 })
    .eq('id', promo.id)
    .lt('current_uses', promo.max_uses)
    .select('id');

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'EXHAUSTED', message: 'All codes have been claimed.' }, { status: 410 });
  }

  // Record redemption
  await admin.from('promo_redemptions').insert({
    promo_code_id: promo.id,
    player_id: player.id,
  });

  // Award the badge
  await admin.from('player_achievements').upsert(
    { player_id: player.id, achievement_id: promo.badge_id, unlocked_at: new Date().toISOString() },
    { onConflict: 'player_id,achievement_id' },
  );

  return NextResponse.json({
    ok: true,
    badgeId: promo.badge_id,
    remaining: promo.max_uses - promo.current_uses - 1,
  });
}
