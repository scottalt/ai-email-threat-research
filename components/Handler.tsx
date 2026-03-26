'use client';

import { useState, useEffect, useRef } from 'react';
import { Typewriter } from './Typewriter';
import { playBootTick } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

interface Props {
  lines: string[];
  buttonText?: string;
  onDismiss: () => void;
}

/**
 * SIGINT — Terminal AI handler overlay.
 * Shows one message at a time. Player taps NEXT to advance.
 * Final message shows a custom button to dismiss.
 */
export function Handler({ lines, buttonText = 'CONTINUE', onDismiss }: Props) {
  const [currentLine, setCurrentLine] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [started, setStarted] = useState(false);
  const { soundEnabled } = useSoundEnabled();
  const playedEntry = useRef(false);

  // Start after entrance animation settles
  useEffect(() => {
    if (playedEntry.current) return;
    playedEntry.current = true;
    if (soundEnabled) playBootTick();
    const t = setTimeout(() => setStarted(true), 300);
    return () => clearTimeout(t);
  }, [soundEnabled]);

  function handleNext() {
    if (currentLine < lines.length - 1) {
      setTypingDone(false);
      setCurrentLine(currentLine + 1);
    } else {
      onDismiss();
    }
  }

  const isLastLine = currentLine >= lines.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 lg:pt-24 px-4 anim-fade-in" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-sm anim-fade-in-up term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)]"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 30px color-mix(in srgb, var(--c-accent) 10%, transparent)' }}
      >
        {/* Header */}
        <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-3 py-2 flex items-center justify-between">
          <span className="text-[var(--c-accent)] text-sm font-mono tracking-widest font-bold">&gt; SIGINT</span>
          <span className="text-[var(--c-muted)] text-[10px] font-mono tracking-widest border border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-1.5 py-0.5">AI</span>
        </div>

        {/* Single message */}
        <div className="px-4 py-4">
          {started && (
            <div key={currentLine} className="border-l-2 border-[var(--c-accent)] pl-3 min-h-[3rem]">
              <Typewriter
                text={lines[currentLine]}
                speed={20}
                onComplete={() => setTypingDone(true)}
                className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed"
                sound={soundEnabled}
              />
            </div>
          )}
        </div>

        {/* Next / Final button */}
        {typingDone && (
          <div className="px-4 pb-4">
            <button
              onClick={handleNext}
              className="w-full py-2.5 term-border text-[var(--c-accent)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] active:scale-95 transition-all anim-fade-in btn-glow"
            >
              [ {isLastLine ? buttonText : 'NEXT'} ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
