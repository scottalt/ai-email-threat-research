import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET /api/admin/players/[id]/sessions?limit=50&offset=0
// Sessions table has no player_id — query through answers grouped by session_id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

  const admin = getSupabaseAdminClient();

  // Get distinct session IDs for this player from answers
  const { data: sessionIds, error: sidErr } = await admin
    .from('answers')
    .select('session_id')
    .eq('player_id', id)
    .order('created_at', { ascending: false });

  if (sidErr) return NextResponse.json({ error: sidErr.message }, { status: 500 });

  // Deduplicate and paginate
  const uniqueIds = [...new Set((sessionIds ?? []).map((r: { session_id: string }) => r.session_id))];
  const total = uniqueIds.length;
  const pageIds = uniqueIds.slice(offset, offset + limit);

  if (pageIds.length === 0) {
    return NextResponse.json({ sessions: [], total });
  }

  // Fetch session details
  const { data: sessions, error: sessErr } = await admin
    .from('sessions')
    .select('session_id, game_mode, is_daily_challenge, started_at, completed_at, cards_answered, final_score, final_rank')
    .in('session_id', pageIds)
    .order('started_at', { ascending: false });

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

  return NextResponse.json({ sessions: sessions ?? [], total });
}
