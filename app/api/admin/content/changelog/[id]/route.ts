import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_changelog')
      .select('*')
      .eq('id', numId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const { date, category, title, body: bodyText, highlight, sort_order } = body;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_changelog')
      .update({ date, category, title, body: bodyText, highlight, sort_order })
      .eq('id', numId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('registry_changelog')
      .delete()
      .eq('id', numId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
