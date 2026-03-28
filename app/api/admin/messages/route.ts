import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET /api/admin/messages — list all admin messages (recent first)
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10) || 50);
  const filter = searchParams.get('filter'); // 'global' | 'targeted' | 'archived' | null (all active)

  const admin = getSupabaseAdminClient();
  let query = admin
    .from('admin_messages')
    .select('*, players!target_player_id(display_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter === 'archived') {
    query = query.eq('archived', true);
  } else if (filter === 'global') {
    query = query.is('target_player_id', null).eq('archived', false);
  } else if (filter === 'targeted') {
    query = query.not('target_player_id', 'is', null).eq('archived', false);
  } else {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get seen counts for each message
  const messages = await Promise.all((data ?? []).map(async (msg) => {
    const { count } = await admin
      .from('admin_message_seen')
      .select('id', { count: 'exact', head: true })
      .eq('message_id', msg.id);
    const player = Array.isArray(msg.players) ? msg.players[0] : msg.players;
    return {
      id: msg.id,
      targetPlayerId: msg.target_player_id,
      targetName: player?.display_name ?? null,
      lines: msg.lines,
      buttonText: msg.button_text,
      createdAt: msg.created_at,
      expiresAt: msg.expires_at,
      seenCount: count ?? 0,
      isGlobal: !msg.target_player_id,
      archived: msg.archived ?? false,
    };
  }));

  return NextResponse.json({ messages });
}

// POST /api/admin/messages — create a new message (targeted or global)
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { targetPlayerId, lines, buttonText, expiresAt } = body;

  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: 'lines required (array of strings)' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Validate target player if specified
  if (targetPlayerId) {
    const { data: player } = await admin.from('players').select('id').eq('id', targetPlayerId).single();
    if (!player) return NextResponse.json({ error: 'Target player not found' }, { status: 404 });
  }

  const { data, error } = await admin.from('admin_messages').insert({
    target_player_id: targetPlayerId || null,
    lines: lines.map((l: unknown) => String(l)),
    button_text: buttonText || 'ACKNOWLEDGED',
    expires_at: expiresAt || null,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id, global: !targetPlayerId });
}

// PATCH /api/admin/messages — archive or unarchive a message
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id, archived } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('admin_messages')
    .update({ archived: archived !== false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, archived: archived !== false });
}

// DELETE /api/admin/messages — delete a message
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('admin_messages').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
