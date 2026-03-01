# Corpus Collection Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build two scripts that complete the corpus pipeline — a CSV-to-JSON prep script for Kaggle datasets and an AI preprocessing runner — so real phishing emails can be imported, enriched, reviewed, and served in Research Mode.

**Architecture:** Two standalone Node.js scripts in `scripts/`. `prepare-corpus.ts` converts Kaggle CSV exports into the individual JSON files expected by the existing `import-corpus.ts`. `run-preprocessing.ts` reads pending rows from `cards_staging` and enriches them with AI metadata via the existing `lib/ai-preprocessor.ts` abstraction. Both scripts load env vars from `.env.local` via dotenv.

**Tech Stack:** TypeScript, ts-node, csv-parse, dotenv, @supabase/supabase-js, openai (existing deps)

---

## Before You Start

Read these files — you will need to understand them:
- `scripts/import-corpus.ts` — the existing import script; prepare-corpus outputs files that feed into this
- `lib/ai-preprocessor.ts` — the preprocessor interface and `PreprocessResult` type
- `lib/supabase.ts` — the Supabase client factory
- `supabase/schema.sql` — specifically the `cards_staging` column names for AI fields

The pipeline end-to-end:
```
Kaggle CSV → prepare-corpus.ts → ./corpus/kaggle/*.json
                                        ↓
GitHub .eml files → ./corpus/phishing_pot/ (no conversion needed)
                                        ↓
                         import-corpus.ts → cards_staging (status: pending)
                                        ↓
                         run-preprocessing.ts → cards_staging (AI fields populated)
                                        ↓
                         /admin/review → cards_real
                                        ↓
                         Research Mode game
```

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install csv-parse and dotenv**

```bash
npm install csv-parse dotenv
```

**Step 2: Verify they appear in package.json**

```bash
grep -E "csv-parse|dotenv" package.json
```

Expected: both listed under `dependencies`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add csv-parse and dotenv for corpus scripts"
```

---

## Task 2: Create prepare-corpus.ts

**Files:**
- Create: `scripts/prepare-corpus.ts`

This script reads a Kaggle CSV, maps columns to our JSON format, filters rows by date, and writes each row as an individual JSON file to an output directory.

**Step 1: Create `scripts/prepare-corpus.ts`**

```typescript
/**
 * Prepare Corpus Script
 *
 * Converts a Kaggle phishing email CSV into individual JSON files
 * compatible with scripts/import-corpus.ts.
 *
 * Usage:
 *   npx ts-node scripts/prepare-corpus.ts \
 *     --input ./downloads/phishing.csv \
 *     --output ./corpus/kaggle \
 *     --body-col "Email Text" \
 *     --from-col "sender" \
 *     --subject-col "subject" \
 *     --date-col "date" \
 *     --after 2023-01-01 \
 *     --label-col "Email Type" \
 *     --label-value "Phishing Email"
 *
 * Column flags are optional — defaults cover common Kaggle dataset formats.
 * Rows missing a date are included unless --strict-date is set.
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function main() {
  const inputPath = getArg('--input');
  const outputDir = getArg('--output');

  if (!inputPath || !outputDir) {
    console.error('Usage: npx ts-node scripts/prepare-corpus.ts --input <csv> --output <dir>');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Column name mappings — override with CLI flags for non-standard CSVs
  const bodyCol = getArg('--body-col') ?? 'body';
  const fromCol = getArg('--from-col') ?? 'sender';
  const subjectCol = getArg('--subject-col') ?? 'subject';
  const dateCol = getArg('--date-col') ?? 'date';
  const labelCol = getArg('--label-col') ?? null;
  const labelValue = getArg('--label-value') ?? null;
  const afterDate = getArg('--after') ? new Date(getArg('--after')!) : null;
  const strictDate = hasFlag('--strict-date');

  // Create output dir
  fs.mkdirSync(outputDir, { recursive: true });

  // Parse CSV
  const content = fs.readFileSync(inputPath, 'utf-8');
  const records = parse(content, {
    columns: true,       // use header row as column names
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  console.log(`Parsed ${records.length} rows from ${inputPath}`);

  let written = 0;
  let skippedLabel = 0;
  let skippedDate = 0;
  let skippedBody = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];

    // Filter by label column if specified (e.g. keep only "Phishing Email" rows)
    if (labelCol && labelValue) {
      const rowLabel = row[labelCol] ?? '';
      if (rowLabel.trim() !== labelValue.trim()) {
        skippedLabel++;
        continue;
      }
    }

    // Get body — required
    const body = row[bodyCol] ?? '';
    if (!body.trim()) {
      skippedBody++;
      continue;
    }

    // Filter by date
    const rawDate = row[dateCol] ?? '';
    if (afterDate) {
      if (!rawDate.trim()) {
        if (strictDate) {
          skippedDate++;
          continue;
        }
        // No date — include unless strict mode
      } else {
        const rowDate = new Date(rawDate);
        if (isNaN(rowDate.getTime()) || rowDate < afterDate) {
          skippedDate++;
          continue;
        }
      }
    }

    const record = {
      from: row[fromCol] ?? 'unknown',
      subject: row[subjectCol] ?? null,
      body,
      date: rawDate || null,
    };

    const filename = `row-${String(i).padStart(6, '0')}.json`;
    fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(record, null, 2));
    written++;
  }

  console.log(`\nDone:`);
  console.log(`  Written:       ${written}`);
  console.log(`  Skipped label: ${skippedLabel}`);
  console.log(`  Skipped date:  ${skippedDate}`);
  console.log(`  Skipped body:  ${skippedBody}`);
  console.log(`\nOutput: ${outputDir}`);
}

main();
```

**Step 2: Run build to verify TypeScript compiles**

```bash
npm run build
```

Expected: Clean compile. The script is not part of the Next.js app so it won't appear in route output — just verify no errors.

**Step 3: Commit**

```bash
git add scripts/prepare-corpus.ts
git commit -m "feat: add prepare-corpus script for Kaggle CSV conversion"
```

---

## Task 3: Create run-preprocessing.ts

**Files:**
- Create: `scripts/run-preprocessing.ts`

This script reads unprocessed rows from `cards_staging` and enriches them with AI metadata using the existing preprocessor abstraction.

**Step 1: Read `lib/ai-preprocessor.ts` carefully**

You need to understand:
- The `RawEmailInput` interface (what to pass in)
- The `PreprocessResult` interface (what you get back)
- The `getPreprocessor()` factory function (how to get the preprocessor instance)

The `PreprocessResult` fields map to `cards_staging` columns like this:
- `processedFrom` → `processed_from`
- `processedSubject` → `processed_subject`
- `processedBody` → `processed_body`
- `sanitizedBody` → `sanitized_body`
- `suggestedTechnique` → `suggested_technique`
- `suggestedSecondaryTechnique` → `suggested_secondary_technique`
- `difficulty` → `suggested_difficulty`
- `highlights` → `suggested_highlights`
- `clues` → `suggested_clues`
- `explanation` → `suggested_explanation`
- `grammarQuality` → `grammar_quality`
- `proseFluency` → `prose_fluency`
- `personalizationLevel` → `personalization_level`
- `contextualCoherence` → `contextual_coherence`
- `isGenaiSuspected` → `is_genai_suspected`
- `genaiConfidence` → `genai_confidence`
- `genaiAiAssessment` → `genai_ai_assessment`
- `genaiAiReasoning` → `genai_ai_reasoning`
- `contentFlagged` → `content_flagged`
- `contentFlagReason` → `content_flag_reason`

**Step 2: Create `scripts/run-preprocessing.ts`**

```typescript
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

async function main() {
  const limit = parseInt(getArg('--limit') ?? '10', 10);
  const dryRun = hasFlag('--dry-run');

  if (dryRun) console.log('DRY RUN — no AI calls or DB updates will be made\n');

  const supabase = getAdminClient();
  const preprocessor = getPreprocessor();

  console.log(`Using preprocessor: ${preprocessor.modelId} v${preprocessor.version}`);

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
          suggested_difficulty: result.difficulty,
          suggested_highlights: result.highlights,
          suggested_clues: result.clues,
          suggested_explanation: result.explanation,
          grammar_quality: result.grammarQuality,
          prose_fluency: result.proseFluency,
          personalization_level: result.personalizationLevel,
          contextual_coherence: result.contextualCoherence,
          is_genai_suspected: result.isGenaiSuspected,
          genai_confidence: result.genaiConfidence,
          genai_ai_assessment: result.genaiAiAssessment ?? null,
          genai_ai_reasoning: result.genaiAiReasoning ?? null,
          content_flagged: result.contentFlagged,
          content_flag_reason: result.contentFlagReason ?? null,
          ai_provider: preprocessor.modelId.startsWith('gpt') ? 'openai' : 'anthropic',
          ai_model: preprocessor.modelId,
          ai_preprocessing_version: preprocessor.version,
          ai_processed_at: new Date().toISOString(),
        })
        .eq('id', card.id);

      if (updateError) {
        console.error(`  Failed to update ${card.id}:`, updateError.message);
        failed++;
      } else {
        console.log(`  ✓ technique=${result.suggestedTechnique} difficulty=${result.difficulty} genai=${result.isGenaiSuspected}`);
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

main().catch(console.error);
```

**Step 3: Run build to verify TypeScript compiles**

```bash
npm run build
```

Expected: Clean compile.

**Step 4: Commit**

```bash
git add scripts/run-preprocessing.ts
git commit -m "feat: add run-preprocessing script for AI metadata enrichment"
```

---

## Task 4: Create .env.local.example and .env.local

**Files:**
- Modify: `.env.local.example` (add new vars if not already present)
- Create: `.env.local` (local only, gitignored)

**Step 1: Check what's in .env.local.example**

```bash
cat .env.local.example
```

**Step 2: Ensure these vars are listed in `.env.local.example`**

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
OPENAI_API_KEY=
# AI_PROVIDER=anthropic  # uncomment to use Anthropic instead of OpenAI
# ANTHROPIC_API_KEY=
```

**Step 3: Create your local `.env.local`**

Copy `.env.local.example` to `.env.local` and fill in values from:
- Supabase project settings → API (URL, anon/publishable key, service role key)
- Vercel project settings → Environment Variables (same values you set there)
- OpenAI platform → API keys

```bash
cp .env.local.example .env.local
# then edit .env.local with real values
```

`.env.local` is already in `.gitignore` — never commit it.

**Step 4: Commit `.env.local.example` if changed**

```bash
git add .env.local.example
git commit -m "chore: update env.local.example with script vars"
```

---

## Task 5: Source corpus data (manual steps — no code)

### Kaggle dataset

1. Go to kaggle.com and search: `phishing email dataset 2023`
2. Sort by "Most Recent" — look for datasets uploaded 2023 or later with labeled phishing/ham columns
3. Good candidates to check:
   - Search "phishing email detection 2024"
   - Look for datasets with columns like: body/text, label/type, date
   - Aim for 1,000+ rows so you have plenty to filter down to 12
4. Download as CSV → save to `./downloads/` (this directory is gitignored — create it)

### GitHub phishing_pot

```bash
# Clone into a temp directory outside the project
git clone https://github.com/rf-peixoto/phishing_pot /tmp/phishing_pot

# Copy .eml files into corpus directory
mkdir -p corpus/phishing_pot
cp /tmp/phishing_pot/*.eml corpus/phishing_pot/ 2>/dev/null || true
cp /tmp/phishing_pot/**/*.eml corpus/phishing_pot/ 2>/dev/null || true
echo "Copied $(ls corpus/phishing_pot/*.eml 2>/dev/null | wc -l) .eml files"
```

**Step: Add `downloads/` and `corpus/` to `.gitignore`**

```bash
echo "downloads/" >> .gitignore
echo "corpus/" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore downloads and corpus directories"
```

---

## Task 6: Run the full pipeline end-to-end

This is a verification task — run each step and confirm output at each stage.

### Step 1: Convert Kaggle CSV

Check the column names in your downloaded CSV first:

```bash
head -1 ./downloads/your-dataset.csv
```

Then run prepare-corpus. Adjust `--body-col`, `--label-col`, `--label-value` to match your CSV's actual column names:

```bash
npx ts-node scripts/prepare-corpus.ts \
  --input ./downloads/your-dataset.csv \
  --output ./corpus/kaggle \
  --body-col "Email Text" \
  --from-col "sender" \
  --subject-col "subject" \
  --date-col "date" \
  --after 2023-01-01 \
  --label-col "Email Type" \
  --label-value "Phishing Email"
```

Expected output: `Written: N` — should have at least 20+ files in `./corpus/kaggle/`.

### Step 2: Import Kaggle corpus

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
npx ts-node scripts/import-corpus.ts \
  --dir ./corpus/kaggle \
  --corpus kaggle-2024 \
  --phishing true
```

Or if using .env.local:

```bash
npx ts-node -r dotenv/config scripts/import-corpus.ts \
  --dir ./corpus/kaggle \
  --corpus kaggle-2024 \
  --phishing true
```

Expected: `Import complete: N inserted, M skipped`

### Step 3: Import phishing_pot corpus

```bash
npx ts-node -r dotenv/config scripts/import-corpus.ts \
  --dir ./corpus/phishing_pot \
  --corpus phishing_pot \
  --phishing true
```

### Step 4: Verify rows in Supabase

Check Supabase dashboard → Table Editor → `cards_staging` — you should see rows with `status = 'pending'` and `ai_processed_at = null`.

### Step 5: Run preprocessing (dry run first)

```bash
npx ts-node -r dotenv/config scripts/run-preprocessing.ts --limit 5 --dry-run
```

Expected: prints card subjects without making API calls.

### Step 6: Run preprocessing for real

```bash
npx ts-node -r dotenv/config scripts/run-preprocessing.ts --limit 12
```

Expected: 12 cards processed, each line showing `technique=... difficulty=... genai=...`

### Step 7: Verify in Supabase

Check `cards_staging` — the 12 rows should now have `ai_processed_at` set and AI fields populated.

### Step 8: Admin review

Go to `retro-phish.scottaltiparmak.com/admin/review`:
- Review each card: check the AI analysis looks right
- Press `A` to approve good ones, `R` to reject poor quality ones
- Aim to approve 12

### Step 9: Verify in cards_real

Check Supabase → `cards_real` — approved cards should appear. The admin dashboard at `/admin` should show updated counts.

### Step 10: Test Research Mode

On the live site: StartScreen → `[ RESEARCH MODE — REAL DATA ]` → play a round. Cards should be pulled from `cards_real`.

---

## ⚠ Notes

- **Costs:** OpenAI gpt-4o charges per token. At ~$5/1M input tokens, preprocessing 12 emails costs pennies. Still, use `--dry-run` first to sanity check.
- **Rate limits:** The 500ms pause between calls in `run-preprocessing.ts` prevents hitting OpenAI rate limits for small batches. Increase `--limit` gradually for larger runs.
- **dotenv/config:** The `-r dotenv/config` flag tells ts-node to load `.env.local` before running. Without it, the script will throw on missing env vars.
- **Column names vary:** Kaggle datasets all have different column names. Always `head -1 your-file.csv` before running prepare-corpus to see the actual headers.
