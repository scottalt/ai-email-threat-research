'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

interface SentMessage {
  id: string;
  targetPlayerId: string | null;
  targetName: string | null;
  lines: string[];
  buttonText: string;
  createdAt: string;
  seenCount: number;
  isGlobal: boolean;
  archived: boolean;
}

export default function AdminTools() {
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  // Broadcast state
  const [broadcastLines, setBroadcastLines] = useState('');
  const [broadcastButton, setBroadcastButton] = useState('ACKNOWLEDGED');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  // Sent messages state
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [msgFilter, setMsgFilter] = useState<'all' | 'global' | 'targeted' | 'archived'>('all');
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  const fetchMessages = useCallback(() => {
    setLoadingMsgs(true);
    const params = msgFilter !== 'all' ? `?filter=${msgFilter}` : '';
    fetch(`/api/admin/messages${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSentMessages(d.messages); })
      .finally(() => setLoadingMsgs(false));
  }, [msgFilter]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  async function archiveMessage(id: string, archived: boolean) {
    await fetch('/api/admin/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, archived }),
    });
    fetchMessages();
  }

  async function deleteMessage(id: string) {
    await fetch('/api/admin/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchMessages();
  }

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

      {/* Sent messages */}
      <div className="term-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[var(--c-secondary)] text-xs font-mono tracking-widest">SENT_MESSAGES</span>
          <div className="flex gap-1">
            {(['all', 'global', 'targeted', 'archived'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setMsgFilter(f)}
                className={`px-2 py-0.5 font-mono text-[10px] tracking-widest transition-all ${
                  msgFilter === f
                    ? 'text-[var(--c-primary)] border border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)]'
                    : 'text-[var(--c-muted)] hover:text-[var(--c-secondary)] border border-transparent'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {loadingMsgs ? (
          <div className="text-[var(--c-muted)] text-xs font-mono animate-pulse py-4 text-center">LOADING...</div>
        ) : sentMessages.length === 0 ? (
          <div className="text-[var(--c-muted)] text-xs font-mono py-4 text-center">No messages</div>
        ) : (
          <div className="space-y-2">
            {sentMessages.map((msg) => (
              <div
                key={msg.id}
                className={`border px-3 py-2 space-y-1 ${
                  msg.archived
                    ? 'border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] opacity-60'
                    : msg.isGlobal
                    ? 'border-[rgba(255,170,0,0.3)]'
                    : 'border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono tracking-widest px-1.5 py-0.5 border ${
                      msg.isGlobal ? 'text-[var(--c-accent)] border-[rgba(255,170,0,0.3)]' : 'text-[var(--c-secondary)] border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]'
                    }`}>
                      {msg.isGlobal ? 'GLOBAL' : 'TARGETED'}
                    </span>
                    {msg.targetName && <span className="text-[var(--c-primary)] text-xs font-mono">→ {msg.targetName}</span>}
                    {msg.archived && <span className="text-[var(--c-dark)] text-[10px] font-mono">ARCHIVED</span>}
                  </div>
                  <span className="text-[var(--c-muted)] text-xs font-mono">{msg.seenCount} seen</span>
                </div>

                <div className="text-[var(--c-secondary)] text-xs font-mono truncate">{msg.lines[0]}</div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--c-dark)] text-[10px] font-mono">{new Date(msg.createdAt).toLocaleString()}</span>
                  <div className="flex gap-2">
                    {msg.archived ? (
                      <button onClick={() => archiveMessage(msg.id, false)} className="text-[var(--c-secondary)] text-[10px] font-mono hover:text-[var(--c-primary)]">RESTORE</button>
                    ) : (
                      <button onClick={() => archiveMessage(msg.id, true)} className="text-[var(--c-accent)] text-[10px] font-mono hover:underline">ARCHIVE</button>
                    )}
                    <button onClick={() => deleteMessage(msg.id)} className="text-[#ff3333] text-[10px] font-mono hover:underline">DELETE</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
