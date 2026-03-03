/**
 * fix-link-display-text.ts
 *
 * One-time migration: wraps raw URLs in card bodies with [display text](url)
 * using Haiku. Applies to all cards in cards_staging and cards_real.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/fix-link-display-text.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/fix-link-display-text.ts --dry-run
 */

import path from 'path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const isDryRun = process.argv.includes('--dry-run');

function hasRawUrl(body: string): boolean {
  return /https?:\/\/[^\s)]+/.test(body) && !/\[.*?\]\(https?:\/\//.test(body);
}

function buildPrompt(card: {
  body: string;
  is_phishing: boolean;
  difficulty: string | null;
  technique: string | null;
}): string {
  const type = card.is_phishing
    ? `phishing — difficulty: ${card.difficulty ?? 'unknown'}${card.technique ? `, technique: ${card.technique}` : ''}`
    : 'legitimate';

  return `You are updating an email card body for a cybersecurity training game. The card is: ${type}.

Rewrite the body below, wrapping every raw URL in [display text](url) format.

Rules:
${card.is_phishing ? `Phishing — apply based on difficulty:
- easy: display text is the suspicious URL itself or barely cleaned (keep it obviously suspicious)
- medium: display text is plausible but imperfect — a near-miss domain or a generic phrase
- hard/extreme: display text is completely convincing (e.g. "paypal.com/verify" or "Click here to confirm your details") — the URL inspector is the only reveal` : `Legitimate — display text reflects what a real email would show: the real domain path, a short descriptive phrase like "View your statement", or a shortened URL. The actual URL must be unchanged — no mismatch.`}

Return ONLY the rewritten body text. No explanation, no JSON wrapper. Change nothing except wrapping raw URLs.

Body:
${card.body}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY required');

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // cards_staging uses processed_body / suggested_difficulty / suggested_technique
  // cards_real uses body / difficulty / technique
  const [stagingRes, realRes] = await Promise.all([
    supabase
      .from('cards_staging')
      .select('id, processed_body, is_phishing, suggested_difficulty, suggested_technique')
      .ilike('processed_body', '%http%'),
    supabase
      .from('cards_real')
      .select('id, body, is_phishing, difficulty, technique')
      .ilike('body', '%http%'),
  ]);

  if (stagingRes.error) throw stagingRes.error;
  if (realRes.error) throw realRes.error;

  // Normalise staging rows to a common shape
  const staging = (stagingRes.data ?? [])
    .filter((c) => hasRawUrl(c.processed_body))
    .map((c) => ({
      id: c.id as string,
      body: c.processed_body as string,
      is_phishing: c.is_phishing as boolean,
      difficulty: c.suggested_difficulty as string | null,
      technique: c.suggested_technique as string | null,
    }));

  const real = (realRes.data ?? [])
    .filter((c) => hasRawUrl(c.body))
    .map((c) => ({
      id: c.id as string,
      body: c.body as string,
      is_phishing: c.is_phishing as boolean,
      difficulty: c.difficulty as string | null,
      technique: c.technique as string | null,
    }));

  console.log(`Found ${staging.length} cards_staging + ${real.length} cards_real to update (dry-run: ${isDryRun})`);

  let updated = 0;
  let failed = 0;

  async function processCard(
    card: { id: string; body: string; is_phishing: boolean; difficulty: string | null; technique: string | null },
    table: 'cards_staging' | 'cards_real',
  ) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt(card) }],
      });

      const newBody = (response.content[0] as { type: string; text: string }).text.trim();

      if (isDryRun) {
        console.log(`\n[DRY RUN] ${table} ${card.id} (${card.is_phishing ? card.difficulty : 'legit'})`);
        console.log('BEFORE:', card.body.slice(0, 150));
        console.log('AFTER: ', newBody.slice(0, 150));
      } else {
        // cards_staging writes back to processed_body; cards_real writes to body
        const updateField = table === 'cards_staging' ? { processed_body: newBody } : { body: newBody };
        const { error } = await supabase.from(table).update(updateField).eq('id', card.id);
        if (error) throw error;
        console.log(`✓ ${table} ${card.id}`);
      }
      updated++;
    } catch (err) {
      console.error(`✗ ${table} ${card.id}:`, err);
      failed++;
    }
    await sleep(200);
  }

  for (const card of staging) await processCard(card, 'cards_staging');
  for (const card of real) await processCard(card, 'cards_real');

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
