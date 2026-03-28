'use client';

import { useSoundEnabled, useMusicEnabled } from '@/lib/useSoundEnabled';
import { usePlayer } from '@/lib/usePlayer';
import Link from 'next/link';

export default function SettingsPage() {
  const { soundEnabled, toggleSound } = useSoundEnabled();
  const { musicEnabled, toggleMusic } = useMusicEnabled();
  const { signedIn, signOut, refreshProfile } = usePlayer();

  // Save setting to server (fire and forget)
  function saveServerSetting(key: string, value: boolean) {
    fetch('/api/player/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }

  function handleToggleSfx() {
    const next = !soundEnabled;
    toggleSound();
    saveServerSetting('sfxEnabled', next);
  }

  function handleToggleMusic() {
    const next = !musicEnabled;
    toggleMusic();
    saveServerSetting('musicEnabled', next);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-8 lg:pt-16 pb-24 lg:pb-8">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-2">SETTINGS</div>

        {/* Audio */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-4 py-2">
            <span className="text-[var(--c-secondary)] text-xs font-mono tracking-widest">AUDIO</span>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[var(--c-secondary)] text-sm font-mono">Sound Effects</div>
                <div className="text-[var(--c-dark)] text-xs font-mono">Clicks, game sounds, notifications</div>
              </div>
              <button
                onClick={handleToggleSfx}
                className={`px-4 py-1.5 term-border font-mono text-sm tracking-widest transition-all ${
                  soundEnabled
                    ? 'text-[var(--c-primary)] border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)]'
                    : 'text-[var(--c-muted)] border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)]'
                }`}
              >
                {soundEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[var(--c-secondary)] text-sm font-mono">Music</div>
                <div className="text-[var(--c-dark)] text-xs font-mono">Background soundtrack</div>
              </div>
              <button
                onClick={handleToggleMusic}
                className={`px-4 py-1.5 term-border font-mono text-sm tracking-widest transition-all ${
                  musicEnabled
                    ? 'text-[var(--c-primary)] border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)]'
                    : 'text-[var(--c-muted)] border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)]'
                }`}
              >
                {musicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Customization */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-4 py-2">
            <span className="text-[var(--c-secondary)] text-xs font-mono tracking-widest">CUSTOMIZATION</span>
          </div>
          <div className="px-4 py-3 space-y-1">
            <Link
              href="/inventory"
              className="flex items-center justify-between py-2 text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors"
            >
              <span>Themes & Badges</span>
              <span className="text-[var(--c-muted)]">→</span>
            </Link>
            <Link
              href="/profile"
              className="flex items-center justify-between py-2 text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors"
            >
              <span>Edit Profile</span>
              <span className="text-[var(--c-muted)]">→</span>
            </Link>
          </div>
        </div>

        {/* Account */}
        {signedIn && (
          <div className="term-border bg-[var(--c-bg)]">
            <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-4 py-2">
              <span className="text-[var(--c-secondary)] text-xs font-mono tracking-widest">ACCOUNT</span>
            </div>
            <div className="px-4 py-3 space-y-1">
              <button
                onClick={signOut}
                className="w-full py-2 text-[#ff3333] text-sm font-mono tracking-widest hover:bg-[rgba(255,51,51,0.05)] transition-all text-left"
              >
                Sign Out
              </button>
              <Link href="/privacy" className="block py-2 text-[var(--c-muted)] text-sm font-mono hover:text-[var(--c-secondary)] transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="block py-2 text-[var(--c-muted)] text-sm font-mono hover:text-[var(--c-secondary)] transition-colors">
                Terms of Use
              </Link>
            </div>
          </div>
        )}

        {/* Version */}
        <div className="text-center text-[var(--c-dark)] text-xs font-mono pt-2">
          Threat Terminal v2.0.0 · Season 0
        </div>
      </div>
    </main>
  );
}
