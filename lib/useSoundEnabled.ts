import { useState, useCallback, useRef, useEffect } from 'react';

// SFX are always on — no toggle needed.
// This hook is kept for backward compatibility with components that check soundEnabled.
export function useSoundEnabled() {
  return { soundEnabled: true, toggleSound: () => {} };
}

// Music toggle — persisted in localStorage
const MUSIC_KEY = 'music_enabled';

function readMusicInitial(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(MUSIC_KEY);
    // Default to ON if never set
    return val !== 'false';
  } catch { return true; }
}

export function useMusicEnabled() {
  const [musicEnabled, setMusicEnabled] = useState(true);
  const musicEnabledRef = useRef(true);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const initial = readMusicInitial();
    musicEnabledRef.current = initial;
    setMusicEnabled(initial);
  }, []);

  const toggleMusic = useCallback(() => {
    const next = !musicEnabledRef.current;
    musicEnabledRef.current = next;
    setMusicEnabled(next);
    try { localStorage.setItem(MUSIC_KEY, String(next)); } catch {}
    window.dispatchEvent(new CustomEvent('music-change', { detail: next }));
  }, []);

  return { musicEnabled, toggleMusic };
}
