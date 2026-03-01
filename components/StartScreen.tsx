'use client';

import { useEffect, useState } from 'react';

interface Props {
  onStart: () => void;
}

const BOOT_LINES = [
  '> PHISH_OR_NOT THREAT ANALYZER',
  '> SOC TRAINING MODULE v2.0',
  '> ─────────────────────────────',
  '> LOADING THREAT DATABASE......',
  '> PHISHING SAMPLES: 40 LOADED',
  '> CONFIDENCE SCORING: ENABLED',
  '> STREAK DETECTION: ONLINE',
  '> ─────────────────────────────',
  '> SYSTEM READY.',
];

export function StartScreen({ onStart }: Props) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setVisibleLines((prev) => [...prev, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowButton(true), 300);
      }
    }, 220);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-sm px-4 flex flex-col gap-6">
      {/* Terminal window */}
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
          <span className="text-[#00aa28] text-xs tracking-widest">ANALYST_TERMINAL</span>
          <span className="text-[#00aa28] text-xs">■ □ □</span>
        </div>
        <div className="px-3 py-4 min-h-48 space-y-1">
          {visibleLines.map((line, i) => (
            <div
              key={i}
              className={`anim-fade-in text-xs font-mono leading-relaxed ${
                line.includes('─') || line.includes('READY')
                  ? 'text-[#00ff41]'
                  : 'text-[#00aa28]'
              } ${line.includes('READY') ? 'glow' : ''}`}
            >
              {line}
            </div>
          ))}
          {!showButton && visibleLines.length < BOOT_LINES.length && (
            <span className="cursor" />
          )}
        </div>
      </div>

      {showButton && (
        <div className="anim-fade-in-up space-y-4">
          <div className="term-border bg-[#060c06]">
            <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
              <span className="text-[#00aa28] text-xs tracking-widest">HOW_TO_PLAY</span>
            </div>
            <div className="px-3 py-3 space-y-2.5">
              {[
                ['[1]', 'Read the email or SMS carefully'],
                ['[2]', 'Set your confidence: GUESSING / LIKELY / CERTAIN'],
                ['[3]', 'Classify: PHISHING or LEGIT'],
                ['[4]', 'More confidence + correct = more points'],
                ['[5]', '3-streak bonus: +50 pts per milestone'],
              ].map(([tag, desc]) => (
                <div key={tag} className="flex gap-3 text-xs">
                  <span className="text-[#00ff41] shrink-0 glow">{tag}</span>
                  <span className="text-[#00aa28]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 text-xs font-mono">
            {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => (
              <div
                key={d}
                className={`flex-1 text-center py-1.5 term-border ${
                  d === 'EASY'
                    ? 'text-[#00ff41] border-[rgba(0,255,65,0.4)]'
                    : d === 'MEDIUM'
                    ? 'text-[#ffaa00] border-[rgba(255,170,0,0.4)]'
                    : 'text-[#ff3333] border-[rgba(255,51,51,0.4)]'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          <button
            onClick={onStart}
            className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
          >
            [ INITIALIZE SESSION ]
          </button>

          <p className="text-[#003a0e] text-xs text-center font-mono">
            10 questions per round · email + SMS · randomized
          </p>
        </div>
      )}
    </div>
  );
}
