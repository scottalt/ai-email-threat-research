import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { THEMES } from '@/lib/themes';

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
    .select('id, display_name, featured_badge, featured_badges, theme_id')
    .in('id', playerIds);

  const playerMap: Record<string, { displayName: string; featuredBadge: string | null; themeColor: string }> = {};
  for (const p of players ?? []) {
    // PvP badge: first item in featured_badges array, falling back to legacy featured_badge column
    const badges = p.featured_badges as string[] | null;
    const pvpBadge = badges?.[0] ?? p.featured_badge ?? null;
    playerMap[p.id] = {
      displayName: p.display_name,
      featuredBadge: pvpBadge,
      themeColor: THEMES.find(t => t.id === (p.theme_id ?? 'phosphor'))?.colors.primary ?? '#00ff41',
    };
  }

  // For completed matches, include full card data for review (safe to reveal post-match)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reviewCards: any[] | undefined;
  if (match.status === 'complete') {
    // Get card IDs — prefer match record, fall back to answers table
    let cardIds: string[] = match.card_ids ?? [];
    if (cardIds.length === 0) {
      const { data: answerCards } = await admin
        .from('h2h_match_answers')
        .select('card_id, card_index')
        .eq('match_id', id)
        .order('card_index', { ascending: true });
      if (answerCards) {
        const seen = new Set<string>();
        cardIds = answerCards
          .filter((a) => { if (seen.has(a.card_id)) return false; seen.add(a.card_id); return true; })
          .map((a) => a.card_id);
      }
    }

    const { data: cards } = cardIds.length > 0
      ? await admin
          .from('cards_generated')
          .select('card_id, type, from_address, subject, body, is_phishing, difficulty, technique, clues, explanation, highlights, attachment_name')
          .in('card_id', cardIds)
      : { data: null };

    if (cards) {
      const cardMap = new Map(cards.map((c) => [c.card_id, c]));
      reviewCards = cardIds.map((cid: string, i: number) => {
        const c = cardMap.get(cid);
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
      isBotMatch: match.is_ghost_match,
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

// ── PATCH /api/h2h/match/[id] — Mark a bot match as complete ──

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: player } = await admin.from('players').select('id').eq('auth_id', user.id).single();
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.action || !['complete', 'cancel'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (body.action === 'cancel') {
    // Cancel match without rank changes — used for ready timeout, decline
    const { data: updated } = await admin
      .from('h2h_matches')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'active')
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
      .select('id');

    if (updated && updated.length > 0) {
      await redis.del(`h2h:bot-lock:${player.id}`);
    }
    return NextResponse.json({ ok: true });
  }

  // Complete action — for bot matches marking as done
  const { data: updated } = await admin
    .from('h2h_matches')
    .update({
      status: 'complete',
      winner_id: body.winnerId ?? player.id,
      ended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'active')
    .eq('is_ghost_match', true)
    .eq('player1_id', player.id)
    .select('id');

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Match not found or already complete' }, { status: 409 });
  }

  await redis.del(`h2h:bot-lock:${player.id}`);
  return NextResponse.json({ ok: true });
}
