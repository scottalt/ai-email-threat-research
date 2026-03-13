import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import type { Card } from '@/lib/types';

const BASE_POINTS = 100;
const CONFIDENCE_MULTIPLIER: Record<string, number> = {
  guessing: 1,
  likely: 2,
  certain: 3,
};
const CONFIDENCE_PENALTY: Record<string, number> = {
  guessing: 0,
  likely: -100,
  certain: -200,
};
const STREAK_BONUS = 50;

export async function POST(req: NextRequest) {
  // Rate limit: 30 checks per IP per minute
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rlKey = `ratelimit:cards-check:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 30) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json();
  const { sessionId, cardId, userAnswer, confidence, streak } = body;

  if (!sessionId || !cardId || !userAnswer || !confidence) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!['phishing', 'legit'].includes(userAnswer)) {
    return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
  }

  if (!['guessing', 'likely', 'certain'].includes(confidence)) {
    return NextResponse.json({ error: 'Invalid confidence' }, { status: 400 });
  }

  // Retrieve dealt cards for this session from Redis
  const cardsJson = await redis.get<string>(`session-cards:${sessionId}`);
  if (!cardsJson) {
    return NextResponse.json({ error: 'Session expired or not found' }, { status: 404 });
  }

  const cards: Card[] = typeof cardsJson === 'string' ? JSON.parse(cardsJson) : cardsJson;
  const card = cards.find(c => c.id === cardId);
  if (!card) {
    return NextResponse.json({ error: 'Card not dealt in this session' }, { status: 403 });
  }

  // Prevent checking the same card twice in a session
  const checkedKey = `session-checked:${sessionId}:${cardId}`;
  const alreadyChecked = await redis.get(checkedKey);
  if (alreadyChecked) {
    return NextResponse.json({ error: 'Card already checked' }, { status: 409 });
  }
  await redis.set(checkedKey, '1', { ex: 60 * 60 });

  // Server-side answer verification
  const correct = (userAnswer === 'phishing') === card.isPhishing;
  const currentStreak = correct ? (streak ?? 0) + 1 : 0;
  const streakBonus = correct && currentStreak > 0 && currentStreak % 3 === 0 ? STREAK_BONUS : 0;
  const pointsEarned = correct
    ? BASE_POINTS * (CONFIDENCE_MULTIPLIER[confidence] ?? 1) + streakBonus
    : CONFIDENCE_PENALTY[confidence] ?? 0;

  return NextResponse.json({
    correct,
    isPhishing: card.isPhishing,
    pointsEarned,
    streak: currentStreak,
    clues: card.clues,
    explanation: card.explanation,
    highlights: card.highlights ?? [],
    technique: card.technique ?? null,
  });
}
