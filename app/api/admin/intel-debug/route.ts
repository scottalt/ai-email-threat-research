import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();
    const { data: answers } = await supabase
      .from('answers')
      .select('correct, technique, is_phishing, confidence, difficulty, game_mode, headers_opened, url_inspected, auth_status, player_id, players!player_id(background)')
      .eq('game_mode', 'research');

    if (!answers || answers.length === 0) {
      return NextResponse.json({ message: 'No research answers yet', totalAnswers: 0 });
    }

    const total = answers.length;
    const uniquePlayers = new Set(answers.map((a) => a.player_id).filter(Boolean)).size;

    const phishing = answers.filter((a) => a.is_phishing);
    const legit = answers.filter((a) => !a.is_phishing);

    const phishingMissed = phishing.filter((a) => !a.correct).length;
    const legitFlagged = legit.filter((a) => !a.correct).length;

    const bypassRate = phishing.length ? Math.round((phishingMissed / phishing.length) * 100) : 0;
    const falsePositiveRate = legit.length ? Math.round((legitFlagged / legit.length) * 100) : 0;

    // Bypass by technique with raw counts
    const techniqueMap: Record<string, { total: number; missed: number; correct: number }> = {};
    for (const a of answers) {
      if (!a.technique || !a.is_phishing) continue;
      if (!techniqueMap[a.technique]) techniqueMap[a.technique] = { total: 0, missed: 0, correct: 0 };
      techniqueMap[a.technique].total++;
      if (!a.correct) techniqueMap[a.technique].missed++;
      else techniqueMap[a.technique].correct++;
    }

    // Bypass by difficulty with raw counts
    const difficultyMap: Record<string, { total: number; missed: number; correct: number }> = {};
    for (const a of phishing) {
      if (!a.difficulty) continue;
      if (!difficultyMap[a.difficulty]) difficultyMap[a.difficulty] = { total: 0, missed: 0, correct: 0 };
      difficultyMap[a.difficulty].total++;
      if (!a.correct) difficultyMap[a.difficulty].missed++;
      else difficultyMap[a.difficulty].correct++;
    }

    // Confidence calibration with raw counts
    const confidenceMap: Record<string, { total: number; correct: number; wrong: number }> = {};
    for (const a of answers) {
      const c = a.confidence ?? 'unknown';
      if (!confidenceMap[c]) confidenceMap[c] = { total: 0, correct: 0, wrong: 0 };
      confidenceMap[c].total++;
      if (a.correct) confidenceMap[c].correct++;
      else confidenceMap[c].wrong++;
    }

    // Background accuracy with raw counts
    const bgMap: Record<string, { total: number; correct: number; wrong: number }> = {};
    for (const a of answers) {
      const joined = a.players as unknown as { background: string | null } | { background: string | null }[] | null;
      const player = Array.isArray(joined) ? joined[0] ?? null : joined;
      const bg = player?.background ?? 'unknown';
      if (!bgMap[bg]) bgMap[bg] = { total: 0, correct: 0, wrong: 0 };
      bgMap[bg].total++;
      if (a.correct) bgMap[bg].correct++;
      else bgMap[bg].wrong++;
    }

    // Auth trap: phishing with verified auth
    const authTrap = phishing.filter((a) => a.auth_status === 'verified');
    const authTrapMissed = authTrap.filter((a) => !a.correct).length;

    // Tool usage
    const withHeaders = answers.filter((a) => a.headers_opened);
    const withUrl = answers.filter((a) => a.url_inspected);

    return NextResponse.json({
      totalAnswers: total,
      uniquePlayers,
      overview: {
        phishingCards: phishing.length,
        legitCards: legit.length,
        phishingMissed,
        phishingCorrect: phishing.length - phishingMissed,
        bypassRate: `${bypassRate}%`,
        bypassRateRaw: `${phishingMissed}/${phishing.length}`,
        legitFlagged,
        legitCorrect: legit.length - legitFlagged,
        falsePositiveRate: `${falsePositiveRate}%`,
        falsePositiveRateRaw: `${legitFlagged}/${legit.length}`,
      },
      byTechnique: Object.entries(techniqueMap)
        .sort(([, a], [, b]) => b.total - a.total)
        .map(([technique, v]) => ({
          technique,
          ...v,
          bypassRate: `${Math.round((v.missed / v.total) * 100)}%`,
          bypassRateRaw: `${v.missed}/${v.total}`,
        })),
      byDifficulty: Object.entries(difficultyMap)
        .map(([difficulty, v]) => ({
          difficulty,
          ...v,
          bypassRate: `${Math.round((v.missed / v.total) * 100)}%`,
          bypassRateRaw: `${v.missed}/${v.total}`,
        })),
      byConfidence: Object.entries(confidenceMap)
        .map(([confidence, v]) => ({
          confidence,
          ...v,
          accuracyRate: `${v.total ? Math.round((v.correct / v.total) * 100) : 0}%`,
          accuracyRateRaw: `${v.correct}/${v.total}`,
        })),
      byBackground: Object.entries(bgMap)
        .sort(([, a], [, b]) => b.total - a.total)
        .map(([background, v]) => ({
          background,
          ...v,
          accuracyRate: `${v.total ? Math.round((v.correct / v.total) * 100) : 0}%`,
          accuracyRateRaw: `${v.correct}/${v.total}`,
        })),
      authTrap: {
        total: authTrap.length,
        missed: authTrapMissed,
        correct: authTrap.length - authTrapMissed,
        bypassRate: authTrap.length ? `${Math.round((authTrapMissed / authTrap.length) * 100)}%` : 'N/A',
        bypassRateRaw: `${authTrapMissed}/${authTrap.length}`,
      },
      toolUsage: {
        headersOpened: withHeaders.length,
        headersNotOpened: total - withHeaders.length,
        headersOpenedPct: `${Math.round((withHeaders.length / total) * 100)}%`,
        headersOpenedCorrect: withHeaders.filter((a) => a.correct).length,
        urlInspected: withUrl.length,
        urlNotInspected: total - withUrl.length,
        urlInspectedPct: `${Math.round((withUrl.length / total) * 100)}%`,
        urlInspectedCorrect: withUrl.filter((a) => a.correct).length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
