/**
 * Run Preprocessing Script
 *
 * Reads pending, unprocessed rows from cards_staging and enriches them
 * with AI metadata using lib/ai-preprocessor.ts.
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 * (or ANTHROPIC_API_KEY if AI_PROVIDER=anthropic)
 *
 * Usage:
 *   npx ts-node -r dotenv/config scripts/run-preprocessing.ts --limit 10
 *
 * dotenv/config loads .env.local automatically.
 *
 * Options:
 *   --limit N    Process at most N cards (default: 10)
 *   --dry-run    Print cards that would be processed, but don't call AI or update DB
 */

import { createClient } from '@supabase/supabase-js';
import { getPreprocessor, type RawEmailInput } from '../lib/ai-preprocessor';

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  return createClient(url, key);
}

function validateEnv() {
  const provider = process.env.AI_PROVIDER ?? 'openai';
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set (or set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY)');
  }
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
}

async function main() {
  validateEnv();
  const limit = parseInt(getArg('--limit') ?? '10', 10);
  const dryRun = hasFlag('--dry-run');

  if (dryRun) console.log('DRY RUN — no AI calls or DB updates will be made\n');

  const supabase = getAdminClient();
  const preprocessor = getPreprocessor();

  // Both concrete preprocessor classes expose modelId and version,
  // but AIPreprocessor interface does not declare them — cast to access.
  const p = preprocessor as typeof preprocessor & { modelId: string; version: string };
  console.log(`Using preprocessor: ${p.modelId} v${p.version}`);

  // Fetch pending, unprocessed cards
  const { data: cards, error } = await supabase
    .from('cards_staging')
    .select('id, raw_from, raw_subject, raw_body, inferred_type, is_phishing')
    .eq('status', 'pending')
    .is('ai_processed_at', null)
    .limit(limit);

  if (error) {
    console.error('Failed to fetch cards:', error.message);
    process.exit(1);
  }

  if (!cards || cards.length === 0) {
    console.log('No pending unprocessed cards found.');
    return;
  }

  console.log(`Found ${cards.length} cards to process\n`);

  let succeeded = 0;
  let failed = 0;

  for (const card of cards) {
    console.log(`Processing ${card.id}...`);

    if (dryRun) {
      console.log(`  [dry-run] Would process: "${card.raw_subject ?? '(no subject)'}"`);
      continue;
    }

    const input: RawEmailInput = {
      rawFrom: card.raw_from ?? 'unknown',
      rawSubject: card.raw_subject ?? null,
      rawBody: card.raw_body,
      isPhishing: card.is_phishing ?? false,
      type: card.inferred_type as 'email' | 'sms',
    };

    try {
      const result = await preprocessor.process(input);

      const { error: updateError } = await supabase
        .from('cards_staging')
        .update({
          processed_from: result.processedFrom,
          processed_subject: result.processedSubject,
          processed_body: result.processedBody,
          sanitized_body: result.sanitizedBody,
          suggested_technique: result.suggestedTechnique,
          suggested_secondary_technique: result.suggestedSecondaryTechnique ?? null,
          suggested_difficulty: result.suggestedDifficulty,
          suggested_highlights: result.suggestedHighlights,
          suggested_clues: result.suggestedClues,
          suggested_explanation: result.suggestedExplanation,
          grammar_quality: result.grammarQuality,
          prose_fluency: result.proseFluency,
          personalization_level: result.personalizationLevel,
          contextual_coherence: result.contextualCoherence,
          is_genai_suspected: result.isGenaiSuspected,
          genai_confidence: result.genaiConfidence,
          genai_ai_assessment: result.genaiAiAssessment,
          genai_ai_reasoning: result.genaiAiReasoning,
          content_flagged: result.contentFlagged,
          content_flag_reason: result.contentFlagReason ?? null,
          ai_provider: p.modelId.startsWith('gpt') ? 'openai' : 'anthropic',
          ai_model: p.modelId,
          ai_preprocessing_version: p.version,
          ai_processed_at: new Date().toISOString(),
        })
        .eq('id', card.id);

      if (updateError) {
        console.error(`  Failed to update ${card.id}:`, updateError.message);
        failed++;
      } else {
        console.log(`  OK technique=${result.suggestedTechnique} difficulty=${result.suggestedDifficulty} genai=${result.isGenaiSuspected}`);
        succeeded++;
      }
    } catch (err) {
      console.error(`  Error processing ${card.id}:`, err instanceof Error ? err.message : err);
      failed++;
    }

    // Brief pause between API calls to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
