'use client';

import { useState, useEffect, useRef } from 'react';
import { Typewriter } from './Typewriter';
import { playBootTick } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

export interface AchievementReveal {
  icon: string;
  name: string;
  description: string;
  rarity: string;
  color: string;
}

interface Props {
  lines: string[];
  buttonText?: string;
  onDismiss: () => void;
  achievementReveal?: AchievementReveal | null;
}

/**
 * SIGINT — Terminal AI handler overlay.
 * Shows one message at a time. Player taps NEXT to advance.
 * Final message shows a custom button to dismiss.
 */
export function Handler({ lines: rawLines, buttonText = 'CONTINUE', onDismiss, achievementReveal }: Props) {
  // Guard against undefined/empty lines (prevents crash if dialogue key is missing)
  const lines = rawLines?.length ? rawLines : ['...'];
  const [currentLine, setCurrentLine] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const { soundEnabled } = useSoundEnabled();

  // Play entry sound on mount only
  useEffect(() => {
    if (soundEnabled) playBootTick();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="fixed inset-0 z-[100] overflow-y-auto anim-fade-in">
      {/* Subtle vignette — darkens edges, keeps center visible, feels layered */}
      <div className="fixed inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.45) 100%)' }} aria-hidden="true" />

      {/* Scroll container — centers dialog, ensures it's always reachable */}
      <div className="min-h-full flex items-center lg:items-start justify-center px-4 py-8 lg:pt-32">
      {/* Dialog box */}
      <div
        className="w-full max-w-sm relative anim-fade-in-up sigint-box term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_60%,transparent)]"
      >
        {/* Header */}
        <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-3 py-2 flex items-center justify-between">
          <span className="text-[var(--c-accent)] text-sm font-mono tracking-widest font-bold">&gt; SIGINT</span>
          <span className="sigint-ai-tag text-[var(--c-muted)] text-[10px] font-mono tracking-widest border border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-1.5 py-0.5">AI</span>
        </div>

        {/* Scanning accent line — animates while typing, static when done */}
        <div className={typingDone ? 'sigint-scanline-done' : 'sigint-scanline'} />

        {/* Single message */}
        <div className="px-4 py-4">
          <div
            key={currentLine}
            className={`border-l-2 border-[var(--c-accent)] pl-3 min-h-[3rem] ${!typingDone ? 'sigint-typing-border' : ''}`}
          >
            <Typewriter
              text={lines[currentLine]}
              speed={20}
              delay={200}
              onComplete={() => setTypingDone(true)}
              className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed"
              sound={soundEnabled}
            />
          </div>
        </div>

        {/* Achievement reveal — shows on last line when typing is done */}
        {typingDone && isLastLine && achievementReveal && (
          <div className="px-4 pb-2 anim-fade-in-up">
            <div
              className="border-2 px-4 py-4 text-center space-y-2"
              style={{
                borderColor: achievementReveal.color,
                boxShadow: `0 0 20px ${achievementReveal.color}40, 0 0 60px ${achievementReveal.color}15, inset 0 0 30px ${achievementReveal.color}08`,
              }}
            >
              <div className="text-[var(--c-muted)] text-[10px] font-mono tracking-[0.3em]">ACHIEVEMENT UNLOCKED</div>
              <div
                className="text-4xl py-2"
                style={{
                  color: achievementReveal.color,
                  textShadow: `0 0 12px ${achievementReveal.color}90, 0 0 30px ${achievementReveal.color}40, 0 0 60px ${achievementReveal.color}20`,
                  animation: 'badge-mythic-shimmer 2.5s ease-in-out infinite',
                }}
              >
                {achievementReveal.icon}
              </div>
              <div
                className="text-lg font-mono font-black tracking-widest"
                style={{
                  color: achievementReveal.color,
                  textShadow: `0 0 8px ${achievementReveal.color}60, 0 0 20px ${achievementReveal.color}25`,
                }}
              >
                {achievementReveal.name}
              </div>
              <div className="text-[var(--c-secondary)] text-xs font-mono leading-relaxed">
                {achievementReveal.description}
              </div>
              <div
                className="text-[10px] font-mono tracking-[0.2em] uppercase mt-1"
                style={{ color: achievementReveal.color }}
              >
                {achievementReveal.rarity}
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
}
