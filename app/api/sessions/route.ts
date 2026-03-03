import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

// PATCH — finalize a completed session with score, rank, and completion timestamp.
// Fired once when the round ends, before the summary screen appears.
export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, finalScore, finalRank, completedAt, cardsAnswered } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') return NextResponse.json({ ok: true });

    const supabase = getSupabaseAdminClient();
    await supabase
      .from('sessions')
      .update({
        completed_at: completedAt,
        final_score: finalScore,
        final_rank: finalRank,
        cards_answered: cardsAnswered,
      })
      .eq('session_id', sessionId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
