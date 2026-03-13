'use client';

import Link from 'next/link';
import { usePlayer } from '@/lib/PlayerContext';
import { RESEARCH_GRADUATION_ANSWERS } from '@/lib/xp';
import { useEffect, useState } from 'react';

interface IntelData {
  totalAnswers: number;
  uniqueParticipants?: number;
  overallBypassRate: number;
  byBackground?: { background: string; total: number; accuracyRate: number }[];
}

function StatBlock({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'red' | 'amber' }) {
  const valueColor = highlight === 'red' ? 'text-[#ff3333]' : highlight === 'amber' ? 'text-[#ffaa00]' : 'text-[#00ff41]';
  return (
    <div className="term-border bg-[#060c06] px-3 py-3 text-center">
      <div className="text-[#1a5c2a] text-sm lg:text-base font-mono tracking-widest">{label}</div>
      <div className={`text-2xl font-black font-mono mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-[#1a5c2a] text-sm lg:text-base font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
      <span className="text-[#33bb55] text-sm lg:text-base tracking-widest">{title}</span>
    </div>
  );
}

function BarRow({ label, value, pct, color, sub }: { label: string; value: string; pct: number; color: string; sub?: string }) {
  return (
    <div className="flex items-center px-3 py-2 lg:py-2.5 gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-[#33bb55] text-sm lg:text-base font-mono">{label}</span>
        {sub && <span className="text-[#1a5c2a] text-sm lg:text-base font-mono ml-1">{sub}</span>}
      </div>
      <div className="w-24 lg:w-40 h-1 bg-[#1a5c2a] shrink-0">
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
  unset: 'UNSET',
};

function LockedState({ signedIn, answersSubmitted }: { signedIn: boolean; answersSubmitted: number }) {
  const pct = Math.round(Math.min(answersSubmitted / RESEARCH_GRADUATION_ANSWERS, 1) * 100);

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4 mt-8">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#33bb55] text-sm tracking-widest">INTEL_BRIEFING</span>
            <Link href="/" className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55]">&larr; TERMINAL</Link>
          </div>
          <div className="px-3 py-6 space-y-4 text-center">
            <div className="text-[#33bb55] text-4xl font-mono">&#128274;</div>
            <div className="text-[#00ff41] text-sm font-mono font-bold tracking-wide">
              CLASSIFIED: INTEL BRIEFING
            </div>
            <div className="text-[#33bb55] text-sm font-mono leading-relaxed max-w-md mx-auto">
              Submit {RESEARCH_GRADUATION_ANSWERS} research answers to unlock live aggregate findings from all participants.
            </div>

            {signedIn ? (
              <div className="space-y-3 max-w-xs mx-auto">
                <div className="text-[#1a5c2a] text-sm font-mono">YOUR CLEARANCE PROGRESS</div>
                <div className="h-2 bg-[#003a0e] w-full">
                  <div className="h-full bg-[#00aa28] transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[#33bb55] text-sm font-mono">
                  {answersSubmitted}/{RESEARCH_GRADUATION_ANSWERS} answers
                </div>
                <Link
                  href="/"
                  className="block w-full py-3 mt-2 term-border text-center text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] transition-all"
                >
                  [ CONTINUE RESEARCH ]
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[#1a5c2a] text-sm font-mono">Sign in and play Research Mode to earn access.</div>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 term-border text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] transition-all"
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
      <div className="w-full max-w-2xl lg:max-w-3xl space-y-4 mt-8">
        {/* Header */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#33bb55] text-sm tracking-widest">INTEL_BRIEFING</span>
            <div className="flex items-center gap-3">
              {isAdmin && <Link href="/intel" className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55]">ADMIN VIEW</Link>}
              <Link href="/" className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55]">&larr; TERMINAL</Link>
            </div>
          </div>
          <div className="px-3 py-3">
            <div className="text-[#00ff41] text-sm font-mono">STATE OF PHISHING IN THE GENAI ERA</div>
            <div className="text-[#1a5c2a] text-sm font-mono">
              Live aggregate findings from all Research Mode participants.
            </div>
          </div>
        </div>

        {/* Hero stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatBlock label="PARTICIPANTS" value={data.uniqueParticipants?.toLocaleString() ?? '—'} sub="unique analysts" />
          <StatBlock label="ANSWERS" value={data.totalAnswers.toLocaleString()} sub="total submitted" />
          <StatBlock label="BYPASS RATE" value={`${data.overallBypassRate}%`} sub="phishing missed" highlight={data.overallBypassRate >= 40 ? 'red' : undefined} />
        </div>

        {/* Accuracy by background */}
        {data.byBackground && data.byBackground.length > 0 && (
          <div className="term-border bg-[#060c06]">
            <SectionHeader title="DETECTION ACCURACY BY BACKGROUND" />
            <div className="divide-y divide-[rgba(0,255,65,0.08)]">
              {data.byBackground.map(({ background, accuracyRate, total }) => (
                <BarRow key={background} label={BACKGROUND_LABELS[background] ?? background} sub={`n=${total}`} value={`${accuracyRate}%`} pct={accuracyRate} color="#00ff41" />
              ))}
            </div>
            <div className="px-3 py-2 text-[#1a5c2a] text-sm font-mono">
              Does security background correlate with phishing detection accuracy?
            </div>
          </div>
        )}

        <Link
          href="/"
          className="block w-full py-4 term-border text-center text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] active:bg-[rgba(0,255,65,0.1)] transition-all"
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
        <div className="text-[#33bb55] text-sm font-mono tracking-widest animate-pulse">LOADING...</div>
      </div>
    );
  }

  if (!canViewIntel) {
    return (
      <LockedState
        signedIn={signedIn}
        answersSubmitted={profile?.researchAnswersSubmitted ?? 0}
      />
    );
  }

  if (fetching || !data) {
    return (
      <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
        <div className="text-[#33bb55] text-sm font-mono tracking-widest animate-pulse">DECRYPTING INTEL...</div>
      </div>
    );
  }

  return <IntelContent data={data} isAdmin={isAdmin} />;
}
