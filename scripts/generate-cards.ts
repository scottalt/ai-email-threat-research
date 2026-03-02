/**
 * Generate Cards Script
 *
 * Generates phishing or legitimate email cards using an AI model and writes
 * them to cards_staging for admin review.
 *
 * Provider is selectable — use --provider to vary the model and avoid
 * single-model generation bias. Each card records ai_provider + ai_model.
 *
 * Usage:
 *   # Phishing cards (OpenAI, default)
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-cards.ts \
 *     --technique urgency --difficulty easy --count 20
 *
 *   # Phishing cards (Anthropic)
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-cards.ts \
 *     --technique urgency --difficulty easy --count 20 --provider anthropic
 *
 *   # Legitimate cards
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-cards.ts \
 *     --category transactional --count 20
 *
 *   # Dry run (prints JSON, no database writes)
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-cards.ts \
 *     --technique urgency --difficulty easy --count 3 --dry-run
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { config as loadEnv } from 'dotenv';

// Load .env.local (Next.js convention) — falls back gracefully if not found
loadEnv({ path: path.join(__dirname, '..', '.env.local') });
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENERATION_VERSION = '1.0';

const INDUSTRIES = [
  'healthcare and medical',
  'banking and financial services',
  'legal and law firms',
  'education and universities',
  'retail and e-commerce',
  'logistics and shipping',
  'manufacturing and industrial',
  'real estate and property management',
  'government and public sector',
  'HR and recruiting',
  'insurance',
  'energy and utilities',
  'hospitality and travel',
  'media and entertainment',
] as const;

const PHISHING_TECHNIQUES = [
  'urgency',
  'authority-impersonation',
  'credential-harvest',
  'hyper-personalization',
  'pretexting',
  'fluent-prose',
] as const;

const LEGITIMATE_CATEGORIES = ['transactional', 'marketing', 'workplace'] as const;

// ---------------------------------------------------------------------------
// Card interface
// ---------------------------------------------------------------------------

interface GeneratedCard {
  from: string;
  subject: string | null;
  body: string;
  highlights: string[];
  clues: string[];
  explanation: string;
}

// ---------------------------------------------------------------------------
// CardGenerator interface + adapters
// ---------------------------------------------------------------------------

interface CardGenerator {
  readonly provider: string;
  readonly modelId: string;
  generate(systemPrompt: string, techniqueContext: string, userMessage: string): Promise<GeneratedCard[]>;
}

function parseCardsJson(raw: string): GeneratedCard[] {
  // Try to extract a JSON object directly — handles plain JSON, fenced JSON, and mixed responses
  const fenceStripped = raw
    .trim()
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  // Find the first { and last } to extract the outermost JSON object
  const start = fenceStripped.indexOf('{');
  const end = fenceStripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in response: ${fenceStripped.slice(0, 200)}`);
  }
  const jsonStr = fenceStripped.slice(start, end + 1);

  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed.cards)) {
    throw new Error(`Expected { cards: [...] }, got: ${JSON.stringify(parsed).slice(0, 200)}`);
  }
  return parsed.cards as GeneratedCard[];
}

class OpenAICardGenerator implements CardGenerator {
  readonly provider = 'openai';
  readonly modelId = 'gpt-4o';
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generate(systemPrompt: string, techniqueContext: string, userMessage: string): Promise<GeneratedCard[]> {
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: [
        { role: 'system', content: `${systemPrompt}\n\n${techniqueContext}` },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 16000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');
    return parseCardsJson(content);
  }
}

const ANTHROPIC_MODELS: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
};

class AnthropicCardGenerator implements CardGenerator {
  readonly provider = 'anthropic';
  readonly modelId: string;
  private client: Anthropic;

  constructor(modelAlias = 'haiku') {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    this.modelId = ANTHROPIC_MODELS[modelAlias] ?? modelAlias; // allow raw model IDs too
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generate(systemPrompt: string, techniqueContext: string, userMessage: string): Promise<GeneratedCard[]> {
    const message = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 16000,
      system: `${systemPrompt}\n\n${techniqueContext}\n\nIMPORTANT: Respond with raw JSON only. Do not wrap in markdown code fences.`,
      messages: [{ role: 'user', content: userMessage }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') throw new Error('Anthropic returned empty or non-text response');
    return parseCardsJson(block.text);
  }
}

function getCardGenerator(provider: string, model?: string): CardGenerator {
  if (provider === 'anthropic') return new AnthropicCardGenerator(model ?? 'haiku');
  if (provider === 'openai') return new OpenAICardGenerator();
  throw new Error(`Unknown provider: ${provider}. Use 'anthropic'.`);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidCard(card: unknown, index: number): card is GeneratedCard {
  if (!card || typeof card !== 'object') {
    console.warn(`  Card ${index + 1}: not an object — skipped`);
    return false;
  }
  const c = card as Record<string, unknown>;

  if (typeof c.from !== 'string' || !c.from.trim()) {
    console.warn(`  Card ${index + 1}: missing 'from' — skipped`);
    return false;
  }
  if (typeof c.body !== 'string' || !c.body.trim()) {
    console.warn(`  Card ${index + 1}: missing 'body' — skipped`);
    return false;
  }
  if (!Array.isArray(c.highlights)) {
    console.warn(`  Card ${index + 1}: 'highlights' is not an array — skipped`);
    return false;
  }
  if (!Array.isArray(c.clues)) {
    console.warn(`  Card ${index + 1}: 'clues' is not an array — skipped`);
    return false;
  }
  if (typeof c.explanation !== 'string' || !c.explanation.trim()) {
    console.warn(`  Card ${index + 1}: missing 'explanation' — skipped`);
    return false;
  }
  if ((c.highlights as unknown[]).length !== (c.clues as unknown[]).length) {
    console.warn(`  Card ${index + 1}: highlights/clues length mismatch (${(c.highlights as unknown[]).length} vs ${(c.clues as unknown[]).length}) — skipped`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

// ---------------------------------------------------------------------------
// Prompt loading
// ---------------------------------------------------------------------------

function loadFile(relativePath: string): string {
  const filePath = path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const technique = getArg('--technique') as typeof PHISHING_TECHNIQUES[number] | null;
  const category = getArg('--category') as typeof LEGITIMATE_CATEGORIES[number] | null;
  const difficulty = getArg('--difficulty') as 'easy' | 'medium' | 'hard' | 'extreme' | null;
  const providerArg = getArg('--provider') ?? 'anthropic';
  const countArg = getArg('--count');
  const industryArg = getArg('--industry');
  const modelArg = getArg('--model');
  const isDryRun = hasFlag('--dry-run');
  const count = countArg ? parseInt(countArg, 10) : 20;

  // Resolve industry: explicit arg, or pick one at random
  const industry = industryArg ?? INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)];

  // Validation
  if (!technique && !category) {
    console.error('Error: provide --technique or --category');
    console.error('  Techniques: urgency, authority-impersonation, credential-harvest, hyper-personalization, pretexting, fluent-prose');
    console.error('  Categories: transactional, marketing, workplace');
    process.exit(1);
  }
  if (technique && category) {
    console.error('Error: --technique and --category are mutually exclusive');
    process.exit(1);
  }
  if (technique && !(PHISHING_TECHNIQUES as readonly string[]).includes(technique)) {
    console.error(`Unknown technique: ${technique}`);
    process.exit(1);
  }
  if (category && !(LEGITIMATE_CATEGORIES as readonly string[]).includes(category)) {
    console.error(`Unknown category: ${category}`);
    process.exit(1);
  }
  if (technique && !difficulty) {
    console.error('--difficulty is required for phishing cards (easy | medium | hard | extreme)');
    process.exit(1);
  }
  if (difficulty && !['easy', 'medium', 'hard', 'extreme'].includes(difficulty)) {
    console.error('--difficulty must be easy, medium, hard, or extreme');
    process.exit(1);
  }
  if (isNaN(count) || count < 1 || count > 50) {
    console.error('--count must be between 1 and 50');
    process.exit(1);
  }
  if (providerArg === 'anthropic' && count > 10) {
    console.warn(`Warning: Anthropic batches > 10 may exceed output token limits. Consider --count 10 and running multiple times.`);
  }
  if (!isDryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for live runs');
    process.exit(1);
  }

  // Load prompts
  const systemPrompt = loadFile('docs/prompts/system.md');
  const techniqueContext = technique
    ? loadFile(`docs/prompts/phishing/${technique}.md`)
    : loadFile(`docs/prompts/legitimate/${category}.md`);

  // Build user message
  const industryContext = ` All scenarios in this batch must be set in the ${industry} industry — company names, sender roles, referenced systems, and scenario contexts must reflect that industry specifically.`;
  const userMessage = technique
    ? `Generate ${count} ${difficulty} difficulty phishing emails using the "${technique}" technique.${industryContext}`
    : `Generate ${count} legitimate ${category} emails.${industryContext}`;

  // Build generator
  let generator: CardGenerator;
  try {
    generator = getCardGenerator(providerArg, modelArg ?? undefined);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const label = technique ? `${difficulty} "${technique}" phishing` : `"${category}" legitimate`;
  console.log(`\nGenerating ${count} ${label} cards using ${generator.provider}/${generator.modelId}...`);

  let rawCards: GeneratedCard[];
  try {
    rawCards = await generator.generate(systemPrompt, techniqueContext, userMessage);
  } catch (err) {
    console.error('Generation failed:', (err as Error).message);
    process.exit(1);
  }

  const validCards = rawCards.filter((card, i) => isValidCard(card, i));
  console.log(`Generated: ${rawCards.length} total, ${validCards.length} valid`);

  if (validCards.length === 0) {
    console.error('No valid cards generated.');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('\n--- DRY RUN OUTPUT ---');
    console.log(JSON.stringify(validCards, null, 2));
    console.log('\n(dry run — nothing written to database)');
    return;
  }

  // Create import batch
  const supabase = getAdminClient();
  const notes = technique
    ? `technique=${technique}, difficulty=${difficulty}, provider=${generator.provider}, model=${generator.modelId}, prompt_version=${GENERATION_VERSION}`
    : `category=${category}, provider=${generator.provider}, model=${generator.modelId}, prompt_version=${GENERATION_VERSION}`;

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({ source_corpus: 'generated', notes })
    .select('batch_id')
    .single();

  if (batchError || !batch) {
    console.error('Failed to create import batch:', batchError?.message);
    process.exit(1);
  }

  // Insert cards
  let inserted = 0;
  for (const card of validCards) {
    const rawEmailHash = createHash('sha256')
      .update(`${card.from}|${card.subject ?? ''}|${card.body}`)
      .digest('hex');

    const { error } = await supabase.from('cards_staging').insert({
      import_batch_id: batch.batch_id,
      source_corpus: 'generated',
      raw_email_hash: rawEmailHash,
      raw_from: card.from,
      raw_subject: card.subject ?? null,
      raw_body: card.body,
      processed_from: card.from,
      processed_subject: card.subject ?? null,
      processed_body: card.body,
      inferred_type: 'email',
      is_phishing: technique !== null,
      suggested_technique: technique ?? null,
      suggested_difficulty: difficulty,
      suggested_highlights: card.highlights,
      suggested_clues: card.clues,
      suggested_explanation: card.explanation,
      ai_provider: generator.provider,
      ai_model: generator.modelId,
      ai_preprocessing_version: GENERATION_VERSION,
      status: 'pending',
    });

    if (error) {
      console.warn(`  Failed to insert card: ${error.message}`);
    } else {
      inserted++;
    }
  }

  // Update batch counts
  const { error: updateError } = await supabase
    .from('import_batches')
    .update({ raw_count: validCards.length, processed_count: inserted })
    .eq('batch_id', batch.batch_id);

  if (updateError) console.warn('Failed to update batch counts:', updateError.message);

  console.log(`\nInserted ${inserted} / ${validCards.length} cards`);
  console.log(`Provider: ${generator.provider} / ${generator.modelId}`);
  console.log(`Batch ID: ${batch.batch_id}`);
  console.log(`Review at: /admin/review`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
