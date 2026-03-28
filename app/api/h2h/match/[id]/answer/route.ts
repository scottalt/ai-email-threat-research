import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { H2H_CARDS_PER_MATCH } from '@/lib/h2h';
import { finalizeMatch } from '@/lib/h2h-server';
import type { Card } from '@/lib/types';

// ── Auth helper ──

async function getAuthenticatedPlayerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data: player } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  return player?.id ?? null;
}

// ── POST /api/h2h/match/[id]/answer — Submit an answer during a match ──

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matchId } = await params;

  // Auth
  const playerId = await getAuthenticatedPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Rate limit: max 30 answer submissions per player per 60 seconds
  // Use atomic INCR + EXPIRE together to prevent orphaned keys without TTL
  const answerRlKey = `ratelimit:h2h-answer:${playerId}`;
  const [answerRlCount] = await Promise.all([
    redis.incr(answerRlKey),
    redis.expire(answerRlKey, 60, 'NX'),
  ]);
  if (answerRlCount > 30) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Parse body
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { cardIndex, userAnswer, timeFromRenderMs } = body;

  // Handle forfeit — cancel the match, opponent wins
  if (userAnswer === 'forfeit') {
    const admin = getSupabaseAdminClient();
    const { data: match } = await admin.from('h2h_matches').select('*').eq('id', matchId).single();
    if (!match || match.status !== 'active') {
      return NextResponse.json({ error: 'Match not active' }, { status: 409 });
    }
    if (playerId !== match.player1_id && playerId !== match.player2_id) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }
    const opponentId = playerId === match.player1_id ? match.player2_id : match.player1_id;
    if (opponentId) {
      await finalizeMatch(matchId, opponentId, playerId);
    } else {
      // Bot match — cancel and release bot lock
      await admin.from('h2h_matches')
        .update({ status: 'cancelled', ended_at: new Date().toISOString() })
        .eq('id', matchId).eq('status', 'active');
      await redis.del(`h2h:bot-lock:${playerId}`);
    }
    return NextResponse.json({ ok: true, forfeited: true });
  }

  // Validate inputs
  if (
    typeof cardIndex !== 'number' ||
    cardIndex < 0 ||
    cardIndex >= H2H_CARDS_PER_MATCH
  ) {
    return NextResponse.json({ error: 'Invalid cardIndex' }, { status: 400 });
  }
  if (userAnswer !== 'phishing' && userAnswer !== 'legit') {
    return NextResponse.json({ error: 'Invalid userAnswer' }, { status: 400 });
  }
  if (typeof timeFromRenderMs !== 'number' || timeFromRenderMs < 0) {
    return NextResponse.json(
      { error: 'Invalid timeFromRenderMs' },
      { status: 400 },
    );
  }

  // ── Validate match state BEFORE any DB writes ──

  const admin = getSupabaseAdminClient();

  // Get match to determine player role and validate state
  const { data: match } = await admin
    .from('h2h_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (match.status !== 'active') {
    return NextResponse.json({ error: 'Match is no longer active' }, { status: 409 });
  }

  if (playerId !== match.player1_id && playerId !== match.player2_id) {
    return NextResponse.json({ error: 'Not a participant in this match' }, { status: 403 });
  }

  // Validate card index sequence — must answer in order
  const isPlayer1 = playerId === match.player1_id;
  const expectedIndex = (match[isPlayer1 ? 'player1_cards_completed' : 'player2_cards_completed'] ?? 0) as number;
  if (cardIndex !== expectedIndex) {
    return NextResponse.json({ error: `Expected card index ${expectedIndex}, got ${cardIndex}` }, { status: 400 });
  }

  // Prevent duplicate submission
  const checkedKey = `match-checked:${matchId}:${playerId}:${cardIndex}`;
  const alreadyChecked = await redis.get(checkedKey);
  if (alreadyChecked) {
    return NextResponse.json(
      { error: 'Already answered this card' },
      { status: 409 },
    );
  }

  // Get cards from Redis
  const redisKey = `match-cards:${matchId}`;
  const stored = await redis.get<string>(redisKey);
  if (!stored) {
    return NextResponse.json(
      { error: 'Match cards not found or expired' },
      { status: 404 },
    );
  }

  const cards: Card[] = typeof stored === 'string' ? JSON.parse(stored) : stored;
  const card = cards[cardIndex];
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  // ── All validation passed — now write to DB ──

  const correct = (userAnswer === 'phishing') === card.isPhishing;

  // Server-side timing — reject if render timestamp expired (match is stale)
  const renderKey = `match-render:${matchId}:${playerId}:${cardIndex}`;
  const renderTimestamp = await redis.get<number>(renderKey);
  const now = Date.now();
  if (!renderTimestamp) {
    return NextResponse.json({ error: 'Match expired — render timestamp missing' }, { status: 410 });
  }
  const verifiedTimeMs = now - renderTimestamp;

  // Anti-cheat: reject sub-human answer times
  const MIN_ANSWER_MS = 300;
  if (verifiedTimeMs < MIN_ANSWER_MS) {
    return NextResponse.json({ error: 'Answer submitted too fast' }, { status: 400 });
  }

  // Insert answer record — do this BEFORE marking as checked so retries are possible on insert failure
  const { error: insertError } = await admin.from('h2h_match_answers').insert({
    match_id: matchId,
    player_id: playerId,
    card_index: cardIndex,
    card_id: card.id,
    user_answer: userAnswer,
    correct,
    time_from_render_ms: verifiedTimeMs,
  });

  if (insertError) {
    console.error('[h2h/answer] insert failed:', insertError);
    return NextResponse.json({ error: 'Failed to record answer' }, { status: 500 });
  }

  // Mark as checked in Redis AFTER successful DB insert (30 min TTL)
  await redis.set(checkedKey, '1', { ex: 1800 });

  // Set render timestamp for the NEXT card
  if (correct && cardIndex + 1 < H2H_CARDS_PER_MATCH) {
    await redis.set(`match-render:${matchId}:${playerId}:${cardIndex + 1}`, now, { ex: 1800 });
  }

  const playerCardsField = isPlayer1
    ? 'player1_cards_completed'
    : 'player2_cards_completed';
  const playerTimeField = isPlayer1
    ? 'player1_time_ms'
    : 'player2_time_ms';
  const opponentCardsField = isPlayer1
    ? 'player2_cards_completed'
    : 'player1_cards_completed';

  const currentCards = (match[playerCardsField] ?? 0) as number;
  const currentTime = (match[playerTimeField] ?? 0) as number;
  const opponentCards = (match[opponentCardsField] ?? 0) as number;
  const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

  if (correct) {
    // Increment player's cards_completed and accumulate time
    const newCards = currentCards + 1;
    const newTime = currentTime + verifiedTimeMs;

    await admin
      .from('h2h_matches')
      .update({
        [playerCardsField]: newCards,
        [playerTimeField]: newTime,
      })
      .eq('id', matchId);

    if (newCards >= H2H_CARDS_PER_MATCH) {
      // Re-read match for fresh opponent data (avoids race where both finish simultaneously)
      const { data: freshMatch } = await admin
        .from('h2h_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      const freshOpponentCards = freshMatch
        ? (freshMatch[opponentCardsField] ?? 0) as number
        : opponentCards;

      // Player finished all cards — check if opponent also finished
      if (freshOpponentCards >= H2H_CARDS_PER_MATCH) {
        // Both finished — compare total times
        const opponentTimeField = isPlayer1
          ? 'player2_time_ms'
          : 'player1_time_ms';
        const opponentTime = freshMatch
          ? (freshMatch[opponentTimeField] ?? 0) as number
          : 0;
        const winnerId = newTime <= opponentTime ? playerId : opponentId;
        const loserId = winnerId === playerId ? opponentId : playerId;
        await finalizeMatch(matchId, winnerId, loserId!);

        return NextResponse.json({
          correct: true,
          eliminated: false,
          finished: true,
          cardIndex,
          totalTimeMs: newTime,
        });
      }

      // First player to finish all cards wins — finalize immediately
      if (opponentId) {
        await finalizeMatch(matchId, playerId, opponentId);
      }

      return NextResponse.json({
        correct: true,
        eliminated: false,
        finished: true,
        matchOver: true,
        winnerId: playerId,
        cardIndex,
        totalTimeMs: newTime,
      });
    }

    // Not finished yet
    return NextResponse.json({
      correct: true,
      eliminated: false,
      finished: false,
      cardIndex,
      totalTimeMs: newTime,
    });
  }

  // ── Wrong answer — check if opponent also got this card wrong ──

  if (!opponentId) {
    // Ghost match — just mark complete, no winner (atomic to prevent double-finalization)
    await admin.from('h2h_matches').update({
      status: 'complete',
      ended_at: new Date().toISOString(),
    }).eq('id', matchId).eq('status', 'active');

    // Release bot lock so player can queue again immediately
    await redis.del(`h2h:bot-lock:${playerId}`);

    return NextResponse.json({
      correct: false,
      eliminated: true,
      finished: false,
      cardIndex,
    });
  }

  // Check if opponent answered this same card incorrectly
  const { data: opponentWrongOnSameCard } = await admin
    .from('h2h_match_answers')
    .select('time_from_render_ms')
    .eq('match_id', matchId)
    .eq('player_id', opponentId)
    .eq('card_index', cardIndex)
    .eq('correct', false)
    .single();

  if (opponentWrongOnSameCard) {
    // Both got the same card wrong — compare speed
    // Faster answer = rushed and got it wrong = loses
    const myTime = verifiedTimeMs;
    const oppTime = opponentWrongOnSameCard.time_from_render_ms;
    const loserId = myTime <= oppTime ? playerId : opponentId;
    const winnerId = loserId === playerId ? opponentId : playerId;
    await finalizeMatch(matchId, winnerId, loserId);
  } else {
    // Wrong answer = you lose. Period.
    // Doesn't matter if opponent is on card 1 and you're on card 5.
    // Doesn't matter if opponent was already eliminated on an earlier card.
    // You made a mistake, you lose.
    await finalizeMatch(matchId, opponentId, playerId);
  }

  return NextResponse.json({
    correct: false,
    eliminated: true,
    finished: false,
    cardIndex,
  });
}
