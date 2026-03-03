'use client';

import { useState } from 'react';

interface AuthFlowProps {
  onSignIn: (email: string) => Promise<{ error: string | null }>;
  onCancel: () => void;
}

export function AuthFlow({ onSignIn, onCancel }: AuthFlowProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { setErrorMsg('Enter a valid email'); setState('error'); return; }
    setState('loading');
    const { error } = await onSignIn(email);
    if (error) { setErrorMsg(error); setState('error'); }
    else setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="term-border bg-[#060c06] px-3 py-6 text-center space-y-2">
        <div className="text-[#00ff41] font-mono font-bold text-sm glow">LINK_SENT</div>
        <div className="text-[#00aa28] text-xs font-mono">Check your inbox for {email}.</div>
        <div className="text-[#003a0e] text-[10px] font-mono">Click the link to activate your profile. This tab will update automatically.</div>
      </div>
    );
  }

  return (
    <div className="term-border bg-[#060c06]">
      <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
        <span className="text-[#00aa28] text-xs tracking-widest">CLAIM_PROFILE</span>
        <button onClick={onCancel} className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28]">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="px-3 py-3 space-y-3">
        <div className="text-[#003a0e] text-[10px] font-mono leading-relaxed">
          No password. We&apos;ll email you a sign-in link. Your XP persists across devices.
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="operator@terminal.sh"
          className="w-full bg-transparent border border-[rgba(0,255,65,0.25)] px-2 py-1.5 text-[#00ff41] font-mono text-xs placeholder:text-[#003a0e] focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
        />
        {state === 'error' && (
          <div className="text-[#ff3333] text-[10px] font-mono">{errorMsg}</div>
        )}
        <button
          type="submit"
          disabled={state === 'loading'}
          className="w-full py-2 term-border text-[#00ff41] font-mono font-bold text-xs tracking-widest hover:bg-[rgba(0,255,65,0.05)] disabled:opacity-40"
        >
          {state === 'loading' ? 'SENDING...' : '[ SEND LINK ]'}
        </button>
      </form>
    </div>
  );
}
