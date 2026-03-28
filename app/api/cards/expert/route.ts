import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis, getClientIp } from '@/lib/redis';
import { toSafeCard } from '@/lib/card-utils';
import type { Card } from '@/lib/types';

const SESSION_TTL = 60 * 60; // 1 hour
const ROUND_SIZE = 10;

async function getGraduatedAuthId(): Promise<{ authId: string | null; graduated: boolean }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authId: null, graduated: false };

  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('players')
    .select('research_graduated')
    .eq('auth_id', user.id)
    .single();

  return { authId: user.id, graduated: Boolean(data?.research_graduated) };
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rlKey = `ratelimit:cards-expert:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 10) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { authId, graduated } = await getGraduatedAuthId();

  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!graduated) return NextResponse.json({ error: 'Expert mode not unlocked' }, { status: 403 });

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

  // Fetch from DB — expert pool
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_generated')
    .select('*')
    .eq('pool', 'expert');

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

  return NextResponse.json(cards.map(toSafeCard));
}
