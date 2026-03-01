'use client';

import { useEffect, useState, useCallback } from 'react';

interface LeaderboardEntry {
  name: string;
  score: number;
}

interface Props {
  onStart: () => void;
}

// bright=true → phosphor green + glow (separators, READY line)
const BOOT_LINES: { text: string; bright: boolean }[] = [
  { text: '> PHISH_OR_NOT THREAT ANALYZER', bright: false },
  { text: '> SOC TRAINING MODULE v2.0',     bright: false },
  { text: '> \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', bright: true  },
  { text: '> LOADING THREAT DATABASE......', bright: false },
  { text: '> PHISHING SAMPLES: 40 LOADED',  bright: false },
  { text: '> CONFIDENCE SCORING: ENABLED',  bright: false },
  { text: '> STREAK DETECTION: ONLINE',     bright: false },
  { text: '> \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', bright: true  },
  { text: '> SYSTEM READY.',                bright: true  },
];

export function StartScreen({ onStart }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) setLeaderboard(await res.json());
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev < BOOT_LINES.length) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 220);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (visibleCount === BOOT_LINES.length) {
      const t = setTimeout(() => setShowButton(true), 300);
      return () => clearTimeout(t);
    }
  }, [visibleCount]);

  return (
    <div className="w-full max-w-sm px-4 flex flex-col gap-6">
      {/* Terminal window */}
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
          <span className="text-[#00aa28] text-xs tracking-widest">ANALYST_TERMINAL</span>
          <span className="text-[#00aa28] text-xs">■ □ □</span>
        </div>
        <div className="px-3 py-4 min-h-48 space-y-1">
          {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
            <div
              key={i}
              className={`anim-fade-in text-xs font-mono leading-relaxed ${
                line.bright ? 'text-[#00ff41] glow' : 'text-[#00aa28]'
              }`}
            >
              {line.text}
            </div>
          ))}
          {!showButton && visibleCount < BOOT_LINES.length && (
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

          {leaderboard.length > 0 && (
            <div className="term-border bg-[#060c06]">
              <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
                <span className="text-[#00aa28] text-xs tracking-widest">TOP_ANALYSTS</span>
                <span className="text-[#003a0e] text-xs font-mono">GLOBAL</span>
              </div>
              <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                    <span className={`text-[10px] font-mono w-4 shrink-0 ${i === 0 ? 'text-[#ffaa00]' : 'text-[#003a0e]'}`}>
                      {i + 1}
                    </span>
                    <span className="text-[#00aa28] text-xs font-mono flex-1 truncate">
                      {entry.name}
                    </span>
                    <span className="text-[#00ff41] text-xs font-mono font-bold glow">
                      {entry.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
