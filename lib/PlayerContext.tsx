'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSupabaseBrowserClient } from './supabase-browser';
import type { PlayerProfile } from './types';

interface PlayerContextValue {
  profile: PlayerProfile | null;
  loading: boolean;
  signedIn: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null; existing?: boolean }>;
  verifyOtp: (email: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  applyProfile: (p: PlayerProfile) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/player', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        // Store cooldown info in localStorage so StartScreen can show it
        if (data.cooldown) {
          try { localStorage.setItem('xp_cooldown', JSON.stringify(data.cooldown)); } catch {}
        }
        // Merge server seen moments with local cache (local may have moments not yet persisted to DB)
        try {
          const local = JSON.parse(localStorage.getItem('handler_moments_seen') ?? '[]') as string[];
          const server = (data.seenMoments ?? []) as string[];
          const merged = [...new Set([...local, ...server])];
          localStorage.setItem('handler_moments_seen', JSON.stringify(merged));
          // Also merge into the profile data so triggerSigint's profile check works
          data.seenMoments = merged;
        } catch {
          if (data.seenMoments) {
            try { localStorage.setItem('handler_moments_seen', JSON.stringify(data.seenMoments)); } catch {}
          }
        }
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // getUser() validates against the server and triggers token refresh if needed,
    // unlike getSession() which can return a stale cached session.
    supabase.auth.getUser().then(({ data }: { data: { user: unknown } }) => {
      if (data.user) refreshProfile().finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
      // Note: SIGNED_IN fires on page load (session restore) — don't clear session flags here.
      // Caches are cleared in signOut() only. refreshProfile() merges seen moments from server.
      if (session) {
        refreshProfile(); // will re-seed handler_moments_seen from server
        try { localStorage.setItem('terms_agreed', '1'); } catch {}
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshProfile]);

  async function signInWithEmail(email: string) {
    try {
      // Pre-create the user via admin API so Supabase treats them as existing
      // and sends a 6-digit OTP code instead of a confirmation link.
      const ensureRes = await fetch('/api/auth/ensure-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const { existing } = ensureRes.ok ? await ensureRes.json() : { existing: false };

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({ email });
      return { error: error?.message ?? null, existing: !!existing };
    } catch {
      return { error: 'Failed to send code' };
    }
  }

  async function verifyOtp(email: string, code: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (!error) {
        // Revoke all other sessions — enforces single-device login
        fetch('/api/auth/revoke-others', { method: 'POST' }).catch(() => {});
      }
      return { error: error?.message ?? null };
    } catch {
      return { error: 'Verification failed' };
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setProfile(null);
    try {
      localStorage.removeItem('xp_cooldown');
      localStorage.removeItem('handler_moments_seen');
      localStorage.removeItem('terminal_theme');
      sessionStorage.removeItem('sigint_spoke');
      // Reset theme CSS vars immediately (don't wait for React effect cycle)
      const root = document.documentElement;
      root.style.setProperty('--c-primary', '#00ff41');
      root.style.setProperty('--c-secondary', '#33bb55');
      root.style.setProperty('--c-muted', '#1a5c2a');
      root.style.setProperty('--c-dark', '#0d3318');
      root.style.setProperty('--c-bg', '#060c06');
      root.style.setProperty('--c-bg-alt', '#0a140a');
      root.style.setProperty('--c-accent', '#ffaa00');
      root.style.setProperty('--c-accent-dim', '#aa7700');
    } catch {}
  }

  return (
    <PlayerContext.Provider value={{
      profile,
      loading,
      signedIn: !!profile,
      signInWithEmail,
      verifyOtp,
      signOut,
      refreshProfile,
      applyProfile: setProfile,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
