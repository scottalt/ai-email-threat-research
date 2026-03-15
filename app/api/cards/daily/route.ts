import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getDailyDeck } from '@/data/cards';
import { toSafeCard } from '@/lib/card-utils';

const SESSION_TTL = 60 * 60; // 1 hour

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rlKey = `ratelimit:cards-daily:${ip}`;
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

  const cards = getDailyDeck();

  // Store full card data server-side, keyed by session (NX = only if not exists)
  await redis.set(`session-cards:${sessionId}`, JSON.stringify(cards), { ex: SESSION_TTL, nx: true });
  await redis.set(`session-streak:${sessionId}`, 0, { ex: SESSION_TTL });

  return NextResponse.json(cards.map(toSafeCard));
}
