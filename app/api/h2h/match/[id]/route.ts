import { NextResponse } from 'next/server';
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

  const admin = getSupabaseAdminClient();

  // Fetch match record
  const { data: match, error: matchErr } = await admin
    .from('h2h_matches')
    .select('*')
    .eq('id', id)
    .single();

  if (matchErr || !match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
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
  });
}
