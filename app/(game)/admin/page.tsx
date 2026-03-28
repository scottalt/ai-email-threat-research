'use client';

import { useState, useEffect } from 'react';

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  needsReview: number;
  liveCards: number;
  targetCards: number;
}

interface ResearchStats {
  totalAnswers: number;
  answersToday: number;
  distinctSessions: number;
  overallAccuracy: number;
  playerCount: number;
  graduatedCount: number;
  byTechnique: { technique: string; total: number; correct: number; accuracy: number | null }[];
}

interface FlagStats {
  totalFlags: number;
  flaggedCards: number;
  cards: { card_id: string; count: number; reasons: Record<string, number> }[];
}

const POLL_INTERVAL = 15000;

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [researchStats, setResearchStats] = useState<ResearchStats | null>(null);
  const [flagStats, setFlagStats] = useState<FlagStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchStats() {
    try {
      const [statsRes, researchRes, flagsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/research-stats'),
        fetch('/api/admin/flags'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (researchRes.ok) setResearchStats(await researchRes.json());
      if (flagsRes.ok) setFlagStats(await flagsRes.json());
      setLastUpdated(new Date());
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const progress = stats ? Math.round((stats.liveCards / stats.targetCards) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Timestamp */}
      {lastUpdated && (
        <div className="text-right text-[var(--c-dark)] text-[10px] font-mono">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* Card pipeline + research stats in a wider grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'LIVE CARDS', value: stats?.liveCards ?? '—', color: 'text-[var(--c-primary)]' },
          { label: 'PENDING', value: stats?.pending ?? '—', color: 'text-[var(--c-accent)]' },
          { label: 'PLAYERS', value: researchStats?.playerCount ?? '—', color: 'text-[var(--c-primary)]' },
          { label: 'GRADUATED', value: researchStats?.graduatedCount ?? '—', color: 'text-[var(--c-accent)]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="term-border px-3 py-3 text-center">
            <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
            <div className="text-[10px] font-mono text-[var(--c-dark)] mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Dataset progress */}
      {stats && (
        <div className="term-border px-4 py-3">
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-[var(--c-secondary)]">DATASET</span>
            <span className="text-[var(--c-primary)]">{stats.liveCards} / {stats.targetCards} ({progress}%)</span>
          </div>
          <div className="w-full h-2 bg-[var(--c-bg-alt)] overflow-hidden">
            <div
              className="h-full bg-[var(--c-primary)] transition-all duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Research stats */}
      {researchStats && (
        <div className="term-border px-4 py-3">
          <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-3">RESEARCH_DATA</div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'TOTAL ANSWERS', value: researchStats.totalAnswers, color: 'text-[var(--c-primary)]' },
              { label: 'TODAY', value: researchStats.answersToday, color: 'text-[var(--c-primary)]' },
              { label: 'SESSIONS', value: researchStats.distinctSessions, color: 'text-[var(--c-secondary)]' },
              { label: 'ACCURACY', value: `${researchStats.overallAccuracy}%`, color: researchStats.overallAccuracy >= 70 ? 'text-[var(--c-primary)]' : 'text-[var(--c-accent)]' },
              { label: 'PLAYERS', value: researchStats.playerCount, color: 'text-[var(--c-secondary)]' },
              { label: 'GRADUATED', value: researchStats.graduatedCount, color: 'text-[var(--c-accent)]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`text-lg font-black font-mono ${color}`}>{value}</div>
                <div className="text-[9px] font-mono text-[var(--c-dark)]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags alert */}
      {flagStats && flagStats.totalFlags > 0 && (
        <div className="term-border border-[rgba(255,51,51,0.3)] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[#ff3333] text-xs font-mono tracking-widest">PLAYER_FLAGS</span>
            <span className="text-[#ff3333] font-mono font-bold">{flagStats.totalFlags} flags on {flagStats.flaggedCards} cards</span>
          </div>
          {flagStats.cards.slice(0, 3).map((c) => (
            <div key={c.card_id} className="text-[var(--c-muted)] text-xs font-mono mt-1">
              {c.card_id.slice(0, 12)}… — {c.count} flags ({Object.keys(c.reasons).join(', ')})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
