import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET — list all approved cards
export async function GET() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_real')
    .select('id, card_id, is_phishing, technique, difficulty, from_address, subject, body, explanation, highlights, clues, review_notes, ai_model, approved_at, auth_status')
    .order('approved_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cards: data ?? [] });
}

// PATCH — edit an approved card
export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const { id, fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('cards_real').update(fields).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove an approved card
export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('cards_real').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
