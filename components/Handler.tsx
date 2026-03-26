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
 * SIGINT — Terminal AI handler chat box.
 * Messages appear one by one with typewriter effect in a chat-log style.
 */
export function Handler({ lines, buttonText = 'CONTINUE', onDismiss }: Props) {
  const [visibleCount, setVisibleCount] = useState(0); // how many messages are fully shown
  const [typing, setTyping] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const { soundEnabled } = useSoundEnabled();
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Start showing first message after entrance animation
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (soundEnabled) playBootTick();
    // Small delay for entrance animation to settle
    const t = setTimeout(() => setTyping(true), 400);
    return () => clearTimeout(t);
  }, [soundEnabled]);

  // When a message finishes typing, show next one after a pause
  function handleMessageComplete() {
    setTyping(false);
    const nextIdx = visibleCount + 1;
    setVisibleCount(nextIdx);

    if (nextIdx >= lines.length) {
      // All messages done — show button after brief pause
      setTimeout(() => setShowButton(true), 300);
    } else {
      // Show next message after pause
      setTimeout(() => setTyping(true), 400);
    }
  }

  // Auto-scroll to bottom as new messages appear
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [visibleCount, typing]);

  return (
    <div className="anim-fade-in-up w-full max-w-md mx-auto">
      <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)]">
        {/* Header */}
        <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[var(--c-accent)] text-sm font-mono tracking-widest font-bold">&gt; SIGINT</span>
          </div>
          <span className="text-[var(--c-muted)] text-[10px] font-mono tracking-widest border border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-1.5 py-0.5">AI</span>
        </div>

        {/* Chat messages */}
        <div ref={scrollRef} className="px-4 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {/* Already shown messages */}
          {lines.slice(0, visibleCount).map((line, i) => (
            <div key={i} className="border-l-2 border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)] pl-3">
              <p className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed">{line}</p>
            </div>
          ))}

          {/* Currently typing message */}
          {typing && visibleCount < lines.length && (
            <div className="border-l-2 border-[var(--c-accent)] pl-3">
              <Typewriter
                text={lines[visibleCount]}
                speed={25}
                onComplete={handleMessageComplete}
                className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed"
                sound={soundEnabled}
              />
            </div>
          )}
        </div>

        {/* Continue button */}
        {showButton && (
          <div className="px-4 pb-4">
            <button
              onClick={onDismiss}
              className="w-full py-3 term-border text-[var(--c-accent)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] active:scale-95 transition-all anim-fade-in btn-glow"
            >
              [ {buttonText} ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
