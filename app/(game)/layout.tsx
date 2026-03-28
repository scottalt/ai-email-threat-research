'use client';

import { useEffect, useRef } from 'react';
import { TerminalSounds } from '@/components/TerminalSounds';
import { PlayerProvider } from '@/lib/PlayerContext';
import { usePlayer } from '@/lib/usePlayer';
import { NavVisibilityProvider } from '@/lib/NavVisibilityContext';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { SigintProvider } from '@/lib/SigintContext';
import { NavBar } from '@/components/NavBar';
import { DataStream } from '@/components/DataStream';
import { PresenceSync } from '@/components/PresenceSync';
import Link from 'next/link';

/** One-time achievement backfill — fires once per deploy version */
function BackfillTrigger() {
  const triggered = useRef(false);
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    fetch('/api/cron/backfill-achievements').catch(() => {});
  }, []);
  return null;
}

/** Syncs server-stored theme to ThemeContext when profile loads */
function ThemeSync() {
  const { profile, signedIn } = usePlayer();
  const { loadFromServer, resetToDefault } = useTheme();
  const synced = useRef(false);

  useEffect(() => {
    if (!signedIn) {
      // Reset to default phosphor theme on sign-out
      synced.current = false;
      resetToDefault();
      return;
    }
    if (profile?.themeId && !synced.current) {
      loadFromServer(profile.themeId);
      synced.current = true;
    }
  }, [signedIn, profile?.themeId, loadFromServer, resetToDefault]);

  return null;
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="crt-active">
      <TerminalSounds />
      <div className="scanline-sweep" aria-hidden="true" />
      <DataStream />
      <PlayerProvider>
        <ThemeProvider>
          <ThemeSync />
          <BackfillTrigger />
          <PresenceSync />
          <SigintProvider>
          <NavVisibilityProvider>
            <NavBar />
            {children}
            <footer className="py-6 pb-24 lg:pb-6 text-center space-y-2">
              <Link
                href="/intel/player"
                className="inline-block text-[var(--c-secondary)] text-xs font-mono tracking-widest opacity-50 hover:opacity-100 transition-opacity"
              >
                Intel Briefing
              </Link>
              <div className="flex items-center justify-center gap-3 text-[var(--c-muted)] text-xs font-mono opacity-60">
                <Link href="/privacy" className="hover:opacity-100 transition-opacity">Privacy</Link>
                <span>·</span>
                <Link href="/terms" className="hover:opacity-100 transition-opacity">Terms</Link>
                <span>·</span>
                <Link href="/methodology" className="hover:opacity-100 transition-opacity">Methodology</Link>
              </div>
            </footer>
          </NavVisibilityProvider>
          </SigintProvider>
        </ThemeProvider>
      </PlayerProvider>
    </div>
  );
}
