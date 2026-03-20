'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlayer } from '@/lib/usePlayer';
import { CHANGELOG_ENTRIES } from '@/lib/changelog';
import { version } from '@/package.json';

const RECENT_COUNT = 5;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[Number(m) - 1]} ${d}, ${y}`;
}

export default function ChangelogPage() {
  const { signedIn } = usePlayer();
  const [showArchive, setShowArchive] = useState(false);

  const milestones = CHANGELOG_ENTRIES.filter((e) => e.category === 'milestone');
  const updates = [...CHANGELOG_ENTRIES.filter((e) => e.category === 'update')].reverse();
  const recentUpdates = updates.slice(0, RECENT_COUNT);
  const archivedUpdates = updates.slice(RECENT_COUNT);

  return (
    <main className="min-h-screen bg-[var(--c-bg)] p-4 flex flex-col items-center lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-2xl space-y-6 mt-4">

        {/* Back link + Version badge */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-[var(--c-secondary)] hover:text-[var(--c-primary)] text-sm font-mono tracking-wider transition-colors">[ BACK ]</Link>
          <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">THREAT TERMINAL v{version}</span>
        </div>

        {/* Research Timeline — signed-in only */}
        {signedIn && milestones.length > 0 && (
          <div className="term-border bg-[var(--c-bg)]">
            <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
              <span className="text-[var(--c-accent)] text-sm tracking-widest">RESEARCH_TIMELINE</span>
            </div>
            <div className="px-4 py-4 space-y-0">
              {milestones.map((entry, i) => (
                <div key={i} className="flex gap-4">
                  {/* Timeline rail */}
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--c-accent)] mt-1.5 shrink-0" />
                    {i < milestones.length - 1 && (
                      <div className="w-px flex-1 bg-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className={i < milestones.length - 1 ? 'pb-4' : ''}>
                    <div className="text-[var(--c-accent)] text-xs font-mono tracking-wider">{formatDate(entry.date)}</div>
                    <div className="text-[var(--c-primary)] text-sm font-mono mt-0.5">{entry.title}</div>
                    {entry.body && (
                      <div className="text-[var(--c-secondary)] text-sm font-mono mt-1 leading-relaxed">{entry.body}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform Updates — visible to everyone */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">PLATFORM_UPDATES</span>
          </div>
          <div className="px-4 py-4 space-y-4">
            {updates.length === 0 ? (
              <div className="text-[var(--c-muted)] text-sm font-mono">No updates yet.</div>
            ) : (
              <>
                {recentUpdates.map((entry, i) => (
                  <div key={i} className="border-l-2 border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] pl-3">
                    <div className="text-[var(--c-secondary)] text-xs font-mono tracking-wider">{formatDate(entry.date)}</div>
                    <div className="text-[var(--c-primary)] text-sm font-mono mt-0.5">{entry.title}</div>
                    {entry.body && (
                      <div className="text-[var(--c-secondary)] text-sm font-mono mt-1 leading-relaxed">{entry.body}</div>
                    )}
                  </div>
                ))}

                {archivedUpdates.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowArchive(!showArchive)}
                      className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors tracking-wider"
                    >
                      {showArchive ? '[ HIDE ARCHIVE ]' : `[ SHOW ARCHIVE — ${archivedUpdates.length} more ]`}
                    </button>

                    {showArchive && archivedUpdates.map((entry, i) => (
                      <div key={`archive-${i}`} className="border-l-2 border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] pl-3">
                        <div className="text-[var(--c-secondary)] text-xs font-mono tracking-wider">{formatDate(entry.date)}</div>
                        <div className="text-[var(--c-primary)] text-sm font-mono mt-0.5">{entry.title}</div>
                        {entry.body && (
                          <div className="text-[var(--c-secondary)] text-sm font-mono mt-1 leading-relaxed">{entry.body}</div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
