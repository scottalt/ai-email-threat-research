import { NextRequest, NextResponse } from 'next/server';
import { redis, getClientIp } from '@/lib/redis';
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
  const ip = getClientIp(req);
  const rlKey = `ratelimit:cards-check:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 30) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json();
  const { sessionId, userAnswer, confidence } = body;
  // Accept cardIndex (new) or cardId (legacy) — prefer cardIndex
  const cardIndex = typeof body.cardIndex === 'number' ? body.cardIndex : null;
  const cardId = typeof body.cardId === 'string' ? body.cardId : null;

  if (!sessionId || (cardIndex === null && !cardId) || !userAnswer || !confidence) {
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
  // Resolve card by index (new) or by id (legacy)
  const card = cardIndex !== null
    ? (cardIndex >= 0 && cardIndex < cards.length ? cards[cardIndex] : undefined)
    : cards.find(c => c.id === cardId);
  if (!card) {
    return NextResponse.json({ error: 'Card not dealt in this session' }, { status: 403 });
  }

  // Prevent checking the same card twice in a session
  const resolvedId = card.id;
  const checkedKey = `session-checked:${sessionId}:${resolvedId}`;
  const alreadyChecked = await redis.get(checkedKey);
  if (alreadyChecked) {
    return NextResponse.json({ error: 'Card already checked' }, { status: 409 });
  }
  await redis.set(checkedKey, '1', { ex: 60 * 60 });

  // Server-side answer verification with server-tracked streak
  const streakKey = `session-streak:${sessionId}`;
  const storedStreak = (await redis.get<number>(streakKey)) ?? 0;

  const correct = (userAnswer === 'phishing') === card.isPhishing;
  const currentStreak = correct ? storedStreak + 1 : 0;
  const streakBonus = correct && currentStreak > 0 && currentStreak % 3 === 0 ? STREAK_BONUS : 0;
  const pointsEarned = correct
    ? BASE_POINTS * (CONFIDENCE_MULTIPLIER[confidence] ?? 1) + streakBonus
    : CONFIDENCE_PENALTY[confidence] ?? 0;

  // Persist streak server-side
  await redis.set(streakKey, currentStreak, { ex: 60 * 60 });

  // Compute server-side response time from render timestamp
  const resolvedIndex = cardIndex ?? cards.findIndex(c => c.id === cardId);
  const renderKey = `session-render:${sessionId}:${resolvedIndex}`;
  const renderTimestamp = await redis.get<number>(renderKey);
  const verifiedTimeMs = renderTimestamp ? Date.now() - renderTimestamp : null;

  // Set render timestamp for the NEXT card
  if (resolvedIndex >= 0 && resolvedIndex + 1 < cards.length) {
    await redis.set(`session-render:${sessionId}:${resolvedIndex + 1}`, Date.now(), { ex: 60 * 60 });
  }

  // Include research metadata if present (for research card answer logging)
  const researchFields = card as unknown as Record<string, unknown>;

  return NextResponse.json({
    correct,
    isPhishing: card.isPhishing,
    pointsEarned,
    streak: currentStreak,
    cardId: card.id,             // real ID — safe post-answer, needed for answer logging
    difficulty: card.difficulty,  // safe post-answer, used in feedback display
    clues: card.clues,
    explanation: card.explanation,
    highlights: card.highlights ?? [],
    technique: card.technique ?? null,
    verifiedTimeMs: verifiedTimeMs ?? null, // server-side response time (null for legacy sessions)
    authStatus: card.authStatus ?? 'unverified',  // safe post-answer — for feedback forensic signals
    // Research card metadata — only present for research mode cards
    ...(researchFields.cardSource ? {
      cardSource: researchFields.cardSource,
      secondaryTechnique: researchFields.secondaryTechnique ?? null,
      isGenaiSuspected: researchFields.isGenaiSuspected ?? null,
      genaiConfidence: researchFields.genaiConfidence ?? null,
      grammarQuality: researchFields.grammarQuality ?? null,
      proseFluency: researchFields.proseFluency ?? null,
      personalizationLevel: researchFields.personalizationLevel ?? null,
      contextualCoherence: researchFields.contextualCoherence ?? null,
      datasetVersion: researchFields.datasetVersion ?? null,
    } : {}),
  });
}
