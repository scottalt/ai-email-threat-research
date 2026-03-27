'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePlayer } from '@/lib/usePlayer';
import { useSigint } from '@/lib/SigintContext';
import { Handler } from '@/components/Handler';
import { PROMO_DIALOGUES } from '@/lib/sigint-personality';
import { ACHIEVEMENTS, RARITY_COLORS, RARITY_BADGE_CLASS } from '@/lib/achievements';

export default function CodesPage() {
  const { profile, loading, signedIn, refreshProfile } = usePlayer();
  const { triggerSigint } = useSigint();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultDialogue, setResultDialogue] = useState<{ lines: string[]; buttonText?: string } | null>(null);
  const [unlockedBadgeId, setUnlockedBadgeId] = useState<string | null>(null);

  // SIGINT: first codes page visit
  const sigintFired = useRef(false);
  useEffect(() => {
    if (signedIn && profile && !sigintFired.current) {
      sigintFired.current = true;
      triggerSigint('first_codes');
    }
  }, [signedIn, profile, triggerSigint]);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setResultDialogue(null);
    setUnlockedBadgeId(null);

    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await res.json();

      if (res.ok) {
        setUnlockedBadgeId(data.badgeId);
        setResultDialogue(PROMO_DIALOGUES.code_success);
        refreshProfile();
        setCode('');
      } else if (data.error === 'ALREADY_REDEEMED') {
        setResultDialogue(PROMO_DIALOGUES.code_already);
      } else if (data.error === 'EXHAUSTED' || data.error === 'EXPIRED') {
        setResultDialogue(data.error === 'EXPIRED' ? PROMO_DIALOGUES.code_expired : PROMO_DIALOGUES.code_exhausted);
      } else if (res.status === 429) {
        setResultDialogue({
          lines: ["Slow down. Too many attempts.", "Try again in a minute."],
          buttonText: "OK",
        });
      } else {
        setResultDialogue(PROMO_DIALOGUES.code_invalid);
      }
    } catch {
      setResultDialogue({
        lines: ["Network error. Couldn't verify the code.", "Check your connection and try again."],
        buttonText: "OK",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const unlockedBadge = unlockedBadgeId ? ACHIEVEMENTS.find(a => a.id === unlockedBadgeId) : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-center justify-center px-4 lg:pt-16 pb-20 lg:pb-8">
        <span className="text-[var(--c-secondary)] text-sm font-mono">LOADING...</span>
      </main>
    );
  }

  if (!signedIn || !profile) {
    return (
      <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-center justify-center px-4 lg:pt-16 pb-20 lg:pb-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center space-y-3">
            <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest">NOT_AUTHENTICATED</div>
            <div className="text-[var(--c-secondary)] text-sm font-mono opacity-70">Sign in to redeem codes.</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-start justify-center px-4 py-8 lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[var(--c-secondary)] text-sm font-mono tracking-wider hover:text-[var(--c-primary)] transition-colors"
          >
            &lt; BACK
          </Link>
          <h1 className="text-[var(--c-accent)] text-sm font-mono tracking-widest font-bold">REDEEM CODE</h1>
          <div className="w-12" />
        </div>

        {/* Code input */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-3 py-2">
            <span className="text-[var(--c-accent)] text-sm font-mono tracking-widest">PROMO_CODE</span>
          </div>
          <form onSubmit={handleRedeem} className="px-4 py-4 space-y-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 30))}
              placeholder="ENTER CODE..."
              className="w-full bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-3 text-[var(--c-primary)] font-mono text-sm tracking-widest text-center focus:outline-none focus:border-[var(--c-accent)] placeholder:text-[var(--c-dark)] transition-colors"
              disabled={submitting}
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting || !code.trim()}
              className="w-full py-3 term-border text-[var(--c-accent)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none btn-glow"
            >
              {submitting ? '[ VERIFYING... ]' : '[ REDEEM ]'}
            </button>
          </form>
        </div>

        {/* Unlocked badge showcase */}
        {unlockedBadge && (
          <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center space-y-3 anim-fade-in-up">
            <div className="text-xs font-mono tracking-widest text-[var(--c-muted)]">BADGE UNLOCKED</div>
            <div
              className={`text-5xl ${RARITY_BADGE_CLASS[unlockedBadge.rarity]}`}
              style={{ color: RARITY_COLORS[unlockedBadge.rarity] }}
            >
              {unlockedBadge.icon}
            </div>
            <div
              className="text-lg font-mono font-black tracking-widest"
              style={{ color: RARITY_COLORS[unlockedBadge.rarity] }}
            >
              {unlockedBadge.name}
            </div>
            <div className="text-sm font-mono text-[var(--c-secondary)]">
              {unlockedBadge.description}
            </div>
            <div
              className="text-xs font-mono tracking-widest font-bold"
              style={{ color: RARITY_COLORS[unlockedBadge.rarity] }}
            >
              {unlockedBadge.rarity.toUpperCase()}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-center space-y-1">
          <p className="text-[var(--c-muted)] text-xs font-mono">
            Promo codes are case-insensitive and limited quantity.
          </p>
          <p className="text-[var(--c-muted)] text-xs font-mono">
            Unlocked badges appear in your inventory.
          </p>
        </div>
      </div>

      {/* SIGINT result dialogue overlay */}
      {resultDialogue && (
        <Handler
          lines={resultDialogue.lines}
          buttonText={resultDialogue.buttonText}
          onDismiss={() => setResultDialogue(null)}
        />
      )}
    </main>
  );
}
