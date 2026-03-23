import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();
    const seasonId = req.nextUrl.searchParams.get('season_id');

    let query = supabase
      .from('registry_h2h_tiers')
      .select('*')
      .order('sort_order');

    if (seasonId) {
      query = query.eq('season_id', seasonId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tiers' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();
    const body = await req.json();

    const { tier, season_id, label, icon, min_points, color, sort_order } = body;
    if (!tier || !season_id || !label || !icon || min_points == null || !color) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('registry_h2h_tiers')
      .insert({ tier, season_id, label, icon, min_points, color, sort_order })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to insert tier' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
