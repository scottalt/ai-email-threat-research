import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tier: string }> },
) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { tier } = await params;
    const seasonId = req.nextUrl.searchParams.get('season_id');
    if (!seasonId) {
      return NextResponse.json({ error: 'season_id query param required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_h2h_tiers')
      .select('*')
      .eq('tier', tier)
      .eq('season_id', seasonId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tier: string }> },
) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { tier } = await params;
    const seasonId = req.nextUrl.searchParams.get('season_id');
    if (!seasonId) {
      return NextResponse.json({ error: 'season_id query param required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const body = await req.json();
    const { label, icon, min_points, color, sort_order } = body;

    const { data, error } = await supabase
      .from('registry_h2h_tiers')
      .update({ label, icon, min_points, color, sort_order })
      .eq('tier', tier)
      .eq('season_id', seasonId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tier: string }> },
) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { tier } = await params;
    const seasonId = req.nextUrl.searchParams.get('season_id');
    if (!seasonId) {
      return NextResponse.json({ error: 'season_id query param required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('registry_h2h_tiers')
      .delete()
      .eq('tier', tier)
      .eq('season_id', seasonId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete tier' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
