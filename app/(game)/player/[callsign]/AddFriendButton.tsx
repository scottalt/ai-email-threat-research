'use client';

import { useState } from 'react';

interface Props {
  callsign: string;
  friendshipStatus?: 'none' | 'friends' | 'pending';
}

export function AddFriendButton({ callsign, friendshipStatus = 'none' }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  // Already friends — show status instead of button
  if (friendshipStatus === 'friends') {
    return (
      <div className="text-[var(--c-primary)] text-xs font-mono mt-2 tracking-wider opacity-60">
        FRIENDS ✓
      </div>
    );
  }

  // Request already pending
  if (friendshipStatus === 'pending') {
    return (
      <div className="text-[var(--c-accent)] text-xs font-mono mt-2 tracking-wider opacity-60">
        REQUEST PENDING
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div className="text-[var(--c-primary)] text-sm font-mono mt-2 tracking-wider">
        FRIEND REQUEST SENT
      </div>
    );
  }

  async function handleAdd() {
    setStatus('sending');
    setMsg('');
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCallsign: callsign }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('sent');
      } else {
        setStatus('error');
        setMsg(data.error ?? 'FAILED');
      }
    } catch {
      setStatus('error');
      setMsg('NETWORK ERROR');
    }
  }

  return (
    <div className="mt-3 space-y-1">
      <button
        onClick={handleAdd}
        disabled={status === 'sending'}
        className="px-4 py-1.5 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono text-sm tracking-widest hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] disabled:opacity-40 active:scale-95 transition-all"
      >
        {status === 'sending' ? '...' : '[ ADD FRIEND ]'}
      </button>
      {msg && (
        <div className="text-[#ff3333] text-xs font-mono">{msg}</div>
      )}
    </div>
  );
}
