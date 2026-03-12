import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';

// All research-relevant columns from the answers table, plus player background via join
const ANSWERS_SELECT = [
  'id', 'session_id', 'card_id', 'card_source',
  'is_phishing', 'technique', 'secondary_technique',
  'is_genai_suspected', 'genai_confidence',
  'grammar_quality', 'prose_fluency', 'personalization_level', 'contextual_coherence',
  'difficulty', 'type', 'user_answer', 'correct', 'confidence',
  'time_from_render_ms', 'time_from_confidence_ms', 'confidence_selection_time_ms',
  'scroll_depth_pct', 'answer_method', 'answer_ordinal',
  'streak_at_answer_time', 'correct_count_at_time',
  'headers_opened', 'url_inspected', 'auth_status', 'has_reply_to', 'has_url',
  'player_id', 'game_mode', 'is_daily_challenge', 'dataset_version', 'created_at',
  'players!player_id(background)',
].join(', ');

type ExportRow = Record<string, unknown>;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const format = req.nextUrl.searchParams.get('format') ?? 'json';

  const supabase = getSupabaseAdminClient();

  // Supabase caps .select() at 1 000 rows by default; paginate to get all
  const allRows: ExportRow[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let done = false;

  while (!done) {
    const { data, error } = await supabase
      .from('answers')
      .select(ANSWERS_SELECT)
      .eq('game_mode', 'research')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) return NextResponse.json({ error: 'Failed to fetch answers' }, { status: 500 });

    const rows = (data as unknown as ExportRow[] | null) ?? [];
    // Flatten the joined players object into a top-level field
    for (const row of rows) {
      const player = row.players as { background: string | null } | null;
      row.player_background = player?.background ?? null;
      delete row.players;
    }
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) {
      done = true;
    } else {
      from += PAGE_SIZE;
    }
  }

  if (!allRows.length) {
    return NextResponse.json({ error: 'No research answers to export.' }, { status: 404 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `retro-phish-answers-${date}`;

  if (format === 'csv') return exportCsv(allRows, filename);
  if (format === 'jsonl') return exportJsonl(allRows, filename);
  return exportJson(allRows, filename);
}

function buildMetadata(data: ExportRow[]) {
  const correct = data.filter((r) => r.correct).length;
  const uniqueSessions = new Set(data.map((r) => r.session_id)).size;
  const uniquePlayers = new Set(data.map((r) => r.player_id).filter(Boolean)).size;

  const byTechnique: Record<string, { total: number; correct: number }> = {};
  for (const row of data) {
    const t = (row.technique as string) ?? 'unknown';
    if (!byTechnique[t]) byTechnique[t] = { total: 0, correct: 0 };
    byTechnique[t].total += 1;
    if (row.correct) byTechnique[t].correct += 1;
  }

  const byDifficulty: Record<string, number> = {};
  for (const row of data) {
    const d = (row.difficulty as string) ?? 'unknown';
    byDifficulty[d] = (byDifficulty[d] ?? 0) + 1;
  }

  const byBackground: Record<string, { total: number; correct: number }> = {};
  for (const row of data) {
    const bg = (row.player_background as string) ?? 'unknown';
    if (!byBackground[bg]) byBackground[bg] = { total: 0, correct: 0 };
    byBackground[bg].total += 1;
    if (row.correct) byBackground[bg].correct += 1;
  }

  return {
    dataset: 'Retro Phish v1 — Research Answers',
    description: 'Per-answer behavioural data from research mode sessions. Includes timing, confidence, tool usage (headers/URL inspection), scroll depth, and denormalised card metadata for direct analysis.',
    exported_at: new Date().toISOString(),
    total_answers: data.length,
    overall_accuracy: Math.round((correct / data.length) * 100),
    unique_sessions: uniqueSessions,
    unique_players: uniquePlayers,
    technique_breakdown: byTechnique,
    difficulty_breakdown: byDifficulty,
    background_breakdown: byBackground,
    source: 'https://retro-phish.scottaltiparmak.com',
    author: 'Scott Altiparmak — scottaltiparmak.com',
  };
}

function exportJson(data: ExportRow[], filename: string): NextResponse {
  const output = {
    metadata: buildMetadata(data),
    answers: data,
  };
  return NextResponse.json(output, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}.json"`,
    },
  });
}

function exportJsonl(data: ExportRow[], filename: string): NextResponse {
  const lines = data.map((row) => JSON.stringify(row)).join('\n');
  return new NextResponse(lines, {
    headers: {
      'Content-Type': 'application/jsonl',
      'Content-Disposition': `attachment; filename="${filename}.jsonl"`,
    },
  });
}

function exportCsv(data: ExportRow[], filename: string): NextResponse {
  const columns = Object.keys(data[0]);
  const header = columns.join(',');

  const rows = data.map((row) =>
    columns.map((col) => {
      const v = row[col];
      if (v === null || v === undefined) return '';
      if (Array.isArray(v)) return `"${(v as string[]).join(' | ').replace(/"/g, '""')}"`;
      if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
      return String(v);
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
