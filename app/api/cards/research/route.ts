import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { ResearchCard } from '@/lib/types';

const ROUND_SIZE = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('cards_real').select('*');

    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json([]);

    const deck = shuffle(data).slice(0, ROUND_SIZE);

    // Record dealt cards server-side for answer validation
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {
      const dealtCardIds = deck.map((row) => row.card_id);
      supabase.from('sessions').upsert({
        session_id: sessionId,
        game_mode: 'research',
        dealt_card_ids: dealtCardIds,
      }, { onConflict: 'session_id' }).then(({ error: e }) => {
        if (e) console.error('Failed to record dealt cards:', e);
      });
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

    return NextResponse.json(cards);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
