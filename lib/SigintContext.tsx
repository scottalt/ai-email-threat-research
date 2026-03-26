'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Handler } from '@/components/Handler';
import { ALL_DIALOGUES } from '@/lib/sigint-personality';
import { hasSeenMoment, markMomentSeen } from '@/lib/handler-dialogues';

interface SigintContextValue {
  /** Trigger a SIGINT dialogue by moment ID. Only shows once per player (tracked in localStorage). */
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
  const [activeMoment, setActiveMoment] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [buttonText, setButtonText] = useState('CONTINUE');

  const triggerSigint = useCallback((momentId: string) => {
    // Only show each moment once
    if (hasSeenMoment(momentId)) return;

    const dialogue = ALL_DIALOGUES[momentId];
    if (!dialogue) return;

    setLines(dialogue.lines);
    setButtonText(dialogue.buttonText ?? 'CONTINUE');
    setActiveMoment(momentId);
  }, []);

  const handleDismiss = useCallback(() => {
    if (activeMoment) {
      markMomentSeen(activeMoment);
    }
    setActiveMoment(null);
    setLines([]);
  }, [activeMoment]);

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
