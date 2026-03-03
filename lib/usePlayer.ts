'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from './supabase-browser';
import type { PlayerProfile } from './types';

interface UsePlayerReturn {
  profile: PlayerProfile | null;
  loading: boolean;
  signedIn: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  applyProfile: (p: PlayerProfile) => void;
}

export function usePlayer(): UsePlayerReturn {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/player');
      if (res.ok) setProfile(await res.json());
      else setProfile(null);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) refreshProfile().finally(() => setLoading(false));
      else setLoading(false);
    });

    // Listen for sign in / sign out
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

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setProfile(null);
  }

  return {
    profile,
    loading,
    signedIn: !!profile,
    signInWithEmail,
    signOut,
    refreshProfile,
    applyProfile: setProfile,
  };
}
