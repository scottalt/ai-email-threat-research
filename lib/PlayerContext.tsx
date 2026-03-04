'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSupabaseBrowserClient } from './supabase-browser';
import type { PlayerProfile } from './types';

interface PlayerContextValue {
  profile: PlayerProfile | null;
  loading: boolean;
  signedIn: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
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
      if (res.ok) setProfile(await res.json());
      else setProfile(null);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // getUser() validates against the server and triggers token refresh if needed,
    // unlike getSession() which can return a stale cached session.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) refreshProfile().finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) refreshProfile();
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [refreshProfile]);

  async function signInWithEmail(email: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: error?.message ?? null };
    } catch {
      return { error: 'Failed to send magic link' };
    }
  }

  async function verifyOtp(email: string, code: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      return { error: error?.message ?? null };
    } catch {
      return { error: 'Verification failed' };
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setProfile(null);
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
