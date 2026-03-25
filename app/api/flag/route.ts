import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis, getClientIp } from '@/lib/redis';

// These values must match the <option value="..."> in FeedbackCard.tsx
const VALID_REASONS = ['wrong_answer', 'too_obvious', 'poor_quality', 'other'] as const;

export async function POST(req: NextRequest) {
  // Rate limit: 20 flags per IP per minute
  const ip = getClientIp(req);
  const rlKey = `ratelimit:flag:${ip}`;
  const count = await redis.incr(rlKey);
  if (count === 1) await redis.expire(rlKey, 60);
  if (count > 20) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

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
