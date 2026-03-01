/**
 * Import Corpus Script — Skeleton
 *
 * Reads raw email files from a local directory and writes them to cards_staging.
 * Does NOT run AI preprocessing — that is a separate script (scripts/run-preprocessing.ts).
 * Does NOT modify any existing data.
 *
 * Usage:
 *   npx ts-node scripts/import-corpus.ts --dir ./corpus/anydotrun --corpus anydotrun --phishing true
 *
 * Expected input: directory of .eml, .txt, or .json files (one email per file)
 *
 * ⚠ STOP AFTER WRITING THIS FILE.
 * Do not write run-preprocessing.ts. Do not run this script.
 * Evaluate corpus sources and pipeline design before proceeding.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Supabase client — imported directly (not via Next.js lib/) for script use
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

// ---------------------------------------------------------------------------
// Email parsers — extend as needed for each corpus format
// ---------------------------------------------------------------------------

interface ParsedEmail {
  rawFrom: string;
  rawSubject: string | null;
  rawBody: string;
  receivedDate: string | null;
  hasHtml: boolean;
  inferredType: 'email' | 'sms';
}

function parseTextFile(content: string): ParsedEmail {
  // Simple parser for plain text format: looks for From:, Subject:, then body
  const lines = content.split('\n');
  let rawFrom = 'unknown';
  let rawSubject: string | null = null;
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().startsWith('from:')) {
      rawFrom = lines[i].slice(5).trim();
    } else if (lines[i].toLowerCase().startsWith('subject:')) {
      rawSubject = lines[i].slice(8).trim();
    } else if (lines[i].trim() === '') {
      bodyStart = i + 1;
      break;
    }
  }

  const rawBody = lines.slice(bodyStart).join('\n').trim();
  const hasHtml = rawBody.includes('<html') || rawBody.includes('<HTML');

  return { rawFrom, rawSubject, rawBody, receivedDate: null, hasHtml, inferredType: 'email' };
}

function parseJsonFile(content: string): ParsedEmail {
  // For corpora that export as JSON (e.g. { from, subject, body, date })
  const obj = JSON.parse(content);
  return {
    rawFrom: obj.from ?? obj.sender ?? 'unknown',
    rawSubject: obj.subject ?? null,
    rawBody: obj.body ?? obj.text ?? obj.content ?? '',
    receivedDate: obj.date ?? obj.received ?? null,
    hasHtml: (obj.body ?? '').includes('<html'),
    inferredType: 'email',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dir = getArg('--dir');
  const sourceCorpus = getArg('--corpus');
  const isPhishingArg = getArg('--phishing');

  if (!dir || !sourceCorpus || isPhishingArg === null) {
    console.error('Usage: ts-node scripts/import-corpus.ts --dir ./path --corpus name --phishing true|false');
    process.exit(1);
  }

  const isPhishing = isPhishingArg === 'true';
  const supabase = getAdminClient();

  // Create import batch record
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({ source_corpus: sourceCorpus, notes: `Manual import from ${dir}` })
    .select('batch_id')
    .single();

  if (batchError || !batch) {
    console.error('Failed to create import batch:', batchError?.message);
    process.exit(1);
  }

  const batchId = batch.batch_id;
  const files = fs.readdirSync(dir).filter((f) => /\.(eml|txt|json)$/i.test(f));
  console.log(`Found ${files.length} files in ${dir}`);

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Check for duplicate
    const { data: existing } = await supabase
      .from('cards_staging')
      .select('id')
      .eq('raw_email_hash', hash)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    let parsed: ParsedEmail;
    try {
      parsed = file.endsWith('.json') ? parseJsonFile(content) : parseTextFile(content);
    } catch {
      console.warn(`Skipping ${file} — parse error`);
      skipped++;
      continue;
    }

    if (!parsed.rawBody.trim()) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('cards_staging').insert({
      raw_email_hash: hash,
      import_batch_id: batchId,
      source_corpus: sourceCorpus,
      raw_from: parsed.rawFrom,
      raw_subject: parsed.rawSubject,
      raw_body: parsed.rawBody,
      received_date: parsed.receivedDate,
      has_html: parsed.hasHtml,
      inferred_type: parsed.inferredType,
      is_phishing: isPhishing,
      status: 'pending',
    });

    if (error) {
      console.warn(`Failed to insert ${file}:`, error.message);
      skipped++;
    } else {
      imported++;
    }
  }

  // Update batch counts
  await supabase
    .from('import_batches')
    .update({ raw_count: imported + skipped, processed_count: 0 })
    .eq('batch_id', batchId);

  console.log(`\nImport complete: ${imported} inserted, ${skipped} skipped`);
  console.log(`Batch ID: ${batchId}`);
}

main().catch(console.error);
