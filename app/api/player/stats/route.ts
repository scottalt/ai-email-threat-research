import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// GET /api/player/stats — personal stats dashboard (graduation-gated)
export async function GET() {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();

  // Get player
  const { data: player } = await admin
    .from('players')
    .select('id, research_graduated')
    .eq('auth_id', authId)
    .single();

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  if (!player.research_graduated) return NextResponse.json({ error: 'Complete research to unlock stats' }, { status: 403 });

  // Fetch all non-research, non-preview answers for this player
  const { data: answers } = await admin
    .from('answers')
    .select('correct, confidence, difficulty, time_from_render_ms, headers_opened, url_inspected, game_mode, is_phishing, created_at')
    .eq('player_id', player.id)
    .in('game_mode', ['freeplay', 'daily', 'expert']);

  const rows = answers ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ empty: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Overall accuracy
  const totalAnswers = rows.length;
  const totalCorrect = rows.filter(r => r.correct).length;
  const overallAccuracy = Math.round((totalCorrect / totalAnswers) * 100);

  // Accuracy by difficulty
  const byDifficulty: Record<string, { total: number; correct: number }> = {};
  for (const r of rows) {
    const d = r.difficulty ?? 'unknown';
    if (!byDifficulty[d]) byDifficulty[d] = { total: 0, correct: 0 };
    byDifficulty[d].total++;
    if (r.correct) byDifficulty[d].correct++;
  }

  // Phishing catch rate vs legit accuracy
  const phishingAnswers = rows.filter(r => r.is_phishing);
  const legitAnswers = rows.filter(r => !r.is_phishing);
  const phishingCatchRate = phishingAnswers.length > 0
    ? Math.round((phishingAnswers.filter(r => r.correct).length / phishingAnswers.length) * 100) : null;
  const legitAccuracy = legitAnswers.length > 0
    ? Math.round((legitAnswers.filter(r => r.correct).length / legitAnswers.length) * 100) : null;

  // Confidence calibration — accuracy at each confidence level
  const byConfidence: Record<string, { total: number; correct: number }> = {};
  for (const r of rows) {
    const c = r.confidence ?? 'unknown';
    if (!byConfidence[c]) byConfidence[c] = { total: 0, correct: 0 };
    byConfidence[c].total++;
    if (r.correct) byConfidence[c].correct++;
  }

  // Average response time (only for answers with timing data)
  const withTime = rows.filter(r => r.time_from_render_ms != null && r.time_from_render_ms > 0);
  const avgTimeMs = withTime.length > 0
    ? Math.round(withTime.reduce((s, r) => s + r.time_from_render_ms!, 0) / withTime.length)
    : null;

  // Tool usage rates
  const headersRate = Math.round((rows.filter(r => r.headers_opened).length / totalAnswers) * 100);
  const urlRate = Math.round((rows.filter(r => r.url_inspected).length / totalAnswers) * 100);

  // By game mode
  const byMode: Record<string, { total: number; correct: number }> = {};
  for (const r of rows) {
    if (!byMode[r.game_mode]) byMode[r.game_mode] = { total: 0, correct: 0 };
    byMode[r.game_mode].total++;
    if (r.correct) byMode[r.game_mode].correct++;
  }

  // Activity — answers per day (last 14 days)
  const now = new Date();
  const activity: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    activity[d.toISOString().slice(0, 10)] = 0;
  }
  for (const r of rows) {
    const day = (r.created_at as string).slice(0, 10);
    if (day in activity) activity[day]++;
  }

  return NextResponse.json({
    totalAnswers,
    totalCorrect,
    overallAccuracy,
    phishingCatchRate,
    legitAccuracy,
    byDifficulty,
    byConfidence,
    avgTimeMs,
    headersRate,
    urlRate,
    byMode,
    activity,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
