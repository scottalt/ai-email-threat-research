'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { Handler } from '@/components/Handler';
import { ALL_DIALOGUES } from '@/lib/sigint-personality';
import { usePlayer } from '@/lib/usePlayer';

interface SigintContextValue {
  /** Trigger a SIGINT dialogue by moment ID. Only shows once per player (tracked in DB). */
  triggerSigint: (momentId: string) => void;
  /** Whether SIGINT is currently showing */
  isShowing: boolean;
}

const SigintContext = createContext<SigintContextValue>({
  triggerSigint: () => {},
  isShowing: false,
});

export function useSigint() {
  return useContext(SigintContext);
}

export function SigintProvider({ children }: { children: ReactNode }) {
  const { profile, refreshProfile } = usePlayer();
  const [activeMoment, setActiveMoment] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [buttonText, setButtonText] = useState('CONTINUE');
  const queueRef = useRef<string[]>([]);
  // Sync ref to avoid stale closure when multiple triggerSigint calls happen in same render
  const activeRef = useRef<string | null>(null);

  const triggerSigint = useCallback((momentId: string) => {
    // Check DB-backed seen list from profile
    if (profile?.seenMoments?.includes(momentId)) return;
    // Also check localStorage cache (written immediately on dismiss, survives refresh race)
    try {
      const cached = JSON.parse(localStorage.getItem('handler_moments_seen') ?? '[]');
      if (cached.includes(momentId)) return;
    } catch {}
    // Prevent duplicates in queue or active
    if (activeRef.current === momentId) return;
    if (queueRef.current.includes(momentId)) return;

    const dialogue = ALL_DIALOGUES[momentId];
    if (!dialogue) return;

    // If another dialogue is already showing, queue this one
    if (activeRef.current !== null) {
      queueRef.current.push(momentId);
      return;
    }

    activeRef.current = momentId;
    setLines(dialogue.lines);
    setButtonText(dialogue.buttonText ?? 'CONTINUE');
    setActiveMoment(momentId);
  }, [profile?.seenMoments]);

  const showNext = useCallback(() => {
    // Loop to skip invalid IDs without recursion
    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      const dialogue = ALL_DIALOGUES[next];
      if (!dialogue) continue;

      activeRef.current = next;
      setLines(dialogue.lines);
      setButtonText(dialogue.buttonText ?? 'CONTINUE');
      setActiveMoment(next);
      return;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    if (activeRef.current) {
      // Write to localStorage immediately (prevents re-fire on refresh before DB roundtrip)
      try {
        const cached = JSON.parse(localStorage.getItem('handler_moments_seen') ?? '[]');
        if (!cached.includes(activeRef.current)) {
          cached.push(activeRef.current);
          localStorage.setItem('handler_moments_seen', JSON.stringify(cached));
        }
      } catch {}
      // Persist to DB (fire and forget)
      fetch('/api/player/moments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: activeRef.current }),
      }).then(() => refreshProfile()).catch(() => {});
    }
    activeRef.current = null;
    setActiveMoment(null);
    setLines([]);

    // Show next queued dialogue after a brief pause
    setTimeout(showNext, 300);
  }, [refreshProfile, showNext]);

  return (
    <SigintContext.Provider value={{ triggerSigint, isShowing: activeRef.current !== null }}>
      {children}
      {activeMoment && lines.length > 0 && (
        <Handler
          lines={lines}
          buttonText={buttonText}
          onDismiss={handleDismiss}
        />
      )}
    </SigintContext.Provider>
  );
}
