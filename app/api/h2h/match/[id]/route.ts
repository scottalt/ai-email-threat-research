import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { THEMES } from '@/lib/themes';
import { checkMatchAfk, finalizeMatch } from '@/lib/h2h-server';

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
    .select('id, display_name, featured_badge, featured_badges, theme_id, is_bot, bot_config')
    .in('id', playerIds);

  const playerMap: Record<string, { displayName: string; featuredBadge: string | null; themeColor: string; nameEffect: string | null; isBot: boolean; botConfig: Record<string, number> | null }> = {};
  for (const p of players ?? []) {
    const badges = p.featured_badges as string[] | null;
    const pvpBadge = badges?.[0] ?? p.featured_badge ?? null;
    const theme = THEMES.find(t => t.id === (p.theme_id ?? 'phosphor'));
    playerMap[p.id] = {
      displayName: p.display_name,
      featuredBadge: pvpBadge,
      themeColor: theme?.colors.primary ?? '#00ff41',
      nameEffect: theme?.nameEffect ?? null,
      isBot: p.is_bot ?? false,
      botConfig: p.bot_config ?? null,
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

  // AFK check — for active, non-bot matches only
  let afkForfeited: string | null = null;
  const anyPlayerIsBot = Object.values(playerMap).some((p) => p.isBot);
  if (match.status === 'active' && !match.is_ghost_match && !anyPlayerIsBot && match.player1_id && match.player2_id) {
    const afk = await checkMatchAfk(
      match.id,
      match.player1_id,
      match.player2_id,
      match.player1_cards_completed ?? 0,
      match.player2_cards_completed ?? 0,
    );

    if (afk.player1Afk && afk.player2Afk) {
      // Both AFK — cancel match, no rank changes
      await admin.from('h2h_matches')
        .update({ status: 'cancelled', ended_at: new Date().toISOString() })
        .eq('id', match.id)
        .eq('status', 'active');
      match.status = 'cancelled';
      match.ended_at = new Date().toISOString();
      console.log(`[H2H AFK] Both players AFK — match ${match.id} cancelled`);
    } else if (afk.player1Afk) {
      // Player 1 AFK — player 2 wins
      await finalizeMatch(match.id, match.player2_id, match.player1_id);
      afkForfeited = match.player1_id;
      // Re-read match for updated status
      const { data: fresh } = await admin.from('h2h_matches').select('*').eq('id', match.id).single();
      if (fresh) Object.assign(match, fresh);
      console.log(`[H2H AFK] Player 1 AFK — match ${match.id} forfeited`);
    } else if (afk.player2Afk) {
      // Player 2 AFK — player 1 wins
      await finalizeMatch(match.id, match.player1_id, match.player2_id);
      afkForfeited = match.player2_id;
      const { data: fresh } = await admin.from('h2h_matches').select('*').eq('id', match.id).single();
      if (fresh) Object.assign(match, fresh);
      console.log(`[H2H AFK] Player 2 AFK — match ${match.id} forfeited`);
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
      isBotMatch: match.is_ghost_match || Object.values(playerMap).some((p) => p.isBot),
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
    afkForfeited,
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
  if (!body?.action || !['complete', 'cancel', 'bot-progress'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Write bot's simulated progress to match record (fire-and-forget from client)
  if (body.action === 'bot-progress') {
    const botCards = typeof body.botCards === 'number' ? body.botCards : null;
    if (botCards !== null) {
      const { data: m } = await admin.from('h2h_matches').select('player1_id').eq('id', id).single();
      if (m) {
        const isP1 = m.player1_id === player.id;
        await admin.from('h2h_matches').update({
          [isP1 ? 'player2_cards_completed' : 'player1_cards_completed']: botCards,
        }).eq('id', id);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'cancel') {
    // Look up the match to determine if it's a bot match or rated PvP
    const { data: cancelMatch } = await admin
      .from('h2h_matches')
      .select('id, player1_id, player2_id, is_ghost_match, is_rated, player1_cards_completed, player2_cards_completed')
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (!cancelMatch || (cancelMatch.player1_id !== player.id && cancelMatch.player2_id !== player.id)) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Bot matches and pre-game cancels (neither player has answered) — cancel without penalty
    const p1Cards = cancelMatch.player1_cards_completed ?? 0;
    const p2Cards = cancelMatch.player2_cards_completed ?? 0;
    const isPreGame = p1Cards === 0 && p2Cards === 0;

    if (!cancelMatch.is_rated || isPreGame) {
      // Unrated or pre-game — cancel without penalty
      await admin.from('h2h_matches')
        .update({ status: 'cancelled', ended_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'active');
      await redis.del(`h2h:bot-lock:${player.id}`);
      return NextResponse.json({ ok: true });
    }

    // Rated match in progress (bot or real) — treat cancel as forfeit
    const opponentId = cancelMatch.player1_id === player.id
      ? cancelMatch.player2_id
      : cancelMatch.player1_id;
    await finalizeMatch(id, opponentId ?? null, player.id);
    return NextResponse.json({ ok: true, forfeited: true });
  }

  // Complete action — for bot matches (ghost or persistent) marking as done
  // Fetch match to determine type and route through finalizeMatch for ranked resolution
  const { data: completeMatch } = await admin
    .from('h2h_matches')
    .select('*, players:player2_id(is_bot)')
    .eq('id', id)
    .eq('status', 'active')
    .single();

  if (!completeMatch || (completeMatch.player1_id !== player.id && completeMatch.player2_id !== player.id)) {
    return NextResponse.json({ error: 'Match not found or already complete' }, { status: 409 });
  }

  const isBotMatch = completeMatch.is_ghost_match || completeMatch.players?.is_bot;
  if (!isBotMatch) {
    return NextResponse.json({ error: 'Complete action only for bot matches' }, { status: 400 });
  }

  // Resolve winner/loser — winnerId from client is player.id (human won) or null (bot won)
  const humanWon = body.winnerId === player.id;
  const opponentId = completeMatch.player1_id === player.id
    ? completeMatch.player2_id
    : completeMatch.player1_id;
  const resolvedWinnerId = humanWon ? player.id : (opponentId ?? null);
  const resolvedLoserId = humanWon ? (opponentId ?? null) : player.id;

  // Write bot's simulated progress to match record (for result screen display)
  const botCards = typeof body.botCards === 'number' ? body.botCards : null;
  const botTimeMs = typeof body.botTimeMs === 'number' ? body.botTimeMs : null;
  if (botCards !== null || botTimeMs !== null) {
    const isPlayer1 = completeMatch.player1_id === player.id;
    await admin.from('h2h_matches').update({
      ...(botCards !== null && { [isPlayer1 ? 'player2_cards_completed' : 'player1_cards_completed']: botCards }),
      ...(botTimeMs !== null && { [isPlayer1 ? 'player2_time_ms' : 'player1_time_ms']: botTimeMs }),
    }).eq('id', id);
  }

  // Route through finalizeMatch for ranked resolution (persistent bots)
  // For ghost matches, finalizeMatch handles the ghost_match branch
  await finalizeMatch(id, resolvedWinnerId, resolvedLoserId);

  return NextResponse.json({ ok: true });
}
