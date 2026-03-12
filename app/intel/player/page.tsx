'use client';

import Link from 'next/link';
import { usePlayer } from '@/lib/PlayerContext';
import { RESEARCH_GRADUATION_SESSIONS, RESEARCH_GRADUATION_ANSWERS } from '@/lib/xp';
import { useEffect, useState } from 'react';

interface IntelData {
  totalAnswers: number;
  phishingAnswers: number;
  legitAnswers: number;
  overallBypassRate: number;
  falsePositiveRate: number;
  byTechnique: { technique: string; total: number; bypassRate: number }[];
  byConfidence: { confidence: string; total: number; accuracyRate: number }[];
  byBackground?: { background: string; total: number; accuracyRate: number }[];
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
  authTrap?: { bypassRate: number | null; sample: number };
  medianTimeByTechnique?: { technique: string; medianMs: number; sample: number }[];
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

const BACKGROUND_LABELS: Record<string, string> = {
  infosec: 'INFOSEC',
  technical: 'TECHNICAL',
  other: 'NON-TECHNICAL',
  prefer_not_to_say: 'UNDISCLOSED',
};

function LockedState({ signedIn, sessionsCompleted, answersSubmitted }: { signedIn: boolean; sessionsCompleted: number; answersSubmitted: number }) {
  const sessionProgress = Math.min(sessionsCompleted / RESEARCH_GRADUATION_SESSIONS, 1);
  const answerProgress = Math.min(answersSubmitted / RESEARCH_GRADUATION_ANSWERS, 1);
  const overallProgress = Math.min(sessionProgress, answerProgress);
  const pct = Math.round(overallProgress * 100);

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4 mt-8">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-sm tracking-widest">INTEL_BRIEFING</span>
            <Link href="/" className="text-[#003a0e] text-sm font-mono hover:text-[#00aa28]">&larr; TERMINAL</Link>
          </div>
          <div className="px-3 py-6 space-y-4 text-center">
            <div className="text-[#00aa28] text-4xl font-mono">&#128274;</div>
            <div className="text-[#00ff41] text-sm font-mono font-bold tracking-wide glow">
              CLASSIFIED: INTEL BRIEFING
            </div>
            <div className="text-[#00aa28] text-sm font-mono leading-relaxed max-w-md mx-auto">
              Complete {RESEARCH_GRADUATION_SESSIONS} research sessions ({RESEARCH_GRADUATION_ANSWERS} answers) to unlock live aggregate findings from all participants.
            </div>

            {signedIn ? (
              <div className="space-y-3 max-w-xs mx-auto">
                <div className="text-[#003a0e] text-sm font-mono">YOUR CLEARANCE PROGRESS</div>
                <div className="h-2 bg-[#003a0e] w-full">
                  <div className="h-full bg-[#00ff41] transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-[#00aa28]">{sessionsCompleted}/{RESEARCH_GRADUATION_SESSIONS} sessions</span>
                  <span className="text-[#00aa28]">{answersSubmitted}/{RESEARCH_GRADUATION_ANSWERS} answers</span>
                </div>
                <Link
                  href="/"
                  className="block w-full py-3 mt-2 term-border-bright text-center text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] transition-all glow"
                >
                  [ CONTINUE RESEARCH ]
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[#003a0e] text-sm font-mono">Sign in and play Research Mode to earn access.</div>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] transition-all glow"
                >
                  [ GO TO TERMINAL ]
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IntelContent({ data, isAdmin }: { data: IntelData; isAdmin: boolean }) {
  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4 mt-8">
        {/* Header */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-sm tracking-widest">INTEL_BRIEFING</span>
            <div className="flex items-center gap-3">
              {isAdmin && <Link href="/intel" className="text-[#003a0e] text-sm font-mono hover:text-[#00aa28]">ADMIN VIEW</Link>}
              <Link href="/" className="text-[#003a0e] text-sm font-mono hover:text-[#00aa28]">&larr; TERMINAL</Link>
            </div>
          </div>
          <div className="px-3 py-3">
            <div className="text-[#00ff41] text-sm font-mono">STATE OF PHISHING IN THE GENAI ERA</div>
            <div className="text-[#003a0e] text-sm font-mono">
              Live aggregate findings from all Research Mode participants.
            </div>
          </div>
        </div>

        {/* Hero stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="TOTAL ANSWERS" value={data.totalAnswers.toLocaleString()} />
          <StatBlock label="PHISHING" value={data.phishingAnswers.toLocaleString()} sub="answers" />
          <StatBlock label="BYPASS RATE" value={`${data.overallBypassRate}%`} sub="phishing missed" highlight={data.overallBypassRate >= 40 ? 'red' : undefined} />
          <StatBlock label="FALSE POSITIVE" value={`${data.falsePositiveRate}%`} sub="legit flagged" highlight={data.falsePositiveRate >= 20 ? 'amber' : undefined} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bypass by technique */}
          {data.byTechnique.length > 0 && (
            <div className="term-border bg-[#060c06]">
              <SectionHeader title="BYPASS RATE BY TECHNIQUE" />
              <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                {data.byTechnique.map(({ technique, bypassRate, total }) => (
                  <BarRow key={technique} label={technique} sub={`n=${total}`} value={`${bypassRate}%`} pct={bypassRate} color="#ff3333" />
                ))}
              </div>
            </div>
          )}

          {/* Confidence calibration */}
          {data.byConfidence.some((c) => c.total > 0) && (
            <div className="term-border bg-[#060c06]">
              <SectionHeader title="CONFIDENCE CALIBRATION" />
              <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                {data.byConfidence.map(({ confidence, accuracyRate, total }) => (
                  <BarRow key={confidence} label={confidence.toUpperCase()} sub={`n=${total}`} value={`${accuracyRate}%`} pct={accuracyRate} color="#00ff41" />
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
                  <BarRow key={background} label={BACKGROUND_LABELS[background] ?? background} sub={`n=${total}`} value={`${accuracyRate}%`} pct={accuracyRate} color="#00ff41" />
                ))}
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
                      <span className="text-[#00aa28]">accuracy w/ headers</span>
                      <span className="text-[#00ff41] glow-soft">{data.toolUsage.headersOpenedAccuracy}%</span>
                    </div>
                    <div className="flex justify-between text-sm font-mono">
                      <span className="text-[#00aa28]">accuracy w/o headers</span>
                      <span className="text-[#ffaa00]">{data.toolUsage.headersNotOpenedAccuracy}%</span>
                    </div>
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
                  <div className="text-[#00aa28] text-sm font-mono mt-0.5">of players fooled</div>
                  <div className="text-[#003a0e] text-sm font-mono">n={data.authTrap.sample}</div>
                </div>
                <p className="text-[#00aa28] text-sm font-mono leading-relaxed">
                  Phishing emails with fully passing auth headers (SPF, DKIM, DMARC all PASS) — the attacker set up valid DNS on a lookalike domain. {data.authTrap.bypassRate}% of players trusted the green checkmarks.
                </p>
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
              </div>
            </div>
          )}
        </div>

        {/* Methodology */}
        <div className="term-border bg-[#060c06] px-3 py-3 text-sm font-mono text-[#003a0e] space-y-1 leading-relaxed">
          <div className="text-[#00aa28]">METHODOLOGY</div>
          <div>Research Mode only. Anonymous, voluntary. Text-based recognition task. Self-selected sample. All cards AI-generated (Claude Haiku + Sonnet). Sample sizes shown as n=.</div>
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
          [ BACK TO TERMINAL ]
        </Link>
      </div>
    </div>
  );
}

export default function PlayerIntelPage() {
  const { profile, loading, signedIn } = usePlayer();
  const [data, setData] = useState<IntelData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const graduated = profile?.researchGraduated ?? false;

  // Check admin status
  useEffect(() => {
    if (!signedIn) return;
    fetch('/api/player/admin-check')
      .then((r) => { if (r.ok) setIsAdmin(true); })
      .catch(() => {});
  }, [signedIn]);

  const canViewIntel = graduated || isAdmin;

  useEffect(() => {
    if (!canViewIntel) return;
    setFetching(true);
    fetch('/api/intel')
      .then((r) => r.json())
      .then((d) => { if (d.totalAnswers) setData(d); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [canViewIntel]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
        <div className="text-[#00aa28] text-sm font-mono tracking-widest animate-pulse">LOADING...</div>
      </div>
    );
  }

  if (!canViewIntel) {
    return (
      <LockedState
        signedIn={signedIn}
        sessionsCompleted={profile?.researchSessionsCompleted ?? 0}
        answersSubmitted={profile?.researchAnswersSubmitted ?? 0}
      />
    );
  }

  if (fetching || !data) {
    return (
      <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
        <div className="text-[#00aa28] text-sm font-mono tracking-widest animate-pulse">DECRYPTING INTEL...</div>
      </div>
    );
  }

  return <IntelContent data={data} isAdmin={isAdmin} />;
}
