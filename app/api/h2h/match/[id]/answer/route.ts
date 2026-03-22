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

  if (!match) return;

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

    // Upsert winner stats
    await admin.from('h2h_player_stats').upsert(
      {
        player_id: winnerId,
        season: CURRENT_SEASON,
        rank_points: newWinnerPoints,
        wins: (winnerStats?.wins ?? 0) + 1,
        losses: winnerStats?.losses ?? 0,
        win_streak: (winnerStats?.win_streak ?? 0) + 1,
        best_win_streak: Math.max(
          winnerStats?.best_win_streak ?? 0,
          (winnerStats?.win_streak ?? 0) + 1,
        ),
        peak_rank_points: Math.max(
          winnerStats?.peak_rank_points ?? 0,
          newWinnerPoints,
        ),
        rated_matches_today: winnerRatedToday + 1,
        last_match_date: today,
      },
      { onConflict: 'player_id,season' },
    );

    // Upsert loser stats
    await admin.from('h2h_player_stats').upsert(
      {
        player_id: loserId,
        season: CURRENT_SEASON,
        rank_points: newLoserPoints,
        wins: loserStats?.wins ?? 0,
        losses: (loserStats?.losses ?? 0) + 1,
        win_streak: 0,
        best_win_streak: loserStats?.best_win_streak ?? 0,
        peak_rank_points: Math.max(
          loserStats?.peak_rank_points ?? 0,
          newLoserPoints,
        ),
        rated_matches_today: loserRatedToday + 1,
        last_match_date: today,
      },
      { onConflict: 'player_id,season' },
    );

    // Update match with winner, deltas, and completion
    await admin
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
      .eq('id', matchId);
  } else {
    // Unrated / ghost match — just mark complete
    await admin
      .from('h2h_matches')
      .update({
        status: 'complete',
        winner_id: winnerId,
        ended_at: new Date().toISOString(),
      })
      .eq('id', matchId);
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

  // Parse body
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { cardIndex, userAnswer, timeFromRenderMs } = body;

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

  // Verify answer
  const correct = (userAnswer === 'phishing') === card.isPhishing;

  // Mark as checked in Redis (30 min TTL)
  await redis.set(checkedKey, '1', { ex: 1800 });

  // Insert answer record
  const admin = getSupabaseAdminClient();
  await admin.from('h2h_match_answers').insert({
    match_id: matchId,
    player_id: playerId,
    card_index: cardIndex,
    user_answer: userAnswer,
    correct,
    time_from_render_ms: timeFromRenderMs,
  });

  // Get match to determine player role
  const { data: match } = await admin
    .from('h2h_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  const isPlayer1 = playerId === match.player1_id;
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
    const newTime = currentTime + timeFromRenderMs;

    await admin
      .from('h2h_matches')
      .update({
        [playerCardsField]: newCards,
        [playerTimeField]: newTime,
      })
      .eq('id', matchId);

    if (newCards >= H2H_CARDS_PER_MATCH) {
      // Player finished all cards — check if opponent also finished
      if (opponentCards >= H2H_CARDS_PER_MATCH) {
        // Both finished — compare total times
        const opponentTimeField = isPlayer1
          ? 'player2_time_ms'
          : 'player1_time_ms';
        const opponentTime = (match[opponentTimeField] ?? 0) as number;
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

      // Only this player finished — match stays active for opponent
      return NextResponse.json({
        correct: true,
        eliminated: false,
        finished: true,
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

  // ── Wrong answer — player is eliminated ──

  // Check opponent state
  // Count opponent's wrong answers to see if they are also eliminated
  const { count: opponentWrongCount } = await admin
    .from('h2h_match_answers')
    .select('*', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .eq('player_id', opponentId!)
    .eq('correct', false);

  const opponentEliminated = (opponentWrongCount ?? 0) > 0;
  const opponentFinished = opponentCards >= H2H_CARDS_PER_MATCH;

  if (opponentFinished) {
    // Opponent already finished — opponent wins
    await finalizeMatch(matchId, opponentId!, playerId);
  } else if (opponentEliminated) {
    // Both eliminated — winner is whoever got further (higher cards_completed)
    if (currentCards > opponentCards) {
      await finalizeMatch(matchId, playerId, opponentId!);
    } else if (opponentCards > currentCards) {
      await finalizeMatch(matchId, opponentId!, playerId);
    } else {
      // Same cards completed — compare total times (lower wins)
      const opponentTimeField = isPlayer1
        ? 'player2_time_ms'
        : 'player1_time_ms';
      const opponentTime = (match[opponentTimeField] ?? 0) as number;
      const totalTime = currentTime + timeFromRenderMs;
      const winnerId = totalTime <= opponentTime ? playerId : opponentId;
      const loserId = winnerId === playerId ? opponentId : playerId;
      await finalizeMatch(matchId, winnerId!, loserId!);
    }
  }
  // Otherwise: match stays active (opponent still playing)

  return NextResponse.json({
    correct: false,
    eliminated: true,
    finished: false,
    cardIndex,
  });
}
