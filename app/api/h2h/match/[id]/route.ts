import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

// ── GET /api/h2h/match/[id] — Return match state for initial load / reconnection ──

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid match id' }, { status: 400 });
  }

  // Authenticate the request
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  // Resolve player ID from auth
  const { data: player } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Fetch match record
  const { data: match, error: matchErr } = await admin
    .from('h2h_matches')
    .select('*')
    .eq('id', id)
    .single();

  if (matchErr || !match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  // Verify requester is a participant in this match
  if (player.id !== match.player1_id && player.id !== match.player2_id) {
    return NextResponse.json({ error: 'Not a participant in this match' }, { status: 403 });
  }

  // Fetch answers for this match, ordered by card_index
  const { data: answers } = await admin
    .from('h2h_match_answers')
    .select('*')
    .eq('match_id', id)
    .order('card_index', { ascending: true });

  // Fetch display names for both players
  const playerIds = [match.player1_id, match.player2_id].filter(Boolean);
  const { data: players } = await admin
    .from('players')
    .select('id, display_name')
    .in('id', playerIds);

  const playerMap: Record<string, string> = {};
  for (const p of players ?? []) {
    playerMap[p.id] = p.display_name;
  }

  // For completed matches, include full card data for review (safe to reveal post-match)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reviewCards: any[] | undefined;
  if (match.status === 'complete' && match.card_ids?.length > 0) {
    const { data: cards } = await admin
      .from('cards_generated')
      .select('card_id, type, from_address, subject, body, is_phishing, difficulty, technique, clues, explanation, highlights, attachment_name')
      .in('card_id', match.card_ids);

    if (cards) {
      // Sort by match card order
      const cardMap = new Map(cards.map((c) => [c.card_id, c]));
      reviewCards = match.card_ids.map((id: string, i: number) => {
        const c = cardMap.get(id);
        if (!c) return null;
        return {
          index: i,
          cardId: c.card_id,
          type: c.type,
          from: c.from_address,
          subject: c.subject,
          body: c.body,
          isPhishing: c.is_phishing,
          difficulty: c.difficulty,
          technique: c.technique,
          clues: c.clues ?? [],
          explanation: c.explanation ?? '',
          highlights: c.highlights ?? [],
          attachmentName: c.attachment_name,
        };
      }).filter(Boolean);
    }
  }

  return NextResponse.json({
    match: {
      id: match.id,
      season: match.season,
      player1Id: match.player1_id,
      player2Id: match.player2_id,
      cardIds: match.card_ids,
      status: match.status,
      winnerId: match.winner_id,
      isGhostMatch: match.is_ghost_match,
      isRated: match.is_rated,
      startedAt: match.started_at,
      endedAt: match.ended_at,
      player1CardsCompleted: match.player1_cards_completed ?? 0,
      player2CardsCompleted: match.player2_cards_completed ?? 0,
      player1TimeMs: match.player1_time_ms ?? 0,
      player2TimeMs: match.player2_time_ms ?? 0,
      player1PointsDelta: match.player1_points_delta ?? null,
      player2PointsDelta: match.player2_points_delta ?? null,
    },
    answers: (answers ?? []).map((a) => ({
      playerId: a.player_id,
      cardIndex: a.card_index,
      userAnswer: a.user_answer,
      correct: a.correct,
      timeFromRenderMs: a.time_from_render_ms,
    })),
    players: playerMap,
    reviewCards,
  });
}
