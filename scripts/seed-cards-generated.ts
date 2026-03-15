/**
 * One-time seed script: loads freeplay + expert cards from static files
 * into the cards_generated table in Supabase.
 *
 * Usage:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-cards-generated.ts
 *
 * Safe to re-run — uses ON CONFLICT (card_id) DO NOTHING.
 * Does NOT touch cards_real.
 */

import { createClient } from '@supabase/supabase-js';
import { CARDS } from '../data/cards';
import { EXPERT_CARDS } from '../data/expert-cards';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

interface CardRow {
  card_id: string;
  pool: 'freeplay' | 'expert';
  type: string;
  is_phishing: boolean;
  difficulty: string;
  from_address: string;
  subject: string | null;
  body: string;
  clues: string[];
  explanation: string;
  highlights: string[];
  technique: string | null;
  auth_status: string;
  reply_to: string | null;
  attachment_name: string | null;
  sent_at: string | null;
}

function toRow(card: (typeof CARDS)[number], pool: 'freeplay' | 'expert'): CardRow {
  return {
    card_id: card.id,
    pool,
    type: card.type,
    is_phishing: card.isPhishing,
    difficulty: card.difficulty,
    from_address: card.from,
    subject: card.subject ?? null,
    body: card.body,
    clues: card.clues,
    explanation: card.explanation,
    highlights: card.highlights ?? [],
    technique: card.technique ?? null,
    auth_status: card.authStatus ?? 'unverified',
    reply_to: card.replyTo ?? null,
    attachment_name: card.attachmentName ?? null,
    sent_at: card.sentAt ?? null,
  };
}

async function main() {
  const freeplayRows = CARDS.map(c => toRow(c, 'freeplay'));
  const expertRows = EXPERT_CARDS.map(c => toRow(c, 'expert'));
  const allRows = [...freeplayRows, ...expertRows];

  console.log(`Seeding ${freeplayRows.length} freeplay + ${expertRows.length} expert = ${allRows.length} total cards`);

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    const { error } = await supabase.from('cards_generated').upsert(batch, {
      onConflict: 'card_id',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Done — ${inserted} cards seeded`);
}

main().catch(console.error);
