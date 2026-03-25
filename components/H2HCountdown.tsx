'use client';

import { useState, useEffect, useRef } from 'react';
import { Typewriter } from './Typewriter';
import { playCountdownBeep, playCountdownGo, playMatchFound } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

interface Props {
  opponentName: string;
  onComplete: () => void;
}

/** PvP countdown interstitial — dramatic 3-2-1-GO before match starts */
export function H2HCountdown({ opponentName, onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | '3' | '2' | '1' | 'go'>('intro');
  const { soundEnabled } = useSoundEnabled();
  const completeCalled = useRef(false);

  useEffect(() => {
    if (soundEnabled) playMatchFound();

    const timers = [
      setTimeout(() => setPhase('3'), 1500),
      setTimeout(() => setPhase('2'), 2200),
      setTimeout(() => setPhase('1'), 2900),
      setTimeout(() => setPhase('go'), 3600),
      setTimeout(() => {
        if (!completeCalled.current) {
          completeCalled.current = true;
          onComplete();
        }
      }, 4100),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete, soundEnabled]);

  useEffect(() => {
    if (!soundEnabled) return;
    if (phase === '3' || phase === '2' || phase === '1') playCountdownBeep();
    if (phase === 'go') playCountdownGo();
  }, [phase, soundEnabled]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono">
      {phase === 'intro' && (
        <div className="text-center space-y-3 anim-fade-in-up">
          <div className="text-[var(--c-muted)] text-xs tracking-widest">OPPONENT LOCATED</div>
          <div className="text-[#ff0080] text-xl font-bold tracking-widest">
            <Typewriter text={opponentName} speed={40} />
          </div>
        </div>
      )}

      {(phase === '3' || phase === '2' || phase === '1') && (
        <div key={phase} className="text-8xl font-black text-[var(--c-primary)] anim-countdown-bounce text-glow">
          {phase}
        </div>
      )}

      {phase === 'go' && (
        <div className="text-8xl font-black text-[var(--c-accent)] anim-countdown-go">
          GO
        </div>
      )}
    </div>
  );
}
