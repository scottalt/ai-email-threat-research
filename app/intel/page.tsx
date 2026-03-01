import Link from 'next/link';

interface IntelData {
  totalAnswers: number;
  insufficient?: boolean;
  overallBypassRate: number;
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
}

async function getIntel(): Promise<IntelData | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/intel`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
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

        {!data || data.insufficient ? (
          <div className="term-border bg-[#060c06] px-3 py-6 text-center">
            <div className="text-[#00aa28] text-xs font-mono">COLLECTING DATA...</div>
            <div className="text-[#003a0e] text-[10px] font-mono mt-1">Insufficient sample size. Check back once Research Mode is live.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="TOTAL ANSWERS" value={data.totalAnswers.toLocaleString()} />
              <StatBlock label="OVERALL BYPASS RATE" value={`${data.overallBypassRate}%`} sub="phishing not detected" />
            </div>

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

            <div className="term-border bg-[#060c06] px-3 py-3 text-[10px] font-mono text-[#003a0e] space-y-1 leading-relaxed">
              <div className="text-[#00aa28]">METHODOLOGY</div>
              <div>Research Mode only. Anonymous, voluntary. Text-based recognition task — visual cues stripped. Self-selected security-aware sample. GenAI classification is probabilistic based on linguistic characteristics, not ground truth. Sample sizes shown as n=.</div>
              <div className="mt-2">
                Full methodology: <span className="text-[#00aa28]">retro-phish.scottaltiparmak.com/docs/research/methodology</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
