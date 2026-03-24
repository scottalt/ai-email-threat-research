import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { CURRENT_SEASON, getRankFromPoints } from '@/lib/h2h';

// ── Auth helper (same pattern as other endpoints) ──

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

/** Resolve auth_id → player row (id only) */
async function getPlayer(admin: ReturnType<typeof getSupabaseAdminClient>, authId: string) {
  const { data } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', authId)
    .single();
  return data;
}

/** Build a friend summary object for a given player id */
async function friendSummary(admin: ReturnType<typeof getSupabaseAdminClient>, playerId: string) {
  const { data: p } = await admin
    .from('players')
    .select('id, display_name, level, xp')
    .eq('id', playerId)
    .single();

  if (!p) return null;

  const { data: stats } = await admin
    .from('h2h_player_stats')
    .select('rank_points')
    .eq('player_id', playerId)
    .eq('season', CURRENT_SEASON)
    .single();

  const rankPoints = stats?.rank_points ?? 0;
  const rank = getRankFromPoints(rankPoints);

  return {
    playerId: p.id,
    displayName: p.display_name,
    level: p.level,
    rankPoints,
    rankLabel: rank.label,
  };
}

// ── GET /api/friends — friend list + pending requests ──

export async function GET() {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const player = await getPlayer(admin, authId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  // Accepted friends (both directions)
  const { data: accepted } = await admin
    .from('player_friends')
    .select('id, player_id, friend_id')
    .or(`player_id.eq.${player.id},friend_id.eq.${player.id}`)
    .eq('status', 'accepted');

  // Pending incoming
  const { data: incoming } = await admin
    .from('player_friends')
    .select('id, player_id')
    .eq('friend_id', player.id)
    .eq('status', 'pending');

  // Pending outgoing
  const { data: outgoing } = await admin
    .from('player_friends')
    .select('id, friend_id')
    .eq('player_id', player.id)
    .eq('status', 'pending');

  // Resolve accepted friends
  const friendIds = (accepted ?? []).map(r =>
    r.player_id === player.id ? r.friend_id : r.player_id
  );
  const friends = (
    await Promise.all(friendIds.map(id => friendSummary(admin, id)))
  ).filter(Boolean);

  // Resolve incoming request senders
  const incomingList = await Promise.all(
    (incoming ?? []).map(async r => {
      const from = await friendSummary(admin, r.player_id);
      return from ? { requestId: r.id, from: { playerId: from.playerId, displayName: from.displayName } } : null;
    })
  );

  // Resolve outgoing request targets
  const outgoingList = await Promise.all(
    (outgoing ?? []).map(async r => {
      const to = await friendSummary(admin, r.friend_id);
      return to ? { requestId: r.id, to: { playerId: to.playerId, displayName: to.displayName } } : null;
    })
  );

  return NextResponse.json({
    friends,
    incoming: incomingList.filter(Boolean),
    outgoing: outgoingList.filter(Boolean),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ── POST /api/friends — send friend request ──

export async function POST(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const player = await getPlayer(admin, authId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const targetCallsign = body?.targetCallsign?.trim();
  if (!targetCallsign) {
    return NextResponse.json({ error: 'targetCallsign is required' }, { status: 400 });
  }

  // Look up target player by display_name (case-insensitive)
  const { data: targets } = await admin
    .from('players')
    .select('id, display_name')
    .ilike('display_name', targetCallsign)
    .order('xp', { ascending: false })
    .limit(1);

  const target = targets?.[0] ?? null;

  if (!target) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Can't friend yourself
  if (target.id === player.id) {
    return NextResponse.json({ error: 'Cannot send a friend request to yourself' }, { status: 400 });
  }

  // Check for existing relationship in either direction
  const { data: existing } = await admin
    .from('player_friends')
    .select('id, status')
    .or(
      `and(player_id.eq.${player.id},friend_id.eq.${target.id}),and(player_id.eq.${target.id},friend_id.eq.${player.id})`
    );

  if (existing && existing.length > 0) {
    const row = existing[0];
    if (row.status === 'accepted') {
      return NextResponse.json({ error: 'Already friends' }, { status: 409 });
    }
    if (row.status === 'pending') {
      return NextResponse.json({ error: 'Friend request already pending' }, { status: 409 });
    }
    if (row.status === 'blocked') {
      return NextResponse.json({ error: 'Cannot send request' }, { status: 403 });
    }
  }

  // Insert pending request
  const { data: inserted, error } = await admin
    .from('player_friends')
    .insert({ player_id: player.id, friend_id: target.id, status: 'pending' })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, requestId: inserted.id });
}

// ── PATCH /api/friends — accept or reject a friend request ──

export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const player = await getPlayer(admin, authId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const { requestId, action } = body ?? {};

  if (!requestId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'requestId and action (accept|reject) required' }, { status: 400 });
  }

  // Fetch the request — must be pending and addressed to the current player
  const { data: request } = await admin
    .from('player_friends')
    .select('id, player_id, friend_id, status')
    .eq('id', requestId)
    .single();

  if (!request || request.status !== 'pending') {
    return NextResponse.json({ error: 'Request not found or already handled' }, { status: 404 });
  }

  if (request.friend_id !== player.id) {
    return NextResponse.json({ error: 'Not your request to handle' }, { status: 403 });
  }

  if (action === 'accept') {
    // Update existing row to accepted
    const { error: updateErr } = await admin
      .from('player_friends')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 });
    }

    // Upsert reverse row so the relationship is bidirectional (upsert prevents race/duplicate errors)
    const { error: reverseErr } = await admin
      .from('player_friends')
      .upsert(
        { player_id: request.friend_id, friend_id: request.player_id, status: 'accepted' },
        { onConflict: 'player_id,friend_id' },
      );

    if (reverseErr) {
      // Rollback: revert the accept if reverse insert fails
      await admin.from('player_friends').update({ status: 'pending' }).eq('id', requestId);
      return NextResponse.json({ error: 'Failed to create reverse relationship' }, { status: 500 });
    }
  } else {
    // Reject — delete the row
    await admin
      .from('player_friends')
      .delete()
      .eq('id', requestId);
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/friends — remove friend or cancel request ──

export async function DELETE(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const player = await getPlayer(admin, authId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const friendId = body?.friendId;

  if (!friendId) {
    return NextResponse.json({ error: 'friendId is required' }, { status: 400 });
  }

  // Delete rows in both directions
  await admin
    .from('player_friends')
    .delete()
    .eq('player_id', player.id)
    .eq('friend_id', friendId);

  await admin
    .from('player_friends')
    .delete()
    .eq('player_id', friendId)
    .eq('friend_id', player.id);

  return NextResponse.json({ ok: true });
}
