'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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

  const triggerSigint = useCallback((momentId: string) => {
    // Check DB-backed seen list from profile
    if (profile?.seenMoments?.includes(momentId)) return;

    const dialogue = ALL_DIALOGUES[momentId];
    if (!dialogue) return;

    setLines(dialogue.lines);
    setButtonText(dialogue.buttonText ?? 'CONTINUE');
    setActiveMoment(momentId);
  }, [profile?.seenMoments]);

  const handleDismiss = useCallback(() => {
    if (activeMoment) {
      // Persist to DB (fire and forget)
      fetch('/api/player/moments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: activeMoment }),
      }).then(() => refreshProfile()).catch(() => {});
    }
    setActiveMoment(null);
    setLines([]);
  }, [activeMoment, refreshProfile]);

  return (
    <SigintContext.Provider value={{ triggerSigint, isShowing: activeMoment !== null }}>
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
