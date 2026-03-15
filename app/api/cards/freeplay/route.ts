import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { toSafeCard } from '@/lib/card-utils';
import type { Card } from '@/lib/types';

const SESSION_TTL = 60 * 60; // 1 hour — plenty of time to finish a round
const ROUND_SIZE = 10;

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rlKey = `ratelimit:cards-freeplay:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 10) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId || !/^[0-9a-f-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }

  // Prevent re-dealing: if session already has cards, return the existing deck
  const existing = await redis.get<string>(`session-cards:${sessionId}`);
  if (existing) {
    const existingCards = typeof existing === 'string' ? JSON.parse(existing) : existing;
    return NextResponse.json(existingCards.map(toSafeCard));
  }

  // Fetch from DB — random selection of freeplay cards
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_generated')
    .select('*')
    .eq('pool', 'freeplay');

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No cards available' }, { status: 500 });
  }

  // Shuffle and pick ROUND_SIZE
  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [data[i], data[j]] = [data[j], data[i]];
  }
  const deck = data.slice(0, ROUND_SIZE);

  const cards: Card[] = deck.map((row) => ({
    id: row.card_id,
    type: row.type,
    isPhishing: row.is_phishing,
    difficulty: row.difficulty,
    from: row.from_address,
    subject: row.subject ?? undefined,
    body: row.body,
    clues: row.clues ?? [],
    explanation: row.explanation ?? '',
    highlights: row.highlights ?? [],
    technique: row.technique ?? null,
    authStatus: (row.auth_status ?? 'unverified') as 'verified' | 'unverified' | 'fail',
    replyTo: row.reply_to ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    sentAt: row.sent_at ?? undefined,
  }));

  // Store full card data server-side, keyed by session (NX = only if not exists)
  await redis.set(`session-cards:${sessionId}`, JSON.stringify(cards), { ex: SESSION_TTL, nx: true });
  await redis.set(`session-streak:${sessionId}`, 0, { ex: SESSION_TTL });

  // Return cards with answer data stripped
  return NextResponse.json(cards.map(toSafeCard));
}
