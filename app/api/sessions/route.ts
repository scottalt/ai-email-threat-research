import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis, getClientIp } from '@/lib/redis';

const VALID_RANKS = new Set([
  'CLICK_HAPPY', 'PHISH_BAIT', 'LINK_CHECKER', 'HEADER_READER', 'SOC_ANALYST',
  'THREAT_HUNTER', 'INCIDENT_HANDLER', 'RED_TEAMER', 'APT_ANALYST', 'ZERO_DAY',
]);

const MAX_SCORE = 3500;
const MAX_CARDS = 10;

// PATCH — finalize a completed session with score, rank, and completion timestamp.
// Fired once when the round ends, before the summary screen appears.
export async function PATCH(req: NextRequest) {
  try {
    // Rate limit: 20 session finalizations per IP per minute
    const ip = getClientIp(req);
    const rlKey = `ratelimit:sessions:${ip}`;
    const rlCount = await redis.incr(rlKey);
    if (rlCount === 1) await redis.expire(rlKey, 60);
    if (rlCount > 20) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Verify auth — session finalization requires an authenticated player
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ ok: true }); // silent reject

    const supabase = getSupabaseAdminClient();

    // Resolve player_id from auth_id — needed for ownership check
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    if (!player) return NextResponse.json({ ok: true }); // silent reject — no player record

    const { sessionId, finalScore, finalRank, completedAt, cardsAnswered } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') return NextResponse.json({ ok: true });

    const safeScore = typeof finalScore === 'number' && finalScore >= 0 && finalScore <= MAX_SCORE && Number.isFinite(finalScore)
      ? finalScore : null;
    const safeRank = typeof finalRank === 'string' && VALID_RANKS.has(finalRank) ? finalRank : null;
    const safeCards = typeof cardsAnswered === 'number' && cardsAnswered >= 0 && cardsAnswered <= MAX_CARDS
      ? cardsAnswered : null;
    const safeCompletedAt = typeof completedAt === 'string' && !isNaN(Date.parse(completedAt))
      ? completedAt : new Date().toISOString();

    // Ownership check: verify session has answers from this player (sessions table
    // doesn't have a player_id column — TODO: add player_id column via migration).
    // For now, check that the session's answers belong to this player.
    const { data: sessionAnswers } = await supabase
      .from('answers')
      .select('player_id')
      .eq('session_id', sessionId)
      .limit(1);

    if (sessionAnswers && sessionAnswers.length > 0 && sessionAnswers[0].player_id !== player.id) {
      return NextResponse.json({ ok: true }); // silent reject — not your session
    }

    await supabase
      .from('sessions')
      .update({
        completed_at: safeCompletedAt,
        final_score: safeScore,
        final_rank: safeRank,
        cards_answered: safeCards,
      })
      .eq('session_id', sessionId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[sessions] PATCH failed:', err);
    return NextResponse.json({ ok: true });
  }
}
