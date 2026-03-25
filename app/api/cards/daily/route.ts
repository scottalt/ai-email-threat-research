import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redis, getClientIp } from '@/lib/redis';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { toSafeCard } from '@/lib/card-utils';
import type { Card } from '@/lib/types';

const SESSION_TTL = 60 * 60; // 1 hour
const ROUND_SIZE = 10;
const DAILY_UNLOCK_ANSWERS = 20;

/** Deterministic PRNG — same seed = same shuffle for the day */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr: string): number {
  return dateStr.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 0);
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rlKey = `ratelimit:cards-daily:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 10) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Server-side gate: daily requires 20 research answers
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
      if ((count ?? 0) < DAILY_UNLOCK_ANSWERS) {
        return NextResponse.json({ error: 'Complete 20 research answers to unlock daily challenge' }, { status: 403 });
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

  // Fetch all freeplay cards (daily draws from the same pool)
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_generated')
    .select('*')
    .eq('pool', 'freeplay')
    .order('card_id'); // stable order for deterministic seed shuffle

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No cards available' }, { status: 500 });
  }

  // Seeded shuffle — same date = same deck for all players
  const d = new Date();
  const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const rand = mulberry32(dateToSeed(today));
  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
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

  return NextResponse.json(cards.map(toSafeCard));
}
