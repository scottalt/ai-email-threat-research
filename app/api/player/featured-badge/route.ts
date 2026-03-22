import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// PATCH /api/player/featured-badge — set or clear the player's featured badge
export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json();
  const { badgeId } = body as { badgeId: string | null };

  if (badgeId !== null && (typeof badgeId !== 'string' || badgeId.trim() === '')) {
    return NextResponse.json({ error: 'Invalid badgeId' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Look up the player
  const { data: player, error: playerError } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', authId)
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const playerId = player.id as string;

  // If setting a badge, validate the player has earned it
  if (badgeId !== null) {
    const { data: achievement } = await admin
      .from('player_achievements')
      .select('achievement_id')
      .eq('player_id', playerId)
      .eq('achievement_id', badgeId)
      .maybeSingle();

    if (!achievement) {
      return NextResponse.json({ error: 'Badge not earned by this player' }, { status: 403 });
    }
  }

  // Update featured_badge
  const { error: updateError } = await admin
    .from('players')
    .update({ featured_badge: badgeId, updated_at: new Date().toISOString() })
    .eq('id', playerId);

  if (updateError) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
