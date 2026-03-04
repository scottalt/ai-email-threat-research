import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const revalidate = 300; // cache for 5 minutes

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: answers } = await supabase
      .from('answers')
      .select('correct, technique, is_phishing, is_genai_suspected, genai_confidence, prose_fluency, grammar_quality, confidence, time_from_render_ms, difficulty, type, card_source, headers_opened, url_inspected, auth_status, has_reply_to, has_url')
      .eq('game_mode', 'research');

    if (!answers || answers.length === 0) {
      return NextResponse.json({ totalAnswers: 0, insufficient: true });
    }

    const total = answers.length;
    const phishingAnswers = answers.filter((a) => a.is_phishing);
    const legitAnswers = answers.filter((a) => !a.is_phishing);
    // Bypass rate = phishing cards that were missed (user said legit)
    const overallBypassRate = phishingAnswers.length
      ? Math.round((phishingAnswers.filter((a) => !a.correct).length / phishingAnswers.length) * 100)
      : 0;
    // False positive rate = legit cards incorrectly flagged as phishing
    const falsePositiveRate = legitAnswers.length
      ? Math.round((legitAnswers.filter((a) => !a.correct).length / legitAnswers.length) * 100)
      : 0;

    // Tool usage rates
    const withHeaders = answers.filter((a) => a.headers_opened);
    const withUrl     = answers.filter((a) => a.url_inspected);
    const headersOpenedPct      = Math.round((withHeaders.length / total) * 100);
    const urlInspectedPct       = Math.round((withUrl.length / total) * 100);
    const headersOpenedAccuracy = withHeaders.length
      ? Math.round((withHeaders.filter((a) => a.correct).length / withHeaders.length) * 100) : null;
    const headersNotOpenedAccuracy = (total - withHeaders.length)
      ? Math.round((answers.filter((a) => !a.headers_opened && a.correct).length / (total - withHeaders.length)) * 100) : null;
    const urlInspectedAccuracy = withUrl.length
      ? Math.round((withUrl.filter((a) => a.correct).length / withUrl.length) * 100) : null;
    const urlNotInspectedAccuracy = (total - withUrl.length)
      ? Math.round((answers.filter((a) => !a.url_inspected && a.correct).length / (total - withUrl.length)) * 100) : null;

    // Auth-trap cards: phishing with PASS headers (hardest scenario)
    const authTrapAnswers = answers.filter((a) => a.is_phishing && a.auth_status === 'verified');
    const authTrapBypassRate = authTrapAnswers.length
      ? Math.round((authTrapAnswers.filter((a) => !a.correct).length / authTrapAnswers.length) * 100) : null;

    // Median time-to-answer by technique
    function median(nums: number[]): number {
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }

    const techniqueTimeMap: Record<string, number[]> = {};
    for (const a of answers) {
      if (!a.technique || a.time_from_render_ms == null) continue;
      if (!techniqueTimeMap[a.technique]) techniqueTimeMap[a.technique] = [];
      techniqueTimeMap[a.technique].push(a.time_from_render_ms);
    }
    const medianTimeByTechnique = Object.entries(techniqueTimeMap)
      .filter(([, times]) => times.length >= 10)
      .map(([technique, times]) => ({
        technique,
        medianMs: median(times),
        sample: times.length,
      }))
      .sort((a, b) => a.medianMs - b.medianMs);

    // Bypass rate by technique (phishing cards only — legit cards don't have techniques)
    const techniqueMap: Record<string, { total: number; bypassed: number }> = {};
    for (const a of answers) {
      if (!a.technique || !a.is_phishing) continue;
      if (!techniqueMap[a.technique]) techniqueMap[a.technique] = { total: 0, bypassed: 0 };
      techniqueMap[a.technique].total++;
      if (!a.correct) techniqueMap[a.technique].bypassed++;
    }
    const byTechnique = Object.entries(techniqueMap)
      .filter(([, v]) => v.total >= 10)
      .map(([technique, v]) => ({
        technique,
        total: v.total,
        bypassRate: Math.round((v.bypassed / v.total) * 100),
      }))
      .sort((a, b) => b.bypassRate - a.bypassRate);

    // High fluency (4-5) vs low fluency (0-2) bypass rate
    const highFluency = answers.filter((a) => a.prose_fluency !== null && a.prose_fluency >= 4);
    const lowFluency = answers.filter((a) => a.prose_fluency !== null && a.prose_fluency <= 2);
    const highFluencyBypassRate = highFluency.length
      ? Math.round((highFluency.filter((a) => !a.correct).length / highFluency.length) * 100) : null;
    const lowFluencyBypassRate = lowFluency.length
      ? Math.round((lowFluency.filter((a) => !a.correct).length / lowFluency.length) * 100) : null;

    // GenAI suspected (medium/high confidence) bypass rate
    const genaiAnswers = answers.filter((a) => a.is_genai_suspected && ['medium', 'high'].includes(a.genai_confidence ?? ''));
    const nonGenaiAnswers = answers.filter((a) => a.is_genai_suspected === false);
    const genaiBypassRate = genaiAnswers.length
      ? Math.round((genaiAnswers.filter((a) => !a.correct).length / genaiAnswers.length) * 100) : null;
    const traditionalBypassRate = nonGenaiAnswers.length
      ? Math.round((nonGenaiAnswers.filter((a) => !a.correct).length / nonGenaiAnswers.length) * 100) : null;

    // Confidence calibration
    const byConfidence = (['guessing', 'likely', 'certain'] as const).map((conf) => {
      const subset = answers.filter((a) => a.confidence === conf);
      return {
        confidence: conf,
        total: subset.length,
        accuracyRate: subset.length ? Math.round((subset.filter((a) => a.correct).length / subset.length) * 100) : 0,
      };
    });

    return NextResponse.json({
      totalAnswers: total,
      phishingAnswers: phishingAnswers.length,
      legitAnswers: legitAnswers.length,
      overallBypassRate,
      falsePositiveRate,
      byTechnique,
      fluency: { highFluencyBypassRate, lowFluencyBypassRate, highFluencySample: highFluency.length, lowFluencySample: lowFluency.length },
      genai: { genaiBypassRate, traditionalBypassRate, genaiSample: genaiAnswers.length, traditionalSample: nonGenaiAnswers.length },
      byConfidence,
      toolUsage: {
        headersOpenedPct,
        urlInspectedPct,
        headersOpenedAccuracy,
        headersNotOpenedAccuracy,
        urlInspectedAccuracy,
        urlNotInspectedAccuracy,
        headersOpenedSample: withHeaders.length,
        urlInspectedSample: withUrl.length,
      },
      authTrap: {
        bypassRate: authTrapBypassRate,
        sample: authTrapAnswers.length,
      },
      medianTimeByTechnique,
    });
  } catch (err) {
    console.error('[/api/intel]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
