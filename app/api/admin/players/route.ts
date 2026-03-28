import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/players?q=...&sort=created_at&order=desc&limit=50&offset=0
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') === 'asc';
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

  const validSorts = ['xp', 'level', 'created_at', 'total_sessions', 'display_name'];
  const sortCol = validSorts.includes(sort) ? sort : 'created_at';

  const admin = getSupabaseAdminClient();
  let query = admin
    .from('players')
    .select('id, auth_id, display_name, xp, level, total_sessions, research_graduated, background, created_at, bio', { count: 'exact' });

  if (q) {
    if (UUID_RE.test(q)) {
      query = query.or(`id.eq.${q},auth_id.eq.${q}`);
    } else {
      query = query.ilike('display_name', `%${q}%`);
    }
  }

  const { data, count, error } = await query
    .order(sortCol, { ascending: order })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ players: data ?? [], total: count ?? 0 });
}
