'use client';

import Link from 'next/link';
import { usePlayer } from '@/lib/PlayerContext';
import { RESEARCH_FULL_UNLOCK_ANSWERS } from '@/lib/xp';
import { useEffect, useState } from 'react';

interface IntelData {
  totalAnswers: number;
  uniqueParticipants?: number;
  overallBypassRate: number;
  byBackground?: { background: string; total: number; accuracyRate: number }[];
}

function StatBlock({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'red' | 'amber' }) {
  const valueColor = highlight === 'red' ? 'text-[#ff3333]' : highlight === 'amber' ? 'text-[var(--c-accent)]' : 'text-[var(--c-primary)]';
  return (
    <div className="term-border bg-[var(--c-bg)] px-3 py-3 text-center">
      <div className="text-[var(--c-muted)] text-xs lg:text-base font-mono tracking-wider lg:tracking-widest">{label}</div>
      <div className={`text-2xl font-black font-mono mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-[var(--c-muted)] text-sm lg:text-base font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
      <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">{title}</span>
    </div>
  );
}

function BarRow({ label, value, pct, color, sub }: { label: string; value: string; pct: number; color: string; sub?: string }) {
  return (
    <div className="flex items-center px-3 py-2 lg:py-2.5 gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-[var(--c-secondary)] text-sm lg:text-base font-mono">{label}</span>
        {sub && <span className="text-[var(--c-muted)] text-sm lg:text-base font-mono ml-1">{sub}</span>}
      </div>
      <div className="w-24 lg:w-40 h-1 bg-[var(--c-muted)] shrink-0">
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
  undisclosed: 'UNDISCLOSED',
};

function LockedState({ signedIn, answersSubmitted }: { signedIn: boolean; answersSubmitted: number }) {
  const pct = Math.round(Math.min(answersSubmitted / RESEARCH_FULL_UNLOCK_ANSWERS, 1) * 100);

  return (
    <div className="min-h-screen bg-[var(--c-bg)] p-4 flex flex-col items-center lg:pt-16 pb-20 lg:pb-4">
      <div className="w-full max-w-2xl space-y-4 mt-8">
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">INTEL_BRIEFING</span>
          </div>
          <div className="px-3 py-6 space-y-4 text-center">
            <div className="text-[var(--c-secondary)] text-4xl font-mono">&#128274;</div>
            <div className="text-[var(--c-primary)] text-sm font-mono font-bold tracking-wide">
              CLASSIFIED: INTEL BRIEFING
            </div>
            <div className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed max-w-md mx-auto">
              Submit {RESEARCH_FULL_UNLOCK_ANSWERS} research answers to unlock live aggregate findings from all participants.
            </div>

            {signedIn ? (
              <div className="space-y-3 max-w-xs mx-auto">
                <div className="text-[var(--c-muted)] text-sm font-mono">YOUR CLEARANCE PROGRESS</div>
                <div className="h-2 bg-[var(--c-dark)] w-full">
                  <div className="h-full bg-[var(--c-secondary)] transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[var(--c-secondary)] text-sm font-mono">
                  {answersSubmitted}/{RESEARCH_FULL_UNLOCK_ANSWERS} answers
                </div>
                <Link
                  href="/"
                  className="block w-full py-3 mt-2 term-border text-center text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] transition-all"
                >
                  [ CONTINUE RESEARCH ]
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[var(--c-muted)] text-sm font-mono">Sign in and play Research Mode to earn access.</div>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 term-border text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] transition-all"
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
    <div className="min-h-screen bg-[var(--c-bg)] p-4 flex flex-col items-center lg:pt-16 pb-20 lg:pb-4">
      <div className="w-full max-w-2xl lg:max-w-3xl space-y-4 mt-8">
        {/* Header */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2 flex items-center justify-between">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">INTEL_BRIEFING</span>
            {isAdmin && <Link href="/intel" className="text-[var(--c-muted)] text-sm font-mono hover:text-[var(--c-secondary)]">ADMIN VIEW</Link>}
          </div>
          <div className="px-3 py-3">
            <div className="text-[var(--c-primary)] text-sm font-mono">STATE OF PHISHING IN THE GENAI ERA</div>
            <div className="text-[var(--c-muted)] text-sm font-mono">
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
          <div className="term-border bg-[var(--c-bg)]">
            <SectionHeader title="DETECTION ACCURACY BY BACKGROUND" />
            <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
              {data.byBackground.map(({ background, accuracyRate, total }) => (
                <BarRow key={background} label={BACKGROUND_LABELS[background] ?? background} sub={`n=${total}`} value={`${accuracyRate}%`} pct={accuracyRate} color="var(--c-primary)" />
              ))}
            </div>
            <div className="px-3 py-2 text-[var(--c-muted)] text-sm font-mono">
              Does security background correlate with phishing detection accuracy?
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function PlayerIntelPage() {
  const { profile, loading, signedIn } = usePlayer();
  const [data, setData] = useState<IntelData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const hasEnoughResearch = (profile?.researchAnswersSubmitted ?? 0) >= 20;

  // Check admin status
  useEffect(() => {
    if (!signedIn) return;
    fetch('/api/player/admin-check')
      .then((r) => { if (r.ok) setIsAdmin(true); })
      .catch(() => {});
  }, [signedIn]);

  const canViewIntel = hasEnoughResearch || isAdmin;

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
      <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center lg:pt-16 pb-20 lg:pb-4">
        <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest animate-pulse">LOADING...</div>
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
      <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center lg:pt-16 pb-20 lg:pb-4">
        <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest animate-pulse">DECRYPTING INTEL...</div>
      </div>
    );
  }

  return <IntelContent data={data} isAdmin={isAdmin} />;
}
