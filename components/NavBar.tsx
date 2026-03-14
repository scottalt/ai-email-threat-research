'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlayer } from '@/lib/usePlayer';
import { useNavVisibility } from '@/lib/NavVisibilityContext';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

const NAV_LINKS = [
  { label: 'HOME', path: '/', match: (p: string) => p === '/' },
  { label: 'STATS', path: '/stats', match: (p: string) => p.startsWith('/stats') },
  { label: 'INTEL', path: '/intel/player', match: (p: string) => p.startsWith('/intel') },
  { label: 'PROFILE', path: '/profile', match: (p: string) => p.startsWith('/profile') },
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
  const { soundEnabled, toggleSound } = useSoundEnabled();

  if (!signedIn) return null;
  if (navHidden) return null;
  if (shouldHideForPath(pathname)) return null;

  const links = NAV_LINKS;

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-[#060c06] border-b border-[rgba(0,255,65,0.35)] px-6 py-2.5 items-center justify-between font-mono animate-[fadeIn_0.5s_ease-in_2s_both]" style={{ boxShadow: '0 2px 12px rgba(0, 255, 65, 0.06)' }}>
        <Link href="/" className="text-[#00ff41] text-sm font-bold tracking-widest" style={{ textShadow: '0 0 8px rgba(0, 255, 65, 0.4)' }}>
          THREAT TERMINAL
        </Link>
        <div className="flex items-center gap-6">
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.path}
                href={link.path}
                aria-current={active ? 'page' : undefined}
                className={`text-sm tracking-wider transition-colors ${
                  active ? 'text-[#00ff41]' : 'text-[#1a5c2a] hover:text-[#33bb55]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/changelog"
            className={`text-sm tracking-wider transition-colors ${
              pathname.startsWith('/changelog') ? 'text-[#00ff41]' : 'text-[#1a5c2a] hover:text-[#33bb55]'
            }`}
          >
            WHAT&apos;S NEW
          </Link>
          <button
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            className={`text-sm transition-colors ${soundEnabled ? 'text-[#00ff41]' : 'text-[#1a5c2a] hover:text-[#33bb55]'}`}
          >
            {soundEnabled ? '[SFX]' : '[SFX OFF]'}
          </button>
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#060c06] border-t border-[rgba(0,255,65,0.35)] font-mono animate-[fadeIn_0.5s_ease-in_2s_both]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around py-2.5">
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.path}
                href={link.path}
                aria-current={active ? 'page' : undefined}
                className={`text-sm tracking-wider transition-colors px-3 py-1.5 ${
                  active ? 'text-[#00ff41] font-bold' : 'text-[#4a9a5a]'
                }`}
                style={active ? { textShadow: '0 0 8px rgba(0, 255, 65, 0.5)' } : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
