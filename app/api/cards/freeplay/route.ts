import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redis, getClientIp } from '@/lib/redis';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { toSafeCard } from '@/lib/card-utils';
import type { Card } from '@/lib/types';

const SESSION_TTL = 60 * 60; // 1 hour — plenty of time to finish a round
const ROUND_SIZE = 10;
const FREEPLAY_UNLOCK_ANSWERS = 30;

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rlKey = `ratelimit:cards-freeplay:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 10) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Server-side gate: freeplay requires 30 research answers
  try {
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const admin = getSupabaseAdminClient();
    const { data: player } = await admin.from('players').select('id').eq('auth_id', user.id).single();
    if (player) {
      const { count } = await admin.from('answers').select('id', { count: 'exact', head: true })
        .eq('player_id', player.id).eq('game_mode', 'research');
      if ((count ?? 0) < FREEPLAY_UNLOCK_ANSWERS) {
        return NextResponse.json({ error: 'Complete 30 research answers to unlock freeplay' }, { status: 403 });
      }
    }
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId || !/^[0-9a-f-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }

  // Prevent re-dealing: if session already has cards, return the existing deck
  const existing = await redis.get<string>(`session-cards:${sessionId}`);
  if (existing) {
    const existingCards = typeof existing === 'string' ? JSON.parse(existing) : existing;
    return NextResponse.json(existingCards.map(toSafeCard));
  }

  // Fetch from DB — random selection from both freeplay and expert pools
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_generated')
    .select('*')
    .in('pool', ['freeplay', 'expert']);

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No cards available' }, { status: 500 });
  }

  // Shuffle and pick ROUND_SIZE
  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [data[i], data[j]] = [data[j], data[i]];
  }
  const deck = data.slice(0, ROUND_SIZE);

  const cards: Card[] = deck.map((row) => ({
    id: row.card_id,
    type: row.type,
    isPhishing: row.is_phishing,
    difficulty: row.difficulty,
    from: row.from_address,
    subject: row.subject ?? undefined,
    body: row.body,
    clues: row.clues ?? [],
    explanation: row.explanation ?? '',
    highlights: row.highlights ?? [],
    technique: row.technique ?? null,
    authStatus: (row.auth_status ?? 'unverified') as 'verified' | 'unverified' | 'fail',
    replyTo: row.reply_to ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    sentAt: row.sent_at ?? undefined,
  }));

  // Store full card data server-side, keyed by session (NX = only if not exists)
  await redis.set(`session-cards:${sessionId}`, JSON.stringify(cards), { ex: SESSION_TTL, nx: true });
  await redis.set(`session-streak:${sessionId}`, 0, { ex: SESSION_TTL });

  // Return cards with answer data stripped
  return NextResponse.json(cards.map(toSafeCard));
}
