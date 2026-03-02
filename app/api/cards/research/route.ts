import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { ResearchCard } from '@/lib/types';

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('cards_real')
      .select('*')
      .eq('dataset_version', 'v1')
      .order('approved_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json([]);

    // Map Supabase rows to the Card interface the game expects,
    // with research metadata attached
    const cards: ResearchCard[] = data.map((row) => ({
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
      authStatus: (row.auth_status ?? 'unverified') as 'verified' | 'unverified' | 'fail',
      // Research metadata
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
