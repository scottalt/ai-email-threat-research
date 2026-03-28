import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const seasonId = req.nextUrl.searchParams.get('season_id');
    if (!seasonId) {
      return NextResponse.json({ error: 'season_id query param required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_h2h_point_deltas')
      .select('*')
      .eq('season_id', seasonId)
      .order('is_winner', { ascending: false })
      .order('tier_diff');

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch point deltas' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();
    const body: { season_id: string; is_winner: boolean; tier_diff: number; delta: number }[] =
      await req.json();

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: 'Body must be a non-empty array' }, { status: 400 });
    }
    if (body.length > 100) {
      return NextResponse.json({ error: 'Max 100 elements per request' }, { status: 400 });
    }

    // Validate and strip each element to allowed fields only
    const sanitized = [];
    for (const el of body) {
      if (typeof el.season_id !== 'string' || typeof el.is_winner !== 'boolean' || typeof el.tier_diff !== 'number' || typeof el.delta !== 'number') {
        return NextResponse.json({ error: 'Invalid element shape: requires season_id (string), is_winner (boolean), tier_diff (number), delta (number)' }, { status: 400 });
      }
      sanitized.push({ season_id: el.season_id, is_winner: el.is_winner, tier_diff: el.tier_diff, delta: el.delta });
    }

    const { data, error } = await supabase
      .from('registry_h2h_point_deltas')
      .upsert(sanitized, { onConflict: 'season_id,is_winner,tier_diff' })
      .select();

    if (error) {
      return NextResponse.json({ error: 'Failed to upsert point deltas' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
