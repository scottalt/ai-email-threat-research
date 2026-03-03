import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('cards_real')
    .select('*')
    .eq('difficulty', 'extreme');

  if (error) return NextResponse.json([], { status: 200 });

  const rows = (data ?? []) as Record<string, unknown>[];
  const cards = rows.map((c) => ({
    id: c.card_id,
    type: c.type,
    difficulty: c.difficulty,
    isPhishing: c.is_phishing,
    from: c.from_address,
    subject: c.subject ?? undefined,
    body: c.body,
    clues: Array.isArray(c.clues) ? c.clues : [],
    highlights: Array.isArray(c.highlights) ? c.highlights : [],
    explanation: c.explanation,
    technique: c.technique ?? null,
    authStatus: c.auth_status ?? 'unverified',
    replyTo: c.reply_to ?? undefined,
    attachmentName: c.attachment_name ?? undefined,
    sentAt: c.sent_at ?? undefined,
    cardSource: 'real',
    secondaryTechnique: c.secondary_technique ?? null,
    isGenaiSuspected: c.is_genai_suspected ?? null,
    genaiConfidence: c.genai_confidence ?? null,
    grammarQuality: c.grammar_quality ?? null,
    proseFluency: c.prose_fluency ?? null,
    personalizationLevel: c.personalization_level ?? null,
    contextualCoherence: c.contextual_coherence ?? null,
    datasetVersion: c.dataset_version ?? 'v1',
  }));

  return NextResponse.json(cards);
}
