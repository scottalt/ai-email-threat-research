import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  H2H_CARDS_PER_MATCH,
  CURRENT_SEASON,
  getRankFromPoints,
  calculatePointsDelta,
} from '@/lib/h2h';
import { XP_PER_CORRECT, getLevelFromXp } from '@/lib/xp';
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

// ── Award XP to a player for an H2H match (server-side only) ──

const H2H_WIN_BONUS_XP = 20;
const H2H_COMPLETION_BONUS_XP = 25;
const H2H_PERFECT_BONUS_XP = 50;

async function awardH2HXp(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  playerId: string,
  correctCount: number,
  isWinner: boolean,
) {
  let xpEarned = correctCount * XP_PER_CORRECT;
  if (correctCount >= H2H_CARDS_PER_MATCH) {
    xpEarned += (correctCount === H2H_CARDS_PER_MATCH) ? H2H_PERFECT_BONUS_XP : H2H_COMPLETION_BONUS_XP;
  }
  if (isWinner) xpEarned += H2H_WIN_BONUS_XP;

  if (xpEarned <= 0) return;

  // Atomic read-modify-write with optimistic concurrency:
  // Read current XP, compute new values, update only if XP hasn't changed (retry once on conflict)
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: player } = await admin
      .from('players')
      .select('xp, level')
      .eq('id', playerId)
      .single();

    if (!player) return;

    const currentXp = player.xp as number;
    const newXp = currentXp + xpEarned;
    const newLevel = getLevelFromXp(newXp);

    const { data: updated } = await admin.from('players').update({
      xp: newXp,
      level: newLevel,
      updated_at: new Date().toISOString(),
    }).eq('id', playerId).eq('xp', currentXp).select('id');

    if (updated && updated.length > 0) return; // success
    // XP changed between read and write — retry
  }
}

// ── Finalize a completed match ──

async function finalizeMatch(
  matchId: string,
  winnerId: string,
  loserId: string,
) {
  const admin = getSupabaseAdminClient();

  // Get the match record
  const { data: match } = await admin
    .from('h2h_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!match) {
    console.error(`[finalizeMatch] Match not found: ${matchId}`);
    return;
  }

  if (match.is_rated && match.player1_id && match.player2_id) {
    // Fetch both players' stats for the current season
    const { data: winnerStats } = await admin
      .from('h2h_player_stats')
      .select('*')
      .eq('player_id', winnerId)
      .eq('season', CURRENT_SEASON)
      .single();

    const { data: loserStats } = await admin
      .from('h2h_player_stats')
      .select('*')
      .eq('player_id', loserId)
      .eq('season', CURRENT_SEASON)
      .single();

    const winnerPoints = winnerStats?.rank_points ?? 0;
    const loserPoints = loserStats?.rank_points ?? 0;
    const winnerRank = getRankFromPoints(winnerPoints);
    const loserRank = getRankFromPoints(loserPoints);

    const today = new Date().toISOString().slice(0, 10);

    // Winner daily rated count
    const winnerRatedToday =
      winnerStats?.last_match_date === today
        ? winnerStats.rated_matches_today ?? 0
        : 0;
    // Loser daily rated count
    const loserRatedToday =
      loserStats?.last_match_date === today
        ? loserStats.rated_matches_today ?? 0
        : 0;

    const winnerDelta = calculatePointsDelta(
      winnerRank.tier,
      loserRank.tier,
      true,
      winnerRatedToday,
    );
    const loserDelta = calculatePointsDelta(
      winnerRank.tier,
      loserRank.tier,
      false,
      loserRatedToday,
    );

    const newWinnerPoints = Math.max(0, winnerPoints + winnerDelta);
    const newLoserPoints = Math.max(0, loserPoints + loserDelta);

    // Atomically mark match complete — only if still active (prevents double-finalization)
    const { data: updated } = await admin
      .from('h2h_matches')
      .update({
        status: 'complete',
        winner_id: winnerId,
        player1_points_delta:
          winnerId === match.player1_id ? winnerDelta : loserDelta,
        player2_points_delta:
          winnerId === match.player2_id ? winnerDelta : loserDelta,
        ended_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('status', 'active')
      .select('id');

    if (!updated || updated.length === 0) {
      console.warn(`[finalizeMatch] Match ${matchId} already finalized by another thread`);
      return;
    }

    // Atomic stats update via Postgres RPC (prevents concurrent match race conditions)
    const [{ error: winnerRpcErr }, { error: loserRpcErr }] = await Promise.all([
      admin.rpc('update_h2h_stats', {
        p_player_id: winnerId,
        p_season: CURRENT_SEASON,
        p_points_delta: winnerDelta,
        p_is_winner: true,
        p_today: today,
      }),
      admin.rpc('update_h2h_stats', {
        p_player_id: loserId,
        p_season: CURRENT_SEASON,
        p_points_delta: loserDelta,
        p_is_winner: false,
        p_today: today,
      }),
    ]);
    if (winnerRpcErr) {
      console.error(`[finalizeMatch] Winner stats RPC failed for ${winnerId} in match ${matchId}:`, winnerRpcErr.message);
    }
    if (loserRpcErr) {
      console.error(`[finalizeMatch] Loser stats RPC failed for ${loserId} in match ${matchId}:`, loserRpcErr.message);
    }

    // Award XP to both players — count correct answers from DB (not stale match snapshot)
    // Same daily cap as rank points (20 rated matches/day) — prevents XP farming
    const [{ count: winnerCorrect }, { count: loserCorrect }] = await Promise.all([
      admin.from('h2h_match_answers').select('id', { count: 'exact', head: true })
        .eq('match_id', matchId).eq('player_id', winnerId).eq('correct', true),
      admin.from('h2h_match_answers').select('id', { count: 'exact', head: true })
        .eq('match_id', matchId).eq('player_id', loserId).eq('correct', true),
    ]);

    const xpAwards: Promise<void>[] = [];
    if (winnerRatedToday < 20) xpAwards.push(awardH2HXp(admin, winnerId, winnerCorrect ?? 0, true));
    if (loserRatedToday < 20) xpAwards.push(awardH2HXp(admin, loserId, loserCorrect ?? 0, false));
    await Promise.all(xpAwards);

    // Release bot lock if this was a ghost match
    if (match.is_ghost_match && match.player1_id) {
      await redis.del(`h2h:bot-lock:${match.player1_id}`);
    }

    // Award h2h_perfect achievement if winner got all cards correct
    if ((winnerCorrect ?? 0) >= H2H_CARDS_PER_MATCH) {
      await admin.from('player_achievements').upsert(
        { player_id: winnerId, achievement_id: 'h2h_perfect', unlocked_at: new Date().toISOString() },
        { onConflict: 'player_id,achievement_id' },
      );
    }
  } else {
    // Unrated / bot match — atomically mark complete only if still active
    const { data: updated } = await admin
      .from('h2h_matches')
      .update({
        status: 'complete',
        winner_id: winnerId,
        ended_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('status', 'active')
      .select('id');

    if (!updated || updated.length === 0) {
      console.warn(`[finalizeMatch] Unrated match ${matchId} already finalized by another thread`);
      return;
    }

    // Bot matches do not award XP — prevents bot farming exploits
    // Release bot lock so player can queue again immediately
    if (match.is_ghost_match && match.player1_id) {
      await redis.del(`h2h:bot-lock:${match.player1_id}`);
    }
  }
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
