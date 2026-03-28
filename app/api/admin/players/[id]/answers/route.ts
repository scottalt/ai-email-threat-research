import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET /api/admin/players/[id]/answers?limit=100&offset=0&mode=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100));
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
  const mode = searchParams.get('mode');

  const admin = getSupabaseAdminClient();
  let query = admin
    .from('answers')
    .select('id, card_id, session_id, game_mode, user_answer, correct, confidence, technique, difficulty, time_from_render_ms, scroll_depth_pct, headers_opened, url_inspected, created_at', { count: 'exact' })
    .eq('player_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (mode) query = query.eq('game_mode', mode);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ answers: data ?? [], total: count ?? 0 });
}
