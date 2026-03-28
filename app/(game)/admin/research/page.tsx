'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

export default function AdminResearch() {
  const [stats, setStats] = useState<ResearchStats | null>(null);
  const [flags, setFlags] = useState<FlagStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/research-stats').then((r) => r.ok ? r.json() : null),
      fetch('/api/admin/flags').then((r) => r.ok ? r.json() : null),
    ]).then(([s, f]) => {
      if (s) setStats(s);
      if (f) setFlags(f);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-[var(--c-muted)] font-mono text-sm animate-pulse text-center py-8">LOADING...</div>;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {stats && (
        <div className="term-border px-4 py-3">
          <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-3">RESEARCH_PIPELINE</div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'TOTAL ANSWERS', value: stats.totalAnswers, color: 'text-[var(--c-primary)]' },
              { label: 'TODAY', value: stats.answersToday, color: 'text-[var(--c-primary)]' },
              { label: 'SESSIONS', value: stats.distinctSessions, color: 'text-[var(--c-secondary)]' },
              { label: 'ACCURACY', value: `${stats.overallAccuracy}%`, color: stats.overallAccuracy >= 70 ? 'text-[var(--c-primary)]' : 'text-[var(--c-accent)]' },
              { label: 'PLAYERS', value: stats.playerCount, color: 'text-[var(--c-secondary)]' },
              { label: 'GRADUATED', value: stats.graduatedCount, color: 'text-[var(--c-accent)]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`text-lg font-black font-mono ${color}`}>{value}</div>
                <div className="text-[9px] font-mono text-[var(--c-dark)]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technique accuracy */}
      {stats && stats.byTechnique.length > 0 && (
        <div className="term-border px-4 py-3">
          <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-3">TECHNIQUE_ACCURACY</div>
          <div className="space-y-1">
            {stats.byTechnique.map((t) => (
              <div key={t.technique} className="flex items-center justify-between py-1 border-b border-[color-mix(in_srgb,var(--c-primary)_5%,transparent)]">
                <span className="text-[var(--c-secondary)] text-xs font-mono">{t.technique}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--c-muted)] text-[10px] font-mono">n={t.total}</span>
                  <span className={`text-sm font-mono font-bold ${
                    t.accuracy === null ? 'text-[var(--c-dark)]' :
                    t.accuracy >= 80 ? 'text-[var(--c-primary)]' :
                    t.accuracy >= 50 ? 'text-[var(--c-accent)]' :
                    'text-[#ff3333]'
                  }`}>
                    {t.accuracy !== null ? `${t.accuracy}%` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {flags && flags.totalFlags > 0 && (
        <div className="term-border border-[rgba(255,51,51,0.3)] px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#ff3333] text-xs font-mono tracking-widest">PLAYER_FLAGS</span>
            <Link href="/admin/flags" className="text-[var(--c-secondary)] text-xs font-mono hover:text-[var(--c-primary)]">VIEW ALL →</Link>
          </div>
          <div className="text-[#ff3333] font-mono text-sm">{flags.totalFlags} flags on {flags.flaggedCards} cards</div>
          {flags.cards.slice(0, 5).map((c) => (
            <div key={c.card_id} className="text-[var(--c-muted)] text-xs font-mono mt-1">
              {c.card_id.slice(0, 16)}… — {c.count} flags ({Object.keys(c.reasons).join(', ')})
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-2">
        <Link
          href="/admin/research-health"
          className="flex-1 py-3 term-border border-[rgba(0,170,255,0.4)] text-[#00aaff] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,170,255,0.05)] transition-all"
        >
          [ RESEARCH HEALTH CHECK ]
        </Link>
        <Link
          href="/admin/flags"
          className="flex-1 py-3 term-border text-[var(--c-accent)] font-mono text-xs tracking-widest text-center hover:bg-[color-mix(in_srgb,var(--c-accent)_5%,transparent)] transition-all"
        >
          [ ALL FLAGS ]
        </Link>
      </div>
    </div>
  );
}
