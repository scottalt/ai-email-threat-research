'use client';

import { useState, useEffect, useRef } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import { useSigint } from '@/lib/SigintContext';
import { ACHIEVEMENTS, RARITY_COLORS, type AchievementRarity } from '@/lib/achievements';

interface AdminMessage {
  id: string;
  lines: string[];
  buttonText: string;
  isGlobal: boolean;
  achievementId: string | null;
  createdAt: string;
}

export function AnnouncementBanner() {
  const { signedIn, profile } = usePlayer();
  const { triggerCustom } = useSigint();
  const [allGlobals, setAllGlobals] = useState<AdminMessage[]>([]);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const fetchedRef = useRef(false);

  function markSeen(msg: AdminMessage) {
    fetch('/api/player/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id }),
    }).catch(() => {});
  }

  function substituteVars(line: string): string {
    return line
      .replace(/\{callsign\}/gi, profile?.displayName ?? 'operative')
      .replace(/\{level\}/gi, String(profile?.level ?? 1))
      .replace(/\{xp\}/gi, String(profile?.xp ?? 0));
  }

  useEffect(() => {
    if (!signedIn || fetchedRef.current) return;
    fetchedRef.current = true;

    fetch('/api/player/messages')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.messages?.length) return;
        const msgs = data.messages as AdminMessage[];

        // Queue all targeted messages through SigintContext
        const targeted = msgs.filter((m) => !m.isGlobal);
        for (const msg of targeted) {
          const achDef = msg.achievementId ? ACHIEVEMENTS.find((a) => a.id === msg.achievementId) : null;
          const reveal = achDef ? {
            icon: achDef.icon,
            name: achDef.name,
            description: achDef.description,
            rarity: achDef.rarity,
            color: RARITY_COLORS[achDef.rarity as AchievementRarity],
          } : null;

          triggerCustom(
            msg.lines.map(substituteVars),
            msg.buttonText,
            () => {
              markSeen(msg);
              if (msg.achievementId) {
                fetch('/api/player/messages', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messageId: msg.id, grantAchievement: msg.achievementId }),
                }).catch(() => {});
              }
            },
            reveal,
          );
        }

        // Global messages
        const globals = msgs.filter((m) => m.isGlobal);
        if (globals.length > 0) {
          setAllGlobals(globals);
          setTimeout(() => setBannerVisible(true), 2000);
          // Auto-hide after 60s but DON'T mark as seen — it'll show again next refresh.
          // Only manual dismiss marks as seen permanently.
          setTimeout(() => setBannerDismissed(true), 62000);
        }
      })
      .catch(() => {});
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBannerDismiss() {
    for (const g of allGlobals) markSeen(g);
    setBannerDismissed(true);
  }

  if (!allGlobals.length || bannerDismissed || !bannerVisible) return null;

  // Combine all global lines for display
  const allLines = allGlobals.flatMap((g) => g.lines);
  const tickerText = allGlobals.map((g) => `⚡ ${g.lines.join('  ·  ')}`).join('     ///     ');

  return (
    <>
      {/* Desktop: full banner with all lines visible */}
      <div className="hidden lg:block fixed top-0 left-0 right-0 z-50 anim-fade-in">
        <div className="bg-[var(--c-bg)] border-b-2 border-[var(--c-accent)] shadow-[0_4px_30px_rgba(255,170,0,0.1)]">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-start gap-4">
              {/* Left: SIGINT label */}
              <div className="shrink-0 pt-0.5">
                <span className="text-[var(--c-accent)] text-sm font-mono font-bold tracking-widest">⚡ SIGINT</span>
              </div>

              {/* Center: all message lines */}
              <div className="flex-1 space-y-1">
                {allLines.map((line, i) => (
                  <div key={i} className="text-[var(--c-primary)] text-sm font-mono leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>

              {/* Right: dismiss */}
              <button
                onClick={handleBannerDismiss}
                className="shrink-0 text-[var(--c-muted)] text-xs font-mono hover:text-[var(--c-accent)] transition-colors px-2 py-1"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: scrolling ticker at bottom */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-50 pointer-events-none">
        <div className="bg-[color-mix(in_srgb,var(--c-bg)_92%,transparent)] border-t border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)] backdrop-blur-sm">
          <div className="flex items-center">
            <div className="flex-1 overflow-hidden py-1.5">
              <div className="ticker-scroll whitespace-nowrap text-[var(--c-accent)] text-xs font-mono tracking-wider">
                <span className="inline-block pr-[50vw]">{tickerText}</span>
                <span className="inline-block pr-[50vw]">{tickerText}</span>
              </div>
            </div>
            <button
              onClick={handleBannerDismiss}
              className="pointer-events-auto px-3 py-1.5 text-[var(--c-muted)] text-[10px] font-mono hover:text-[var(--c-accent)] transition-colors shrink-0 border-l border-[color-mix(in_srgb,var(--c-accent)_20%,transparent)]"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
