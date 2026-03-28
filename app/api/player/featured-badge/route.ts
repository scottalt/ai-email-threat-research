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
  const { badgeId, action } = body as { badgeId: string | null; action?: string };

  if (badgeId !== null && (typeof badgeId !== 'string' || badgeId.trim() === '')) {
    return NextResponse.json({ error: 'Invalid badgeId' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Look up the player
  const { data: player, error: playerError } = await admin
    .from('players')
    .select('id, featured_badges')
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

  // Promote mode: move badge to position [0] (becomes PvP badge)
  if (action === 'promote') {
    if (badgeId === null) {
      return NextResponse.json({ error: 'badgeId required for promote action' }, { status: 400 });
    }
    const currentShelf: string[] = (player.featured_badges as string[]) ?? [];
    if (!currentShelf.includes(badgeId)) {
      return NextResponse.json({ error: 'Badge not on shelf' }, { status: 400 });
    }
    // Move to front
    const newShelf = [badgeId, ...currentShelf.filter(id => id !== badgeId)];
    const { error: promoteError } = await admin
      .from('players')
      .update({ featured_badges: newShelf, updated_at: new Date().toISOString() })
      .eq('id', playerId);
    if (promoteError) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, featuredBadges: newShelf });
  }

  // Shelf mode: toggle badge in featured_badges[] array
  if (action === 'shelf') {
    if (badgeId === null) {
      return NextResponse.json({ error: 'badgeId required for shelf action' }, { status: 400 });
    }
    // Re-read shelf from DB to prevent race conditions (rapid clicks)
    const { data: freshPlayer } = await admin
      .from('players')
      .select('featured_badges')
      .eq('id', playerId)
      .single();
    const currentShelf: string[] = (freshPlayer?.featured_badges as string[]) ?? [];
    let newShelf: string[];
    if (currentShelf.includes(badgeId)) {
      // Remove from shelf
      newShelf = currentShelf.filter(id => id !== badgeId);
    } else {
      // Add to shelf (max 5)
      if (currentShelf.length >= 5) {
        return NextResponse.json({ error: 'Shelf is full (max 5)' }, { status: 400 });
      }
      newShelf = [...currentShelf, badgeId];
    }
    const { error: shelfError } = await admin
      .from('players')
      .update({ featured_badges: newShelf, updated_at: new Date().toISOString() })
      .eq('id', playerId);
    if (shelfError) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, featuredBadges: newShelf });
  }

  // Default: update single featured_badge (for PvP display)
  // Must be on shelf (or null to clear)
  if (badgeId !== null) {
    const currentShelf: string[] = (player.featured_badges as string[]) ?? [];
    if (!currentShelf.includes(badgeId)) {
      return NextResponse.json({ error: 'Badge must be on shelf before setting as featured' }, { status: 400 });
    }
  }
  const { error: updateError } = await admin
    .from('players')
    .update({ featured_badge: badgeId, updated_at: new Date().toISOString() })
    .eq('id', playerId);

  if (updateError) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
