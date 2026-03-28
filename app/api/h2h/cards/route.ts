import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { toSafeCard } from '@/lib/card-utils';
import type { Card } from '@/lib/types';

// ── GET /api/h2h/cards?matchId=xxx — Get safe (stripped) cards for a match ──

export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get('matchId');

  if (!matchId || !/^[0-9a-f-]{36}$/.test(matchId)) {
    return NextResponse.json({ error: 'Invalid matchId' }, { status: 400 });
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

  // Verify requester is a participant in this match
  const { data: match } = await admin
    .from('h2h_matches')
    .select('player1_id, player2_id')
    .eq('id', matchId)
    .single();

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (player.id !== match.player1_id && player.id !== match.player2_id) {
    return NextResponse.json({ error: 'Not a participant in this match' }, { status: 403 });
  }

  const redisKey = `match-cards:${matchId}`;
  const stored = await redis.get<string>(redisKey);

  if (!stored) {
    return NextResponse.json({ error: 'Match cards not found' }, { status: 404 });
  }

  const cards: Card[] = typeof stored === 'string' ? JSON.parse(stored) : stored;

  return NextResponse.json(cards.map(toSafeCard));
}
