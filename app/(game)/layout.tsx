'use client';

import { TerminalSounds } from '@/components/TerminalSounds';
import { PlayerProvider } from '@/lib/PlayerContext';
import { NavVisibilityProvider } from '@/lib/NavVisibilityContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { NavBar } from '@/components/NavBar';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="crt-active">
      <TerminalSounds />
      <div className="scanline-sweep" aria-hidden="true" />
      <PlayerProvider>
        <ThemeProvider>
          <NavVisibilityProvider>
            <NavBar />
            {children}
          </NavVisibilityProvider>
        </ThemeProvider>
      </PlayerProvider>
    </div>
  );
}
