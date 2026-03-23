import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_xp_config')
      .select('*')
      .order('key');

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch XP config' }, { status: 500 });
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
    const body: { key: string; value_int?: number; value_json?: unknown; description?: string }[] =
      await req.json();

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: 'Body must be a non-empty array' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('registry_xp_config')
      .upsert(body, { onConflict: 'key' })
      .select();

    if (error) {
      return NextResponse.json({ error: 'Failed to upsert XP config' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
