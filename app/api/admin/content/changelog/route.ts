import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_changelog')
      .select('*')
      .order('sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const body = await req.json();
    const { date, category, title, body: entryBody, highlight, sort_order } = body;

    if (!date || !category || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_changelog')
      .insert({ date, category, title, body: entryBody, highlight, sort_order })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
