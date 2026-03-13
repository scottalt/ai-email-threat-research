import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getShuffledDeck } from '@/data/cards';
import { stripCardAnswers } from '@/lib/card-utils';

const SESSION_TTL = 60 * 60; // 1 hour — plenty of time to finish a round

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rlKey = `ratelimit:cards-freeplay:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 10) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const cards = getShuffledDeck(10);

  // Store full card data server-side, keyed by session
  await redis.set(`session-cards:${sessionId}`, JSON.stringify(cards), { ex: SESSION_TTL });

  // Return cards with answer data stripped
  return NextResponse.json(cards.map(stripCardAnswers));
}
