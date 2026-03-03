import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import type { ResearchCard } from '@/lib/types';

// Serve a stratified deck: 1 random card per phishing technique + LEGIT_PER_ROUND legit cards.
// This ensures technique representation is balanced regardless of which cards were approved first.
const TECHNIQUES = [
  'urgency',
  'authority-impersonation',
  'credential-harvest',
  'hyper-personalization',
  'pretexting',
  'fluent-prose',
] as const;
const LEGIT_PER_ROUND = 4;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('cards_real').select('*');

    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json([]);

    // Group by technique (phishing) and into legit pool
    const byTechnique: Record<string, typeof data[number][]> = {};
    const legitCards: typeof data[number][] = [];

    for (const row of data) {
      if (row.is_phishing && row.technique) {
        if (!byTechnique[row.technique]) byTechnique[row.technique] = [];
        byTechnique[row.technique].push(row);
      } else if (!row.is_phishing) {
        legitCards.push(row);
      }
    }

    // Pick 1 random card per technique (skip techniques with no approved cards yet)
    const phishingPicks: typeof data[number][] = [];
    for (const tech of TECHNIQUES) {
      const pool = byTechnique[tech] ?? [];
      if (pool.length > 0) phishingPicks.push(pickRandom(pool));
    }

    // Pick LEGIT_PER_ROUND random legit cards
    const legitPicks = shuffle(legitCards).slice(0, LEGIT_PER_ROUND);

    // Shuffle the combined deck so ordering is random each session
    const deck = shuffle([...phishingPicks, ...legitPicks]);

    const cards: ResearchCard[] = deck.map((row) => ({
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
      replyTo: row.reply_to ?? undefined,
      attachmentName: row.attachment_name ?? undefined,
      sentAt: row.sent_at ?? undefined,
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
