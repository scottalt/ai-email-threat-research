import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { getExpertDeck } from '@/data/expert-cards';
import { toSafeCard } from '@/lib/card-utils';

const SESSION_TTL = 60 * 60; // 1 hour

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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
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

  const cards = getExpertDeck(10);

  // Store full card data server-side, keyed by session (NX = only if not exists)
  await redis.set(`session-cards:${sessionId}`, JSON.stringify(cards), { ex: SESSION_TTL, nx: true });
  await redis.set(`session-streak:${sessionId}`, 0, { ex: SESSION_TTL });

  return NextResponse.json(cards.map(toSafeCard));
}
