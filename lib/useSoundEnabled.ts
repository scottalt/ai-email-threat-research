import { useState, useCallback } from 'react';

const STORAGE_KEY = 'sfx_enabled';

export function useSoundEnabled() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new CustomEvent('sfx-change', { detail: next }));
      return next;
    });
  }, []);

  return { soundEnabled, toggleSound };
}
