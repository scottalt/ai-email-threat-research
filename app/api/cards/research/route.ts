import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis, getClientIp } from '@/lib/redis';
import type { ResearchCard } from '@/lib/types';
import { toSafeCard } from '@/lib/card-utils';

const ROUND_SIZE = 10;
const CARDS_LIMIT = 1000;
const SESSION_TTL = 60 * 60; // 1 hour

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getPlayerId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = getSupabaseAdminClient();
    const { data } = await admin.from('players').select('id').eq('auth_id', user.id).single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 10 requests per IP per minute
    const ip = getClientIp(req);
    const rlKey = `ratelimit:cards-research:${ip}`;
    const rlCount = await redis.incr(rlKey);
    if (rlCount === 1) await redis.expire(rlKey, 60);
    if (rlCount > 10) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const sessionId = req.nextUrl.searchParams.get('sessionId');

    const supabase = getSupabaseAdminClient();

    // Require authentication — prevent unauthenticated card enumeration
    const playerId = await getPlayerId();
    if (!playerId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    // Fetch cards and player's previously answered card IDs in parallel
    const [{ data, error }, answeredCards] = await Promise.all([
      supabase.from('cards_real').select('*').limit(CARDS_LIMIT),
      supabase
        .from('answers')
        .select('card_id')
        .eq('player_id', playerId)
        .eq('game_mode', 'research')
        .then(({ data: rows }) => new Set((rows ?? []).map((r) => r.card_id))),
    ]);

    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json([]);

    // Exclude cards this player already answered in research mode
    const eligible = data.filter((row) => !answeredCards.has(row.card_id));
    const pool = eligible.length >= ROUND_SIZE ? eligible : data;
    const deck = shuffle(pool).slice(0, ROUND_SIZE);

    // Prevent re-dealing: if session already has cards, return the existing deck
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {
      const existing = await redis.get<string>(`session-cards:${sessionId}`);
      if (existing) {
        const existingCards = typeof existing === 'string' ? JSON.parse(existing) : existing;
        return NextResponse.json(existingCards.map(toSafeCard));
      }
    }

    // Record dealt cards server-side for answer validation
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {
      const dealtCardIds = deck.map((row) => row.card_id);
      const { error: dealErr } = await supabase.from('sessions').upsert({
        session_id: sessionId,
        game_mode: 'research',
        dealt_card_ids: dealtCardIds,
        player_id: playerId ?? undefined,
      }, { onConflict: 'session_id' });
      if (dealErr) console.error('Failed to record dealt cards:', dealErr);
    }

    const cards: ResearchCard[] = deck.map((row) => ({
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
      authStatus: (row.auth_status ?? 'unverified') as 'verified' | 'unverified' | 'fail',
      replyTo: row.reply_to ?? undefined,
      attachmentName: row.attachment_name ?? undefined,
      sentAt: row.sent_at ?? undefined,
      cardSource: 'real' as const,
      technique: row.technique,
      secondaryTechnique: row.secondary_technique,
      isGenaiSuspected: row.is_genai_suspected,
      genaiConfidence: row.genai_confidence,
      grammarQuality: row.grammar_quality,
      proseFluency: row.prose_fluency,
      personalizationLevel: row.personalization_level,
      contextualCoherence: row.contextual_coherence,
      datasetVersion: row.dataset_version,
    }));

    // Store full card data in Redis for server-side answer verification (NX = only if not exists)
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {
      await redis.set(`session-cards:${sessionId}`, JSON.stringify(cards), { ex: SESSION_TTL, nx: true });
      await redis.set(`session-streak:${sessionId}`, 0, { ex: SESSION_TTL });
      // Set render timestamp for the first card (server-side response timing)
      if (cards.length > 0) {
        await redis.set(`session-render:${sessionId}:0`, Date.now(), { ex: SESSION_TTL, nx: true });
      }
    }

    // Return cards with answer-revealing fields stripped
    return NextResponse.json(cards.map(toSafeCard));
  } catch (err) {
    console.error('Cards research error:', err);
    return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 });
  }
}
