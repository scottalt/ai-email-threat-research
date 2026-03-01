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
    const hasDate = !!rawDate.trim();

    if (!hasDate && strictDate) {
      skippedDate++;
      continue;
    }

    if (afterDate && hasDate) {
      const rowDate = new Date(rawDate);
      if (isNaN(rowDate.getTime()) || rowDate < afterDate) {
        skippedDate++;
        continue;
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
