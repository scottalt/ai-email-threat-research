import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

const VALID_REASONS = ['incorrect_classification', 'offensive_content', 'poor_quality', 'other'] as const;

export async function POST(req: NextRequest) {
  const { cardId, sessionId, reason, comment } = await req.json();
  if (!cardId || typeof cardId !== 'string') return NextResponse.json({ error: 'cardId required' }, { status: 400 });
  if (reason !== undefined && !(VALID_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  await supabase.from('card_flags').insert({
    card_id: cardId,
    session_id: sessionId ?? null,
    reason: reason ?? null,
    comment: comment?.slice(0, 500) ?? null,
  });

  return NextResponse.json({ ok: true });
}
