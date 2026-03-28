'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlayer } from '@/lib/usePlayer';
import { useNavVisibility } from '@/lib/NavVisibilityContext';
import { useMusicEnabled, useSoundEnabled } from '@/lib/useSoundEnabled';
import { version } from '@/package.json';
import { playerGet, playerSet } from '@/lib/player-storage';

const NAV_LINKS = [
  { label: 'HOME', path: '/play', match: (p: string) => p === '/play' },
  { label: 'PROFILE', path: '/profile', match: (p: string) => p.startsWith('/profile') },
  { label: 'INVENTORY', path: '/inventory', match: (p: string) => p.startsWith('/inventory') },
  { label: 'SHOP', path: '/shop', match: (p: string) => p.startsWith('/shop') },
];

const HIDDEN_PATHS = ['/admin', '/auth', '/intel'];

function shouldHideForPath(pathname: string): boolean {
  if (pathname === '/intel/player') return false;
  return HIDDEN_PATHS.some((p) => pathname.startsWith(p));
}

export function NavBar() {
  const pathname = usePathname();
  const { signedIn } = usePlayer();
  const { navHidden } = useNavVisibility();
  const { musicEnabled, toggleMusic } = useMusicEnabled();
  const { soundEnabled, toggleSound } = useSoundEnabled();

  const [hasUnread, setHasUnread] = useState(false);
  const [pendingFriends, setPendingFriends] = useState(0);
  const [bootSeen, setBootSeen] = useState(true); // default to true (no delay)
  useEffect(() => {
    setHasUnread(playerGet('lastSeenVersion') !== version);
    setBootSeen(sessionStorage.getItem('bootSeen') === '1');
    // Fetch pending friend request count for notification badge (only if signed in)
    if (signedIn) {
      fetch('/api/friends').then(r => r.ok ? r.json() : null).then(data => {
        if (data?.incoming) setPendingFriends(data.incoming.length);
      }).catch(() => {});
    }
  }, [signedIn]);

  if (!signedIn) return null;
  if (navHidden) return null;
  if (shouldHideForPath(pathname)) return null;

  const links = NAV_LINKS;
  const navAnim = bootSeen ? '' : 'animate-[fadeIn_0.5s_ease-in_2s_both]';

  return (
    <>
      {/* Desktop: top bar */}
      <nav className={`hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-[var(--c-bg)] border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-6 py-2.5 items-center justify-between font-mono ${navAnim}`} style={{ boxShadow: '0 2px 12px color-mix(in srgb, var(--c-primary) 6%, transparent)' }}>
        <Link href="/" className="text-[var(--c-primary)] text-[17px] font-bold tracking-widest" style={{ textShadow: '0 0 8px color-mix(in srgb, var(--c-primary) 40%, transparent)' }}>
          THREAT TERMINAL
        </Link>
        <div className="flex items-center gap-6">
          {links.map((link) => {
            const active = link.match(pathname);
            const showDot = link.label === 'PROFILE' && pendingFriends > 0;
            return (
              <Link
                key={link.path}
                href={link.path}
                aria-current={active ? 'page' : undefined}
                className={`relative text-[17px] tracking-wider transition-colors ${
                  active ? 'text-[var(--c-primary)]' : 'text-[var(--c-secondary)] hover:text-[var(--c-primary)]'
                }`}
              >
                {link.label}
                {showDot && (
                  <span className="absolute -top-0.5 -right-2 w-2 h-2 rounded-full bg-[var(--c-accent)] animate-pulse" />
                )}
              </Link>
            );
          })}
          <Link
            href="/changelog"
            onClick={() => { playerSet('lastSeenVersion', version); setHasUnread(false); }}
            className={`relative text-[17px] tracking-wider transition-colors ${
              pathname.startsWith('/changelog') ? 'text-[var(--c-primary)]' : 'text-[var(--c-secondary)] hover:text-[var(--c-primary)]'
            }`}
          >
            WHAT&apos;S NEW
            {hasUnread && (
              <span className="absolute -top-0.5 -right-2 w-2 h-2 rounded-full bg-[var(--c-accent)] animate-pulse" />
            )}
          </Link>
          <button
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute SFX' : 'Enable SFX'}
            className="text-[17px] tracking-wider transition-colors hover:text-[var(--c-primary)]"
          >
            <span className="text-[var(--c-secondary)]">SFX </span>
            {soundEnabled
              ? <span className="text-[var(--c-primary)]">[ON]</span>
              : <span className="text-[var(--c-muted)]">[OFF]</span>
            }
          </button>
          <button
            onClick={toggleMusic}
            aria-label={musicEnabled ? 'Mute music' : 'Enable music'}
            className="text-[17px] tracking-wider transition-colors hover:text-[var(--c-primary)]"
          >
            <span className="text-[var(--c-secondary)]">MUSIC </span>
            {musicEnabled
              ? <span className="text-[var(--c-primary)]">[ON]</span>
              : <span className="text-[var(--c-muted)]">[OFF]</span>
            }
          </button>
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--c-bg)] border-t border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] font-mono ${navAnim}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Audio controls — compact row above nav links */}
        <div className="flex justify-center gap-4 pt-2 pb-0.5">
          <button onClick={toggleSound} className="text-[10px] tracking-widest transition-colors">
            <span className="text-[var(--c-muted)]">SFX </span>
            {soundEnabled ? <span className="text-[var(--c-primary)]">ON</span> : <span className="text-[var(--c-dark)]">OFF</span>}
          </button>
          <button onClick={toggleMusic} className="text-[10px] tracking-widest transition-colors">
            <span className="text-[var(--c-muted)]">MUSIC </span>
            {musicEnabled ? <span className="text-[var(--c-primary)]">ON</span> : <span className="text-[var(--c-dark)]">OFF</span>}
          </button>
        </div>
        <div className="flex justify-around pt-1 pb-2">
          {links.map((link) => {
            const active = link.match(pathname);
            const showDot = link.label === 'PROFILE' && pendingFriends > 0;
            return (
              <Link
                key={link.path}
                href={link.path}
                aria-current={active ? 'page' : undefined}
                className={`relative text-sm tracking-wider transition-colors px-3 py-1.5 ${
                  active ? 'text-[var(--c-primary)] font-bold' : 'text-[var(--c-secondary)]'
                }`}
                style={active ? { textShadow: '0 0 8px color-mix(in srgb, var(--c-primary) 50%, transparent)' } : undefined}
              >
                {link.label}
                {showDot && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[var(--c-accent)] animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
