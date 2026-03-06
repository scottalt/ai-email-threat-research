import Link from 'next/link';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const revalidate = 300; // re-fetch from Supabase every 5 minutes

interface IntelData {
  totalAnswers: number;
  phishingAnswers?: number;
  legitAnswers?: number;
  insufficient?: boolean;
  overallBypassRate: number;
  falsePositiveRate?: number;
  byTechnique: { technique: string; total: number; bypassRate: number }[];
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
      .select('correct, technique, is_phishing, is_genai_suspected, genai_confidence, prose_fluency, grammar_quality, confidence, time_from_render_ms, difficulty, type, card_source, headers_opened, url_inspected, auth_status, has_reply_to, has_url')
      .eq('game_mode', 'research');

    if (!answers || answers.length === 0) {
      return { totalAnswers: 0, insufficient: true, overallBypassRate: 0, byTechnique: [], fluency: { highFluencyBypassRate: null, lowFluencyBypassRate: null, highFluencySample: 0, lowFluencySample: 0 }, genai: { genaiBypassRate: null, traditionalBypassRate: null, genaiSample: 0, traditionalSample: 0 }, byConfidence: [] };
    }

    const total = answers.length;
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
    for (const a of answers) {
      if (!a.technique || a.time_from_render_ms == null) continue;
      if (!techniqueTimeMap[a.technique]) techniqueTimeMap[a.technique] = [];
      techniqueTimeMap[a.technique].push(a.time_from_render_ms);
    }
    const medianTimeByTechnique = Object.entries(techniqueTimeMap)
      .filter(([, times]) => times.length >= 10)
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
      .filter(([, v]) => v.total >= 10)
      .map(([technique, v]) => ({ technique, total: v.total, bypassRate: Math.round((v.bypassed / v.total) * 100) }))
      .sort((a, b) => b.bypassRate - a.bypassRate);

    const highFluency = answers.filter((a) => a.prose_fluency !== null && a.prose_fluency >= 4);
    const lowFluency = answers.filter((a) => a.prose_fluency !== null && a.prose_fluency <= 2);
    const highFluencyBypassRate = highFluency.length ? Math.round((highFluency.filter((a) => !a.correct).length / highFluency.length) * 100) : null;
    const lowFluencyBypassRate = lowFluency.length ? Math.round((lowFluency.filter((a) => !a.correct).length / lowFluency.length) * 100) : null;

    const genaiAnswers = answers.filter((a) => a.is_genai_suspected && ['medium', 'high'].includes(a.genai_confidence ?? ''));
    const nonGenaiAnswers = answers.filter((a) => a.is_genai_suspected === false);
    const genaiBypassRate = genaiAnswers.length ? Math.round((genaiAnswers.filter((a) => !a.correct).length / genaiAnswers.length) * 100) : null;
    const traditionalBypassRate = nonGenaiAnswers.length ? Math.round((nonGenaiAnswers.filter((a) => !a.correct).length / nonGenaiAnswers.length) * 100) : null;

    const byConfidence = (['guessing', 'likely', 'certain'] as const).map((conf) => {
      const subset = answers.filter((a) => a.confidence === conf);
      return { confidence: conf, total: subset.length, accuracyRate: subset.length ? Math.round((subset.filter((a) => a.correct).length / subset.length) * 100) : 0 };
    });

    return {
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
    };
  } catch {
    return null;
  }
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="term-border bg-[#060c06] px-3 py-3 text-center">
      <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">{label}</div>
      <div className="text-[#00ff41] text-2xl font-black font-mono glow mt-1">{value}</div>
      {sub && <div className="text-[#003a0e] text-[10px] font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function IntelPage() {
  const data = await getIntel();

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-4 mt-8">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">THREAT_INTELLIGENCE</span>
            <Link href="/" className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28]">← TERMINAL</Link>
          </div>
          <div className="px-3 py-3 space-y-1">
            <div className="text-[#00ff41] text-xs font-mono">STATE OF PHISHING IN THE GENAI ERA</div>
            <div className="text-[#003a0e] text-[10px] font-mono">
              Live aggregate findings from the Retro Phish research dataset.
              Answers from Research Mode only. Updated every 5 minutes.
            </div>
          </div>
        </div>

        {!data || data.totalAnswers === 0 ? (
          <div className="term-border bg-[#060c06] px-3 py-6 text-center">
            <div className="text-[#00aa28] text-xs font-mono">COLLECTING DATA...</div>
            <div className="text-[#003a0e] text-[10px] font-mono mt-1">Insufficient sample size. Check back once Research Mode is live.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="TOTAL ANSWERS" value={data.totalAnswers.toLocaleString()} />
              <StatBlock label="PHISHING BYPASS RATE" value={`${data.overallBypassRate}%`} sub="phishing not detected" />
            </div>
            {data.falsePositiveRate !== undefined && (
              <div className="grid grid-cols-2 gap-3">
                <StatBlock
                  label="FALSE POSITIVE RATE"
                  value={`${data.falsePositiveRate}%`}
                  sub="legit flagged as phishing"
                />
                <StatBlock
                  label="PHISHING ANSWERS"
                  value={(data.phishingAnswers ?? 0).toLocaleString()}
                  sub={`legit: ${(data.legitAnswers ?? 0).toLocaleString()}`}
                />
              </div>
            )}

            {(data.fluency.highFluencyBypassRate !== null || data.fluency.lowFluencyBypassRate !== null) && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">PROSE QUALITY vs BYPASS RATE</span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  {data.fluency.highFluencyBypassRate !== null && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#00aa28]">HIGH FLUENCY (4–5/5)</span>
                      <div className="text-right">
                        <span className="text-[#ff3333] font-bold">{data.fluency.highFluencyBypassRate}%</span>
                        <span className="text-[#003a0e] text-[10px] ml-1">n={data.fluency.highFluencySample}</span>
                      </div>
                    </div>
                  )}
                  {data.fluency.lowFluencyBypassRate !== null && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#00aa28]">LOW FLUENCY (0–2/5)</span>
                      <div className="text-right">
                        <span className="text-[#00ff41] font-bold">{data.fluency.lowFluencyBypassRate}%</span>
                        <span className="text-[#003a0e] text-[10px] ml-1">n={data.fluency.lowFluencySample}</span>
                      </div>
                    </div>
                  )}
                  <div className="text-[#003a0e] text-[10px] font-mono pt-1">
                    Higher fluency = harder to detect. GenAI phishing exploits this gap.
                  </div>
                </div>
              </div>
            )}

            {(data.genai.genaiBypassRate !== null || data.genai.traditionalBypassRate !== null) && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">GENAI vs TRADITIONAL PHISHING</span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  {data.genai.genaiBypassRate !== null && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#ffaa00]">GENAI SUSPECTED</span>
                      <div className="text-right">
                        <span className="text-[#ff3333] font-bold">{data.genai.genaiBypassRate}%</span>
                        <span className="text-[#003a0e] text-[10px] ml-1">n={data.genai.genaiSample}</span>
                      </div>
                    </div>
                  )}
                  {data.genai.traditionalBypassRate !== null && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#00aa28]">TRADITIONAL</span>
                      <div className="text-right">
                        <span className="text-[#00ff41] font-bold">{data.genai.traditionalBypassRate}%</span>
                        <span className="text-[#003a0e] text-[10px] ml-1">n={data.genai.traditionalSample}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.byTechnique.length > 0 && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">BYPASS RATE BY TECHNIQUE</span>
                </div>
                <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                  {data.byTechnique.map(({ technique, bypassRate, total }) => (
                    <div key={technique} className="flex items-center px-3 py-2 gap-3">
                      <span className="text-[#00aa28] text-xs font-mono flex-1">{technique}</span>
                      <div className="w-20 h-1 bg-[#003a0e]">
                        <div className="h-full bg-[#ff3333]" style={{ width: `${bypassRate}%` }} />
                      </div>
                      <span className="text-[#ff3333] text-xs font-mono w-8 text-right">{bypassRate}%</span>
                      <span className="text-[#003a0e] text-[10px] font-mono">n={total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.byConfidence.some((c) => c.total > 0) && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">CONFIDENCE CALIBRATION</span>
                </div>
                <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                  {data.byConfidence.map(({ confidence, accuracyRate, total }) => (
                    <div key={confidence} className="flex items-center px-3 py-2 gap-3">
                      <span className="text-[#00aa28] text-xs font-mono flex-1">{confidence.toUpperCase()}</span>
                      <span className="text-[#00ff41] text-xs font-mono">{accuracyRate}% accurate</span>
                      <span className="text-[#003a0e] text-[10px] font-mono">n={total}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 text-[#003a0e] text-[10px] font-mono">
                  Are players who bet CERTAIN actually more accurate?
                </div>
              </div>
            )}

            {data.toolUsage && data.toolUsage.headersOpenedSample >= 10 && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">TOOL_USAGE_CORRELATION</span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="term-border px-2 py-2 text-center">
                      <div className="text-[#00ff41] text-lg font-mono font-bold glow">{data.toolUsage.headersOpenedPct}%</div>
                      <div className="text-[#00aa28] text-[10px] font-mono mt-0.5">opened [HEADERS]</div>
                    </div>
                    <div className="term-border px-2 py-2 text-center">
                      <div className="text-[#00ff41] text-lg font-mono font-bold glow">{data.toolUsage.urlInspectedPct}%</div>
                      <div className="text-[#00aa28] text-[10px] font-mono mt-0.5">inspected URLs</div>
                    </div>
                  </div>
                  {data.toolUsage.headersOpenedAccuracy !== null && data.toolUsage.headersNotOpenedAccuracy !== null && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#00aa28]">accuracy w/ headers open</span>
                        <span className="text-[#00ff41] glow">{data.toolUsage.headersOpenedAccuracy}%</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#00aa28]">accuracy w/o headers open</span>
                        <span className="text-[#ffaa00]">{data.toolUsage.headersNotOpenedAccuracy}%</span>
                      </div>
                      {data.toolUsage.urlInspectedAccuracy !== null && (
                        <>
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-[#00aa28]">accuracy w/ URL inspected</span>
                            <span className="text-[#00ff41] glow">{data.toolUsage.urlInspectedAccuracy}%</span>
                          </div>
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-[#00aa28]">accuracy w/o URL inspected</span>
                            <span className="text-[#ffaa00]">{data.toolUsage.urlNotInspectedAccuracy}%</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.authTrap && data.authTrap.sample >= 10 && data.authTrap.bypassRate !== null && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(255,51,51,0.35)] px-3 py-1.5">
                  <span className="text-[#ff3333] text-xs tracking-widest glow-red">AUTH_TRAP_FINDING</span>
                </div>
                <div className="px-3 py-3">
                  <div className="text-center mb-2">
                    <div className="text-[#ff3333] text-2xl font-mono font-bold glow-red">{data.authTrap.bypassRate}%</div>
                    <div className="text-[#00aa28] text-[10px] font-mono mt-0.5">bypass rate on PASS-headers phishing</div>
                    <div className="text-[#003a0e] text-[10px] font-mono">n={data.authTrap.sample}</div>
                  </div>
                  <p className="text-[#00aa28] text-[10px] font-mono leading-relaxed">
                    Cards where SPF/DKIM/DMARC passed but the email was phishing. Authentication headers alone are insufficient — attackers configure valid auth on lookalike domains.
                  </p>
                </div>
              </div>
            )}

            {data.medianTimeByTechnique && data.medianTimeByTechnique.length > 0 && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">MEDIAN_DECISION_TIME</span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  {(() => {
                    const maxMs = Math.max(...data.medianTimeByTechnique.map((t) => t.medianMs));
                    return data.medianTimeByTechnique.map(({ technique, medianMs }) => {
                      const pct = Math.round((medianMs / maxMs) * 100);
                      const secs = (medianMs / 1000).toFixed(1);
                      return (
                        <div key={technique} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-[#00aa28] truncate">{technique}</span>
                            <span className="text-[#00ff41] shrink-0 ml-2">{secs}s</span>
                          </div>
                          <div className="h-1 bg-[#003a0e] w-full">
                            <div className="h-full bg-[#00aa28]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <p className="text-[#003a0e] text-[10px] font-mono pt-1">Faster decisions may indicate higher confidence — or less investigation.</p>
                </div>
              </div>
            )}

            <div className="term-border bg-[#060c06] px-3 py-3 text-[10px] font-mono text-[#003a0e] space-y-1 leading-relaxed">
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
