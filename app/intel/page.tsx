import Link from 'next/link';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface IntelData {
  totalAnswers: number;
  uniqueParticipants: number;
  phishingAnswers?: number;
  legitAnswers?: number;
  insufficient?: boolean;
  overallBypassRate: number;
  falsePositiveRate?: number;
  byTechnique: { technique: string; total: number; bypassRate: number }[];
  byDifficulty: { difficulty: string; total: number; bypassRate: number }[];
  fluency: {
    highFluencyBypassRate: number | null;
    lowFluencyBypassRate: number | null;
    highFluencySample: number;
    lowFluencySample: number;
  };
  genai: {
    genaiBypassRate: number | null;
    traditionalBypassRate: number | null;
    genaiSample: number;
    traditionalSample: number;
  };
  byConfidence: { confidence: string; total: number; accuracyRate: number }[];
  toolUsage?: {
    headersOpenedPct: number;
    urlInspectedPct: number;
    headersOpenedAccuracy: number | null;
    headersNotOpenedAccuracy: number | null;
    urlInspectedAccuracy: number | null;
    urlNotInspectedAccuracy: number | null;
    headersOpenedSample: number;
    urlInspectedSample: number;
  };
  authTrap?: {
    bypassRate: number | null;
    sample: number;
  };
  medianTimeByTechnique?: { technique: string; medianMs: number; sample: number }[];
  byBackground?: { background: string; total: number; accuracyRate: number }[];
  learningCurve?: { ordinal: number; accuracyRate: number; sample: number }[];
  readingDepth?: {
    deepReadAccuracy: number | null;
    shallowReadAccuracy: number | null;
    deepReadSample: number;
    shallowReadSample: number;
    medianScrollDepth: number | null;
  };
  refreshedAt: string;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function getIntel(): Promise<IntelData | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: answers } = await supabase
      .from('answers')
      .select('correct, technique, is_phishing, is_genai_suspected, genai_confidence, prose_fluency, grammar_quality, confidence, time_from_render_ms, difficulty, type, card_source, headers_opened, url_inspected, auth_status, has_reply_to, has_url, player_id, answer_ordinal, scroll_depth_pct, players!player_id(background)')
      .eq('game_mode', 'research');

    if (!answers || answers.length === 0) {
      return {
        totalAnswers: 0, uniqueParticipants: 0, insufficient: true, overallBypassRate: 0,
        byTechnique: [], byDifficulty: [],
        fluency: { highFluencyBypassRate: null, lowFluencyBypassRate: null, highFluencySample: 0, lowFluencySample: 0 },
        genai: { genaiBypassRate: null, traditionalBypassRate: null, genaiSample: 0, traditionalSample: 0 },
        byConfidence: [],
        refreshedAt: new Date().toISOString(),
      };
    }

    const total = answers.length;
    const uniqueParticipants = new Set(answers.map((a) => a.player_id).filter(Boolean)).size;
    const phishingAnswers = answers.filter((a) => a.is_phishing);
    const legitAnswers = answers.filter((a) => !a.is_phishing);
    const overallBypassRate = phishingAnswers.length ? Math.round((phishingAnswers.filter((a) => !a.correct).length / phishingAnswers.length) * 100) : 0;
    const falsePositiveRate = legitAnswers.length ? Math.round((legitAnswers.filter((a) => !a.correct).length / legitAnswers.length) * 100) : 0;

    const withHeaders = answers.filter((a) => a.headers_opened);
    const withUrl = answers.filter((a) => a.url_inspected);
    const headersOpenedAccuracy = withHeaders.length ? Math.round((withHeaders.filter((a) => a.correct).length / withHeaders.length) * 100) : null;
    const headersNotOpenedAccuracy = (total - withHeaders.length) ? Math.round((answers.filter((a) => !a.headers_opened && a.correct).length / (total - withHeaders.length)) * 100) : null;
    const urlInspectedAccuracy = withUrl.length ? Math.round((withUrl.filter((a) => a.correct).length / withUrl.length) * 100) : null;
    const urlNotInspectedAccuracy = (total - withUrl.length) ? Math.round((answers.filter((a) => !a.url_inspected && a.correct).length / (total - withUrl.length)) * 100) : null;

    const authTrapAnswers = answers.filter((a) => a.is_phishing && a.auth_status === 'verified');
    const authTrapBypassRate = authTrapAnswers.length ? Math.round((authTrapAnswers.filter((a) => !a.correct).length / authTrapAnswers.length) * 100) : null;

    const techniqueTimeMap: Record<string, number[]> = {};
    for (const a of phishingAnswers) {
      if (!a.technique || a.time_from_render_ms == null) continue;
      if (!techniqueTimeMap[a.technique]) techniqueTimeMap[a.technique] = [];
      techniqueTimeMap[a.technique].push(a.time_from_render_ms);
    }
    const medianTimeByTechnique = Object.entries(techniqueTimeMap)
      .filter(([, times]) => times.length >= 1)
      .map(([technique, times]) => ({ technique, medianMs: median(times), sample: times.length }))
      .sort((a, b) => a.medianMs - b.medianMs);

    const techniqueMap: Record<string, { total: number; bypassed: number }> = {};
    for (const a of answers) {
      if (!a.technique || !a.is_phishing) continue;
      if (!techniqueMap[a.technique]) techniqueMap[a.technique] = { total: 0, bypassed: 0 };
      techniqueMap[a.technique].total++;
      if (!a.correct) techniqueMap[a.technique].bypassed++;
    }
    const byTechnique = Object.entries(techniqueMap)
      .filter(([, v]) => v.total >= 1)
      .map(([technique, v]) => ({ technique, total: v.total, bypassRate: Math.round((v.bypassed / v.total) * 100) }))
      .sort((a, b) => b.bypassRate - a.bypassRate);

    const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'extreme'];
    const difficultyMap: Record<string, { total: number; bypassed: number }> = {};
    for (const a of phishingAnswers) {
      if (!a.difficulty) continue;
      if (!difficultyMap[a.difficulty]) difficultyMap[a.difficulty] = { total: 0, bypassed: 0 };
      difficultyMap[a.difficulty].total++;
      if (!a.correct) difficultyMap[a.difficulty].bypassed++;
    }
    const byDifficulty = DIFFICULTY_ORDER
      .filter((d) => difficultyMap[d] && difficultyMap[d].total >= 5)
      .map((d) => ({ difficulty: d, total: difficultyMap[d].total, bypassRate: Math.round((difficultyMap[d].bypassed / difficultyMap[d].total) * 100) }));

    const highFluency = phishingAnswers.filter((a) => a.prose_fluency !== null && a.prose_fluency >= 4);
    const lowFluency = phishingAnswers.filter((a) => a.prose_fluency !== null && a.prose_fluency <= 2);
    const highFluencyBypassRate = highFluency.length ? Math.round((highFluency.filter((a) => !a.correct).length / highFluency.length) * 100) : null;
    const lowFluencyBypassRate = lowFluency.length ? Math.round((lowFluency.filter((a) => !a.correct).length / lowFluency.length) * 100) : null;

    const genaiAnswers = phishingAnswers.filter((a) => a.is_genai_suspected && ['medium', 'high'].includes(a.genai_confidence ?? ''));
    const nonGenaiAnswers = phishingAnswers.filter((a) => a.is_genai_suspected === false);
    const genaiBypassRate = genaiAnswers.length ? Math.round((genaiAnswers.filter((a) => !a.correct).length / genaiAnswers.length) * 100) : null;
    const traditionalBypassRate = nonGenaiAnswers.length ? Math.round((nonGenaiAnswers.filter((a) => !a.correct).length / nonGenaiAnswers.length) * 100) : null;

    const byConfidence = (['guessing', 'likely', 'certain'] as const).map((conf) => {
      const subset = answers.filter((a) => a.confidence === conf);
      return { confidence: conf, total: subset.length, accuracyRate: subset.length ? Math.round((subset.filter((a) => a.correct).length / subset.length) * 100) : 0 };
    });

    // Accuracy by player background
    const BACKGROUND_LABELS: Record<string, string> = {
      infosec: 'INFOSEC',
      technical: 'TECHNICAL',
      other: 'NON-TECHNICAL',
      prefer_not_to_say: 'UNDISCLOSED',
    };
    const bgMap: Record<string, { total: number; correct: number }> = {};
    for (const a of answers) {
      const joined = a.players as unknown as { background: string | null } | { background: string | null }[] | null;
      const player = Array.isArray(joined) ? joined[0] ?? null : joined;
      const bg = player?.background ?? null;
      if (!bg) continue;
      if (!bgMap[bg]) bgMap[bg] = { total: 0, correct: 0 };
      bgMap[bg].total++;
      if (a.correct) bgMap[bg].correct++;
    }
    const byBackground = Object.entries(bgMap)
      .filter(([, v]) => v.total >= 5)
      .map(([bg, v]) => ({
        background: BACKGROUND_LABELS[bg] ?? bg,
        total: v.total,
        accuracyRate: Math.round((v.correct / v.total) * 100),
      }))
      .sort((a, b) => b.accuracyRate - a.accuracyRate);

    // Learning curve: accuracy by answer ordinal (Q1–Q10)
    const ordinalMap: Record<number, { total: number; correct: number }> = {};
    for (const a of answers) {
      const ord = a.answer_ordinal;
      if (ord == null || ord < 1 || ord > 10) continue;
      if (!ordinalMap[ord]) ordinalMap[ord] = { total: 0, correct: 0 };
      ordinalMap[ord].total++;
      if (a.correct) ordinalMap[ord].correct++;
    }
    const learningCurve = Array.from({ length: 10 }, (_, i) => i + 1)
      .filter((ord) => ordinalMap[ord] && ordinalMap[ord].total >= 3)
      .map((ord) => ({
        ordinal: ord,
        accuracyRate: Math.round((ordinalMap[ord].correct / ordinalMap[ord].total) * 100),
        sample: ordinalMap[ord].total,
      }));

    // Reading depth: accuracy by scroll depth
    const deepReads = answers.filter((a) => a.scroll_depth_pct != null && a.scroll_depth_pct >= 75);
    const shallowReads = answers.filter((a) => a.scroll_depth_pct != null && a.scroll_depth_pct < 50);
    const deepReadAccuracy = deepReads.length >= 3 ? Math.round((deepReads.filter((a) => a.correct).length / deepReads.length) * 100) : null;
    const shallowReadAccuracy = shallowReads.length >= 3 ? Math.round((shallowReads.filter((a) => a.correct).length / shallowReads.length) * 100) : null;
    const scrollDepths = answers.map((a) => a.scroll_depth_pct).filter((v): v is number => v != null);
    const medianScrollDepth = scrollDepths.length ? median(scrollDepths) : null;

    return {
      totalAnswers: total,
      uniqueParticipants,
      phishingAnswers: phishingAnswers.length,
      legitAnswers: legitAnswers.length,
      overallBypassRate,
      falsePositiveRate,
      byTechnique,
      byDifficulty,
      fluency: { highFluencyBypassRate, lowFluencyBypassRate, highFluencySample: highFluency.length, lowFluencySample: lowFluency.length },
      genai: { genaiBypassRate, traditionalBypassRate, genaiSample: genaiAnswers.length, traditionalSample: nonGenaiAnswers.length },
      byConfidence,
      byBackground: byBackground.length > 0 ? byBackground : undefined,
      toolUsage: {
        headersOpenedPct: Math.round((withHeaders.length / total) * 100),
        urlInspectedPct: Math.round((withUrl.length / total) * 100),
        headersOpenedAccuracy,
        headersNotOpenedAccuracy,
        urlInspectedAccuracy,
        urlNotInspectedAccuracy,
        headersOpenedSample: withHeaders.length,
        urlInspectedSample: withUrl.length,
      },
      authTrap: { bypassRate: authTrapBypassRate, sample: authTrapAnswers.length },
      medianTimeByTechnique,
      learningCurve: learningCurve.length > 0 ? learningCurve : undefined,
      readingDepth: {
        deepReadAccuracy,
        shallowReadAccuracy,
        deepReadSample: deepReads.length,
        shallowReadSample: shallowReads.length,
        medianScrollDepth,
      },
      refreshedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function StatBlock({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'red' | 'amber' }) {
  const valueColor = highlight === 'red' ? 'text-[#ff3333] glow-red-soft' : highlight === 'amber' ? 'text-[#ffaa00] glow-amber-soft' : 'text-[#00ff41] glow-soft';
  return (
    <div className="term-border bg-[#060c06] px-3 py-3 text-center">
      <div className="text-[#003a0e] text-sm font-mono tracking-widest">{label}</div>
      <div className={`text-2xl font-black font-mono mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-[#003a0e] text-sm font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
      <span className="text-[#00aa28] text-sm tracking-widest">{title}</span>
    </div>
  );
}

function BarRow({ label, value, pct, color, sub }: { label: string; value: string; pct: number; color: string; sub?: string }) {
  return (
    <div className="flex items-center px-3 py-2 gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-[#00aa28] text-sm font-mono">{label}</span>
        {sub && <span className="text-[#003a0e] text-sm font-mono ml-1">{sub}</span>}
      </div>
      <div className="w-24 h-1 bg-[#003a0e] shrink-0">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-mono w-8 text-right shrink-0" style={{ color }}>{value}</span>
    </div>
  );
}

function formatRefreshedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

export default async function IntelPage() {
  const data = await getIntel();

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4 mt-8">

        {/* Header */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-sm tracking-widest">THREAT_INTELLIGENCE</span>
            <Link href="/" className="text-[#003a0e] text-sm font-mono hover:text-[#00aa28]">← TERMINAL</Link>
          </div>
          <div className="px-3 py-3 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[#00ff41] text-sm font-mono">STATE OF PHISHING IN THE GENAI ERA</div>
              <div className="text-[#003a0e] text-sm font-mono">
                Live aggregate findings from the Retro Phish research dataset. Research Mode answers only.
              </div>
            </div>
            {data?.refreshedAt && (
              <div className="text-[#003a0e] text-sm font-mono shrink-0 text-right">
                <div>REFRESHED</div>
                <div className="text-[#00aa28]">{formatRefreshedAt(data.refreshedAt)}</div>
              </div>
            )}
          </div>
        </div>

        {!data || data.totalAnswers === 0 ? (
          <div className="term-border bg-[#060c06] px-3 py-6 text-center">
            <div className="text-[#00aa28] text-sm font-mono">COLLECTING DATA...</div>
            <div className="text-[#003a0e] text-sm font-mono mt-1">Insufficient sample size. Check back once Research Mode is live.</div>
          </div>
        ) : (
          <>
            {/* Hero stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBlock label="TOTAL ANSWERS" value={data.totalAnswers.toLocaleString()} />
              <StatBlock label="PARTICIPANTS" value={data.uniqueParticipants.toLocaleString()} sub="unique analysts" />
              <StatBlock label="BYPASS RATE" value={`${data.overallBypassRate}%`} sub="phishing missed" highlight={data.overallBypassRate >= 40 ? 'red' : undefined} />
              {data.falsePositiveRate !== undefined && (
                <StatBlock label="FALSE POSITIVE" value={`${data.falsePositiveRate}%`} sub="legit flagged" highlight={data.falsePositiveRate >= 20 ? 'amber' : undefined} />
              )}
            </div>

            {/* Phishing/legit split */}
            {data.phishingAnswers !== undefined && (
              <div className="grid grid-cols-2 gap-3">
                <StatBlock label="PHISHING ANSWERS" value={(data.phishingAnswers).toLocaleString()} />
                <StatBlock label="LEGIT ANSWERS" value={(data.legitAnswers ?? 0).toLocaleString()} />
              </div>
            )}

            {/* Two-column layout on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Bypass by technique */}
              {data.byTechnique.length > 0 && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="BYPASS RATE BY TECHNIQUE" />
                  <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                    {data.byTechnique.map(({ technique, bypassRate, total }) => (
                      <BarRow
                        key={technique}
                        label={technique}
                        sub={`n=${total}`}
                        value={`${bypassRate}%`}
                        pct={bypassRate}
                        color="#ff3333"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Bypass by difficulty */}
              {data.byDifficulty.length > 0 && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="BYPASS RATE BY DIFFICULTY" />
                  <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                    {data.byDifficulty.map(({ difficulty, bypassRate, total }) => {
                      const color = difficulty === 'extreme' ? '#ff3333' : difficulty === 'hard' ? '#ffaa00' : difficulty === 'medium' ? '#00aa28' : '#00ff41';
                      return (
                        <BarRow
                          key={difficulty}
                          label={difficulty.toUpperCase()}
                          sub={`n=${total}`}
                          value={`${bypassRate}%`}
                          pct={bypassRate}
                          color={color}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GenAI vs traditional */}
              {(data.genai.genaiBypassRate !== null || data.genai.traditionalBypassRate !== null) && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="GENAI vs TRADITIONAL PHISHING" />
                  <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                    {data.genai.genaiBypassRate !== null && (
                      <BarRow label="GENAI SUSPECTED" sub={`n=${data.genai.genaiSample}`} value={`${data.genai.genaiBypassRate}%`} pct={data.genai.genaiBypassRate} color="#ff3333" />
                    )}
                    {data.genai.traditionalBypassRate !== null && (
                      <BarRow label="TRADITIONAL" sub={`n=${data.genai.traditionalSample}`} value={`${data.genai.traditionalBypassRate}%`} pct={data.genai.traditionalBypassRate} color="#00ff41" />
                    )}
                  </div>
                  <div className="px-3 py-2 text-[#003a0e] text-sm font-mono">
                    Higher fluency = harder to detect. GenAI phishing exploits this gap.
                  </div>
                </div>
              )}

              {/* Prose fluency */}
              {(data.fluency.highFluencyBypassRate !== null || data.fluency.lowFluencyBypassRate !== null) && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="PROSE QUALITY vs BYPASS RATE" />
                  <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                    {data.fluency.highFluencyBypassRate !== null && (
                      <BarRow label="HIGH FLUENCY (4–5/5)" sub={`n=${data.fluency.highFluencySample}`} value={`${data.fluency.highFluencyBypassRate}%`} pct={data.fluency.highFluencyBypassRate} color="#ff3333" />
                    )}
                    {data.fluency.lowFluencyBypassRate !== null && (
                      <BarRow label="LOW FLUENCY (0–2/5)" sub={`n=${data.fluency.lowFluencySample}`} value={`${data.fluency.lowFluencyBypassRate}%`} pct={data.fluency.lowFluencyBypassRate} color="#00ff41" />
                    )}
                  </div>
                </div>
              )}

              {/* Confidence calibration */}
              {data.byConfidence.some((c) => c.total > 0) && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="CONFIDENCE CALIBRATION" />
                  <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                    {data.byConfidence.map(({ confidence, accuracyRate, total }) => (
                      <BarRow
                        key={confidence}
                        label={confidence.toUpperCase()}
                        sub={`n=${total}`}
                        value={`${accuracyRate}%`}
                        pct={accuracyRate}
                        color="#00ff41"
                      />
                    ))}
                  </div>
                  <div className="px-3 py-2 text-[#003a0e] text-sm font-mono">
                    Are players who bet CERTAIN actually more accurate?
                  </div>
                </div>
              )}

              {/* Accuracy by background */}
              {data.byBackground && data.byBackground.length > 0 && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="ACCURACY BY BACKGROUND" />
                  <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                    {data.byBackground.map(({ background, accuracyRate, total }) => (
                      <BarRow
                        key={background}
                        label={background}
                        sub={`n=${total}`}
                        value={`${accuracyRate}%`}
                        pct={accuracyRate}
                        color="#00ff41"
                      />
                    ))}
                  </div>
                  <div className="px-3 py-2 text-[#003a0e] text-sm font-mono">
                    Does security background correlate with phishing detection accuracy?
                  </div>
                </div>
              )}

              {/* Tool usage */}
              {data.toolUsage && data.toolUsage.headersOpenedSample >= 10 && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="TOOL USAGE CORRELATION" />
                  <div className="px-3 py-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="term-border px-2 py-2 text-center">
                        <div className="text-[#00ff41] text-lg font-mono font-bold glow-soft">{data.toolUsage.headersOpenedPct}%</div>
                        <div className="text-[#00aa28] text-sm font-mono mt-0.5">opened [HEADERS]</div>
                      </div>
                      <div className="term-border px-2 py-2 text-center">
                        <div className="text-[#00ff41] text-lg font-mono font-bold glow-soft">{data.toolUsage.urlInspectedPct}%</div>
                        <div className="text-[#00aa28] text-sm font-mono mt-0.5">inspected URLs</div>
                      </div>
                    </div>
                    {data.toolUsage.headersOpenedAccuracy !== null && data.toolUsage.headersNotOpenedAccuracy !== null && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-[#00aa28]">accuracy w/ headers open</span>
                          <span className="text-[#00ff41] glow-soft">{data.toolUsage.headersOpenedAccuracy}%</span>
                        </div>
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-[#00aa28]">accuracy w/o headers</span>
                          <span className="text-[#ffaa00]">{data.toolUsage.headersNotOpenedAccuracy}%</span>
                        </div>
                        {data.toolUsage.urlInspectedAccuracy !== null && (
                          <>
                            <div className="flex justify-between text-sm font-mono">
                              <span className="text-[#00aa28]">accuracy w/ URL inspected</span>
                              <span className="text-[#00ff41] glow-soft">{data.toolUsage.urlInspectedAccuracy}%</span>
                            </div>
                            <div className="flex justify-between text-sm font-mono">
                              <span className="text-[#00aa28]">accuracy w/o URL</span>
                              <span className="text-[#ffaa00]">{data.toolUsage.urlNotInspectedAccuracy}%</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Auth trap */}
              {data.authTrap && data.authTrap.sample >= 10 && data.authTrap.bypassRate !== null && (
                <div className="term-border bg-[#060c06]">
                  <div className="border-b border-[rgba(255,51,51,0.35)] px-3 py-1.5">
                    <span className="text-[#ff3333] text-sm tracking-widest glow-red-soft">AUTH_TRAP_FINDING</span>
                  </div>
                  <div className="px-3 py-3">
                    <div className="text-center mb-2">
                      <div className="text-[#ff3333] text-2xl font-mono font-bold glow-red-soft">{data.authTrap.bypassRate}%</div>
                      <div className="text-[#00aa28] text-sm font-mono mt-0.5">bypass on PASS-headers phishing</div>
                      <div className="text-[#003a0e] text-sm font-mono">n={data.authTrap.sample}</div>
                    </div>
                    <p className="text-[#00aa28] text-sm font-mono leading-relaxed">
                      Cards where SPF/DKIM/DMARC passed but the email was phishing. Authentication headers alone are insufficient — attackers configure valid auth on lookalike domains.
                    </p>
                  </div>
                </div>
              )}

              {/* Learning curve */}
              {data.learningCurve && data.learningCurve.length > 0 && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="LEARNING CURVE (Q1 → Q10)" />
                  <div className="px-3 py-3 space-y-2">
                    {data.learningCurve.map(({ ordinal, accuracyRate, sample }) => (
                      <div key={ordinal} className="space-y-0.5">
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-[#00aa28]">Q{ordinal}</span>
                          <span className="text-[#00ff41] shrink-0 ml-2">{accuracyRate}% <span className="text-[#003a0e]">n={sample}</span></span>
                        </div>
                        <div className="h-1 bg-[#003a0e] w-full">
                          <div className="h-full bg-[#00ff41]" style={{ width: `${accuracyRate}%` }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-[#003a0e] text-sm font-mono pt-1">Do players improve within a single 10-card session?</p>
                  </div>
                </div>
              )}

              {/* Reading depth */}
              {data.readingDepth && (data.readingDepth.deepReadAccuracy !== null || data.readingDepth.shallowReadAccuracy !== null) && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="READING DEPTH vs ACCURACY" />
                  <div className="px-3 py-3 space-y-3">
                    {data.readingDepth.medianScrollDepth !== null && (
                      <div className="term-border px-2 py-2 text-center">
                        <div className="text-[#00ff41] text-lg font-mono font-bold glow-soft">{data.readingDepth.medianScrollDepth}%</div>
                        <div className="text-[#00aa28] text-sm font-mono mt-0.5">median scroll depth</div>
                      </div>
                    )}
                    <div className="space-y-1">
                      {data.readingDepth.deepReadAccuracy !== null && (
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-[#00aa28]">deep read (≥75%)</span>
                          <span><span className="text-[#00ff41] glow-soft">{data.readingDepth.deepReadAccuracy}%</span> <span className="text-[#003a0e] text-sm">n={data.readingDepth.deepReadSample}</span></span>
                        </div>
                      )}
                      {data.readingDepth.shallowReadAccuracy !== null && (
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-[#00aa28]">shallow read (&lt;50%)</span>
                          <span className="text-[#ffaa00]">{data.readingDepth.shallowReadAccuracy}% <span className="text-[#003a0e] text-sm">n={data.readingDepth.shallowReadSample}</span></span>
                        </div>
                      )}
                    </div>
                    <p className="text-[#003a0e] text-sm font-mono">Does scrolling deeper correlate with better accuracy?</p>
                  </div>
                </div>
              )}

              {/* Decision time */}
              {data.medianTimeByTechnique && data.medianTimeByTechnique.length > 0 && (
                <div className="term-border bg-[#060c06]">
                  <SectionHeader title="MEDIAN DECISION TIME" />
                  <div className="px-3 py-3 space-y-2">
                    {(() => {
                      const maxMs = Math.max(...data.medianTimeByTechnique!.map((t) => t.medianMs));
                      return data.medianTimeByTechnique!.map(({ technique, medianMs, sample }) => (
                        <div key={technique} className="space-y-0.5">
                          <div className="flex justify-between text-sm font-mono">
                            <span className="text-[#00aa28] truncate">{technique}</span>
                            <span className="text-[#00ff41] shrink-0 ml-2">{(medianMs / 1000).toFixed(1)}s <span className="text-[#003a0e]">n={sample}</span></span>
                          </div>
                          <div className="h-1 bg-[#003a0e] w-full">
                            <div className="h-full bg-[#00aa28]" style={{ width: `${Math.round((medianMs / maxMs) * 100)}%` }} />
                          </div>
                        </div>
                      ));
                    })()}
                    <p className="text-[#003a0e] text-sm font-mono pt-1">Faster decisions may indicate higher confidence — or less investigation.</p>
                  </div>
                </div>
              )}

            </div>

            {/* Methodology */}
            <div className="term-border bg-[#060c06] px-3 py-3 text-sm font-mono text-[#003a0e] space-y-1 leading-relaxed">
              <div className="text-[#00aa28]">METHODOLOGY</div>
              <div>Research Mode only. Anonymous, voluntary. Text-based recognition task — visual cues stripped. Self-selected security-aware sample. All cards are AI-generated (Claude Haiku + Sonnet). Sample sizes shown as n=.</div>
              <div className="mt-2">
                Full methodology:{' '}
                <Link href="/methodology" className="text-[#00aa28] hover:underline">
                  retro-phish.scottaltiparmak.com/methodology
                </Link>
              </div>
            </div>

            <Link
              href="/"
              className="block w-full py-4 term-border-bright text-center text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
            >
              [ JOIN THE RESEARCH ]
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
