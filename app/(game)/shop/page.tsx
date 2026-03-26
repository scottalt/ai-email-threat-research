'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSigint } from '@/lib/SigintContext';

export default function ShopPage() {
  const { triggerSigint } = useSigint();

  // SIGINT: first shop visit (fire once per mount)
  const sigintFired = useRef(false);
  useEffect(() => {
    if (!sigintFired.current) {
      sigintFired.current = true;
      triggerSigint('first_shop');
    }
  }, [triggerSigint]);
  return (
    <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-start justify-center px-4 py-8 lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[var(--c-secondary)] text-sm font-mono tracking-wider hover:text-[var(--c-primary)] transition-colors"
          >
            &lt; BACK
          </Link>
          <h1 className="text-[#ff0080] text-sm font-mono tracking-widest font-bold">SHOP</h1>
          <div className="w-12" />
        </div>

        {/* Coming Soon */}
        <div className="term-border bg-[var(--c-bg)] px-6 py-12 text-center space-y-6">
          <div className="text-5xl">🏪</div>
          <div className="space-y-2">
            <div className="text-[#ff0080] text-2xl font-mono font-black tracking-widest">COMING SOON</div>
            <div className="text-[var(--c-secondary)] text-sm font-mono">SEASON 1</div>
          </div>
          <div className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed max-w-md mx-auto">
            Earn coins through gameplay. Spend them on exclusive themes, badges, titles, and cosmetics your opponents will see in PvP matches.
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-4">
            <div className="term-border px-3 py-3 text-center opacity-50">
              <div className="text-lg mb-1">🎨</div>
              <div className="text-[var(--c-muted)] text-xs font-mono">THEMES</div>
            </div>
            <div className="term-border px-3 py-3 text-center opacity-50">
              <div className="text-lg mb-1">🏅</div>
              <div className="text-[var(--c-muted)] text-xs font-mono">BADGES</div>
            </div>
            <div className="term-border px-3 py-3 text-center opacity-50">
              <div className="text-lg mb-1">✨</div>
              <div className="text-[var(--c-muted)] text-xs font-mono">COSMETICS</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
