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
    <main className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-2xl space-y-6 mt-4">

        {/* Back link + Version badge */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-[#33bb55] hover:text-[#00ff41] text-sm font-mono tracking-wider transition-colors">[ BACK ]</Link>
          <span className="text-[#1a5c2a] text-xs font-mono tracking-widest">THREAT TERMINAL v{version}</span>
        </div>

        {/* Research Timeline — signed-in only */}
        {signedIn && milestones.length > 0 && (
          <div className="term-border bg-[#060c06]">
            <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
              <span className="text-[#ffaa00] text-sm tracking-widest">RESEARCH_TIMELINE</span>
            </div>
            <div className="px-4 py-4 space-y-0">
              {milestones.map((entry, i) => (
                <div key={i} className="flex gap-4">
                  {/* Timeline rail */}
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-[#ffaa00] mt-1.5 shrink-0" />
                    {i < milestones.length - 1 && (
                      <div className="w-px flex-1 bg-[rgba(255,170,0,0.3)] my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className={i < milestones.length - 1 ? 'pb-4' : ''}>
                    <div className="text-[#ffaa00] text-xs font-mono tracking-wider">{formatDate(entry.date)}</div>
                    <div className="text-[#00ff41] text-sm font-mono mt-0.5">{entry.title}</div>
                    {entry.body && (
                      <div className="text-[#00aa28] text-sm font-mono mt-1 leading-relaxed">{entry.body}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform Updates — visible to everyone */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#33bb55] text-sm tracking-widest">PLATFORM_UPDATES</span>
          </div>
          <div className="px-4 py-4 space-y-4">
            {updates.length === 0 ? (
              <div className="text-[#1a5c2a] text-sm font-mono">No updates yet.</div>
            ) : (
              <>
                {recentUpdates.map((entry, i) => (
                  <div key={i} className="border-l-2 border-[rgba(0,255,65,0.25)] pl-3">
                    <div className="text-[#33bb55] text-xs font-mono tracking-wider">{formatDate(entry.date)}</div>
                    <div className="text-[#00ff41] text-sm font-mono mt-0.5">{entry.title}</div>
                    {entry.body && (
                      <div className="text-[#00aa28] text-sm font-mono mt-1 leading-relaxed">{entry.body}</div>
                    )}
                  </div>
                ))}

                {archivedUpdates.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowArchive(!showArchive)}
                      className="text-[#33bb55] text-sm font-mono hover:text-[#00ff41] transition-colors tracking-wider"
                    >
                      {showArchive ? '[ HIDE ARCHIVE ]' : `[ SHOW ARCHIVE — ${archivedUpdates.length} more ]`}
                    </button>

                    {showArchive && archivedUpdates.map((entry, i) => (
                      <div key={`archive-${i}`} className="border-l-2 border-[rgba(0,255,65,0.15)] pl-3">
                        <div className="text-[#33bb55] text-xs font-mono tracking-wider">{formatDate(entry.date)}</div>
                        <div className="text-[#00ff41] text-sm font-mono mt-0.5">{entry.title}</div>
                        {entry.body && (
                          <div className="text-[#00aa28] text-sm font-mono mt-1 leading-relaxed">{entry.body}</div>
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
