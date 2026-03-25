import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'sfx_enabled';

function readInitial(): boolean {
  try { return sessionStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
}

export function useSoundEnabled() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(readInitial);
  const sfxEnabledRef = useRef(soundEnabled);

  const toggleSound = useCallback(() => {
    const next = !sfxEnabledRef.current;
    sfxEnabledRef.current = next;
    setSoundEnabled(next);
    sessionStorage.setItem(STORAGE_KEY, String(next));
    // Dispatch synchronously during click handler so audio.play() has user activation
    window.dispatchEvent(new CustomEvent('sfx-change', { detail: next }));
  }, []);

  return { soundEnabled, toggleSound };
}
