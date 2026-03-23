import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { id } = await params;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_ranks')
      .select('*')
      .eq('id', Number(id))
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
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
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('registry_ranks')
      .update(body)
      .eq('id', Number(id))
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
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
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('registry_ranks')
      .delete()
      .eq('id', Number(id));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
