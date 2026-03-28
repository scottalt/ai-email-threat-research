'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function AdminTools() {
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  // Broadcast state
  const [broadcastLines, setBroadcastLines] = useState('');
  const [broadcastButton, setBroadcastButton] = useState('ACKNOWLEDGED');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  async function runBackfill() {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch('/api/admin/backfill-achievements', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const total = data.results?.reduce((sum: number, r: { awarded: string[] }) => sum + (r.awarded?.length ?? 0), 0) ?? 0;
        setBackfillMsg(`Done — ${total} achievements awarded across ${data.results?.length ?? 0} players`);
      } else {
        setBackfillMsg(`Error: ${data.error ?? 'Unknown'}`);
      }
    } catch {
      setBackfillMsg('Request failed');
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Navigation links */}
      <div className="term-border px-4 py-3">
        <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-3">ADMIN_TOOLS</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {[
            { href: '/admin/xp-audit', label: 'XP AUDIT — SPAM DETECTION', color: '#ff3333', border: 'rgba(255,51,51,0.4)' },
            { href: '/admin/preview', label: 'PREVIEW MODE — NO DATA WRITTEN', color: 'var(--c-accent)', border: 'rgba(255,170,0,0.4)' },
            { href: '/admin/live', label: 'LIVE PLAYERS — REAL-TIME PRESENCE', color: 'var(--c-primary)', border: 'color-mix(in srgb, var(--c-primary) 40%, transparent)' },
            { href: '/admin/research-health', label: 'RESEARCH HEALTH — PIPELINE CHECK', color: '#00aaff', border: 'rgba(0,170,255,0.4)' },
            { href: '/admin/flags', label: 'PLAYER FLAGS — REPORTED CARDS', color: 'var(--c-accent)', border: 'rgba(255,170,0,0.4)' },
            { href: '/admin/review', label: 'CARD REVIEW QUEUE (LEGACY)', color: 'var(--c-dark)', border: 'color-mix(in srgb, var(--c-primary) 15%, transparent)' },
            { href: '/admin/approved', label: 'APPROVED CARDS BROWSER', color: 'var(--c-dark)', border: 'color-mix(in srgb, var(--c-primary) 15%, transparent)' },
          ].map(({ href, label, color, border }) => (
            <Link
              key={href}
              href={href}
              className="block py-3 px-4 term-border font-mono text-xs tracking-widest text-center hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)] transition-all"
              style={{ color, borderColor: border }}
            >
              [ {label} ]
            </Link>
          ))}
        </div>
      </div>

      {/* Exports */}
      <div className="term-border px-4 py-3">
        <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-3">DATA_EXPORT</div>
        <div className="space-y-2">
          <div className="text-[var(--c-muted)] text-xs font-mono mb-1">CARDS</div>
          <div className="flex gap-2">
            {['json', 'csv', 'jsonl'].map((fmt) => (
              <Link
                key={`cards-${fmt}`}
                href={`/api/admin/export?format=${fmt}`}
                className="flex-1 py-2 term-border text-[var(--c-secondary)] font-mono text-xs tracking-widest text-center hover:text-[var(--c-primary)] transition-all"
              >
                [ {fmt.toUpperCase()} ]
              </Link>
            ))}
          </div>
          <div className="text-[var(--c-muted)] text-xs font-mono mb-1 mt-3">ANSWERS</div>
          <div className="flex gap-2">
            {['json', 'csv', 'jsonl'].map((fmt) => (
              <Link
                key={`answers-${fmt}`}
                href={`/api/admin/export-answers?format=${fmt}`}
                className="flex-1 py-2 term-border text-[var(--c-accent)] font-mono text-xs tracking-widest text-center hover:text-[var(--c-primary)] transition-all"
              >
                [ {fmt.toUpperCase()} ]
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Global broadcast */}
      <div className="term-border border-[rgba(255,170,0,0.3)] px-4 py-3">
        <div className="text-[var(--c-accent)] text-xs font-mono tracking-widest mb-2">GLOBAL_BROADCAST</div>
        <div className="text-[var(--c-muted)] text-xs font-mono mb-3">
          Shows as a banner at the top of every player&apos;s screen on their next visit. Dismissible.
        </div>
        <textarea
          value={broadcastLines}
          onChange={(e) => setBroadcastLines(e.target.value)}
          placeholder="Banner message (first line shown in the slide-down banner)"
          rows={3}
          className="w-full bg-transparent border border-[color-mix(in_srgb,var(--c-accent)_20%,transparent)] px-3 py-2 text-[var(--c-accent)] font-mono text-sm placeholder:text-[var(--c-dark)] focus:outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] resize-none mb-2"
        />
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[var(--c-secondary)] text-xs font-mono shrink-0">BUTTON</span>
          <input
            type="text"
            value={broadcastButton}
            onChange={(e) => setBroadcastButton(e.target.value)}
            className="flex-1 bg-transparent border border-[color-mix(in_srgb,var(--c-accent)_20%,transparent)] px-2 py-1.5 text-[var(--c-accent)] font-mono text-sm focus:outline-none"
          />
        </div>
        <button
          onClick={async () => {
            const lines = broadcastLines.split('\n').filter((l) => l.trim());
            if (lines.length === 0) return;
            setSendingBroadcast(true);
            setBroadcastMsg(null);
            const res = await fetch('/api/admin/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lines, buttonText: broadcastButton || 'ACKNOWLEDGED' }),
            });
            if (res.ok) { setBroadcastMsg('BROADCAST SENT TO ALL PLAYERS'); setBroadcastLines(''); }
            else setBroadcastMsg('BROADCAST FAILED');
            setSendingBroadcast(false);
          }}
          disabled={sendingBroadcast || !broadcastLines.trim()}
          className="w-full py-3 term-border border-[rgba(255,170,0,0.4)] text-[var(--c-accent)] font-mono text-xs tracking-widest hover:bg-[color-mix(in_srgb,var(--c-accent)_5%,transparent)] disabled:opacity-40 transition-all"
        >
          {sendingBroadcast ? 'SENDING...' : '[ BROADCAST TO ALL PLAYERS ]'}
        </button>
        {broadcastMsg && (
          <div className={`text-xs font-mono mt-2 ${broadcastMsg.includes('FAILED') ? 'text-[#ff3333]' : 'text-[var(--c-primary)]'}`}>
            {broadcastMsg}
          </div>
        )}
      </div>

      {/* Backfill */}
      <div className="term-border px-4 py-3">
        <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-3">ACHIEVEMENT_BACKFILL</div>
        <button
          onClick={runBackfill}
          disabled={backfilling}
          className="w-full py-3 term-border text-[var(--c-accent)] font-mono text-xs tracking-widest hover:bg-[color-mix(in_srgb,var(--c-accent)_5%,transparent)] disabled:opacity-40 transition-all"
        >
          {backfilling ? 'RUNNING...' : '[ BACKFILL ALL PLAYER ACHIEVEMENTS ]'}
        </button>
        {backfillMsg && (
          <div className={`text-xs font-mono mt-2 ${backfillMsg.startsWith('Error') ? 'text-[#ff3333]' : 'text-[var(--c-primary)]'}`}>
            {backfillMsg}
          </div>
        )}
      </div>
    </div>
  );
}
