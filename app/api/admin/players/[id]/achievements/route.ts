import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

// POST /api/admin/players/[id]/achievements — grant achievement
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const { achievementId } = await req.json();
  if (!achievementId || typeof achievementId !== 'string') {
    return NextResponse.json({ error: 'achievementId required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Verify player exists
  const { data: player } = await admin.from('players').select('id').eq('id', id).single();
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  // Upsert — idempotent, won't error if already granted
  const { error } = await admin.from('player_achievements').upsert(
    { player_id: id, achievement_id: achievementId, unlocked_at: new Date().toISOString() },
    { onConflict: 'player_id,achievement_id' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ granted: true, achievementId });
}

// DELETE /api/admin/players/[id]/achievements — revoke achievement
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const { achievementId } = await req.json();
  if (!achievementId || typeof achievementId !== 'string') {
    return NextResponse.json({ error: 'achievementId required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { error } = await admin
    .from('player_achievements')
    .delete()
    .eq('player_id', id)
    .eq('achievement_id', achievementId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ revoked: true, achievementId });
}
