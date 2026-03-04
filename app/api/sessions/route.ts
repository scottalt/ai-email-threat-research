import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

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
    const { sessionId, finalScore, finalRank, completedAt, cardsAnswered } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') return NextResponse.json({ ok: true });

    const safeScore = typeof finalScore === 'number' && finalScore >= 0 && finalScore <= MAX_SCORE && Number.isFinite(finalScore)
      ? finalScore : null;
    const safeRank = typeof finalRank === 'string' && VALID_RANKS.has(finalRank) ? finalRank : null;
    const safeCards = typeof cardsAnswered === 'number' && cardsAnswered >= 0 && cardsAnswered <= MAX_CARDS
      ? cardsAnswered : null;
    const safeCompletedAt = typeof completedAt === 'string' && !isNaN(Date.parse(completedAt))
      ? completedAt : new Date().toISOString();

    const supabase = getSupabaseAdminClient();
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
  } catch {
    return NextResponse.json({ ok: true });
  }
}
