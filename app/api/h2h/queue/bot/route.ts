import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { CURRENT_SEASON, H2H_CARDS_PER_MATCH, H2H_MATCH_TTL } from '@/lib/h2h';

// POST /api/h2h/queue/bot — Create a bot match directly (called by client after queue timeout)

async function getAuthPlayerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data: player } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  return player?.id ?? null;
}

export async function POST() {
  const playerId = await getAuthPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Prevent creating multiple bot matches
  const lockKey = `h2h:bot-lock:${playerId}`;
  const acquired = await redis.set(lockKey, '1', { ex: 30, nx: true });
  if (!acquired) {
    return NextResponse.json({ error: 'Bot match already in progress' }, { status: 409 });
  }

  const admin = getSupabaseAdminClient();

  // Check no active match already
  const { data: activeMatch } = await admin
    .from('h2h_matches')
    .select('id')
    .eq('status', 'active')
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .limit(1)
    .maybeSingle();

  if (activeMatch) {
    await redis.del(lockKey);
    return NextResponse.json({ error: 'Already in an active match' }, { status: 409 });
  }

  // Create bot match
  const { data: match, error } = await admin
    .from('h2h_matches')
    .insert({
      season: CURRENT_SEASON,
      player1_id: playerId,
      player2_id: null,
      card_ids: [],
      status: 'active',
      is_ghost_match: true,
      is_rated: false,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !match) {
    await redis.del(lockKey);
    console.error('[h2h:bot] Failed to create bot match:', error?.message);
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }

  // Deal cards
  const { data: cardData } = await admin
    .from('cards_generated')
    .select('*')
    .in('pool', ['freeplay', 'expert'])
    .limit(500);

  if (!cardData || cardData.length < H2H_CARDS_PER_MATCH) {
    await redis.del(lockKey);
    return NextResponse.json({ error: 'Not enough cards' }, { status: 500 });
  }

  const arr = [...cardData];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const deck = arr.slice(0, H2H_CARDS_PER_MATCH);

  const cards = deck.map((row) => ({
    id: row.card_id,
    type: row.type,
    isPhishing: row.is_phishing,
    difficulty: row.difficulty ?? 'medium',
    from: row.from_address,
    subject: row.subject ?? undefined,
    body: row.body,
    clues: row.clues ?? [],
    explanation: row.explanation ?? '',
    highlights: row.highlights ?? [],
    technique: row.technique,
    authStatus: (row.auth_status ?? 'unverified') as 'verified' | 'unverified' | 'fail',
    attachmentName: row.attachment_name ?? undefined,
  }));

  await redis.set(`match-cards:${match.id}`, JSON.stringify(cards), { ex: H2H_MATCH_TTL });
  await redis.set(`match-render:${match.id}:${playerId}:0`, Date.now(), { ex: H2H_MATCH_TTL });
  await admin.from('h2h_matches').update({ card_ids: cards.map((c) => c.id) }).eq('id', match.id);

  return NextResponse.json({ matchId: match.id });
}
