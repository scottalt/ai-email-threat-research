import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';

// card_flags has no game_mode column, so a flag counts as "research mode" when
// the same session answered the same card in research mode. The matching answer
// also supplies what the player actually saw and chose, which is the context
// needed to interpret a flag (e.g. a wrong_answer flag on a card they missed).
const ANSWER_SELECT = [
  'session_id', 'card_id', 'player_id',
  'is_phishing', 'technique', 'difficulty', 'card_source',
  'user_answer', 'correct', 'confidence', 'answer_ordinal', 'dataset_version',
].join(', ');

const COLUMNS = [
  'flag_id', 'flagged_at', 'card_id', 'session_id', 'player_id',
  'reason', 'comment',
  'is_phishing', 'technique', 'difficulty', 'card_source',
  'user_answer', 'correct', 'confidence', 'answer_ordinal', 'dataset_version',
] as const;

type FlagRow = {
  id: string;
  card_id: string;
  session_id: string | null;
  reason: string | null;
  comment: string | null;
  created_at: string;
};
type AnswerRow = Record<string, unknown> & { session_id: string; card_id: string };

const PAGE_SIZE = 1000;
const SESSION_CHUNK = 100;
// answers.session_id is a UUID column, but card_flags.session_id is free text
// from the client. One malformed id would fail the whole .in() query.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = getSupabaseAdminClient();

  // Supabase caps .select() at 1 000 rows by default; paginate to get all
  const flags: FlagRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('card_flags')
      .select('id, card_id, session_id, reason, comment, created_at')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
    const rows = (data as FlagRow[] | null) ?? [];
    flags.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  const sessionIds = [
    ...new Set(
      flags
        .map((f) => f.session_id)
        .filter((id): id is string => !!id && UUID_RE.test(id))
        .map((id) => id.toLowerCase()),
    ),
  ];

  // Research answers for the flagged sessions, keyed by session + card
  const answers = new Map<string, AnswerRow>();
  for (let i = 0; i < sessionIds.length; i += SESSION_CHUNK) {
    const chunk = sessionIds.slice(i, i + SESSION_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('answers')
        .select(ANSWER_SELECT)
        .eq('game_mode', 'research')
        .in('session_id', chunk)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) return NextResponse.json({ error: 'Failed to fetch answers' }, { status: 500 });
      const rows = (data as unknown as AnswerRow[] | null) ?? [];
      for (const a of rows) answers.set(`${a.session_id}:${a.card_id}`, a);
      if (rows.length < PAGE_SIZE) break;
    }
  }

  const exportRows: Record<string, unknown>[] = [];
  for (const f of flags) {
    const answer = f.session_id ? answers.get(`${f.session_id.toLowerCase()}:${f.card_id}`) : undefined;
    if (!answer) continue;
    exportRows.push({
      ...answer,
      flag_id: f.id,
      flagged_at: f.created_at,
      card_id: f.card_id,
      session_id: f.session_id,
      reason: f.reason,
      comment: f.comment,
    });
  }

  if (!exportRows.length) {
    return NextResponse.json({ error: 'No research flags to export.' }, { status: 404 });
  }

  const header = COLUMNS.join(',');
  const lines = exportRows.map((row) => COLUMNS.map((col) => csvCell(row[col])).join(','));
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse([header, ...lines].join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="threat-terminal-flags-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string') return String(v);
  // Comments are player-written. A leading = + - @ would run as a formula when
  // the file is opened in Excel or Sheets, so neutralise it with a quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}
