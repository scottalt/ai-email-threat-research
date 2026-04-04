'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSupabaseBrowserClient } from './supabase-browser';
import type { PlayerProfile } from './types';
import { setStoragePlayerId, clearAllPlayerStorage, playerSet, playerGet } from './player-storage';

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
        // Set the player ID for scoped storage BEFORE any reads/writes
        setStoragePlayerId(data.id);
        // Merge server seen moments with locally-cached moments not yet persisted
        try {
          const local = JSON.parse(playerGet('handler_moments_seen') ?? '[]') as string[];
          const server = (data.seenMoments ?? []) as string[];
          const merged = [...new Set([...local, ...server])];
          playerSet('handler_moments_seen', JSON.stringify(merged));
          data.seenMoments = merged;
        } catch {
          if (data.seenMoments) {
            playerSet('handler_moments_seen', JSON.stringify(data.seenMoments));
          }
        }
        // Sync audio settings from server to localStorage
        if (typeof data.sfxEnabled === 'boolean') {
          try { localStorage.setItem('sfx_enabled', String(data.sfxEnabled)); } catch {}
          window.dispatchEvent(new CustomEvent('sfx-change', { detail: data.sfxEnabled }));
        }
        if (typeof data.musicEnabled === 'boolean') {
          try { localStorage.setItem('music_enabled', String(data.musicEnabled)); } catch {}
          window.dispatchEvent(new CustomEvent('music-change', { detail: data.musicEnabled }));
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
    // Refresh profile when tab becomes visible again (picks up admin flag changes, etc.)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && profile) refreshProfile();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signInWithEmail(email: string) {
    try {
      // Step 1: Pre-create user (must complete before OTP so new users get a code, not a link)
      const ensureRes = await fetch('/api/auth/ensure-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // existing: true = skip terms, false = show terms, null = ambiguous (skip terms to be safe)
      const data = ensureRes.ok ? await ensureRes.json() : { existing: true };
      const existing = data.existing === false ? false : true;

      // Step 2: Send OTP (now that user is guaranteed to exist in auth)
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
      // Clear all player-scoped storage (both scoped and legacy unscoped keys)
      clearAllPlayerStorage();
      setStoragePlayerId(null);
      // Stop music on sign-out
      window.dispatchEvent(new CustomEvent('music-change', { detail: false }));
      // Reset theme CSS vars immediately (don't wait for React effect cycle)
      const root = document.documentElement;
      root.style.setProperty('--c-primary', '#00ff41');
      root.style.setProperty('--c-secondary', '#3cc462');
      root.style.setProperty('--c-muted', '#237a3a');
      root.style.setProperty('--c-dark', '#0d4a1e');
      root.style.setProperty('--c-bg', '#0a120a');
      root.style.setProperty('--c-bg-alt', '#060e06');
      root.style.setProperty('--c-accent', '#ffaa00');
      root.style.setProperty('--c-accent-dim', '#cc8800');
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
