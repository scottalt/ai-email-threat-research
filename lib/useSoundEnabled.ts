import { useState, useCallback, useRef, useEffect } from 'react';

// ── SFX toggle — persisted in localStorage ──
const SFX_KEY = 'sfx_enabled';

function readSfxInitial(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(SFX_KEY);
    return val !== 'false';
  } catch { return true; }
}

export function useSoundEnabled() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    const initial = readSfxInitial();
    soundEnabledRef.current = initial;
    setSoundEnabled(initial);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    try { localStorage.setItem(SFX_KEY, String(next)); } catch {};
  }, []);

  return { soundEnabled, toggleSound };
}

// ── Music toggle — persisted in localStorage ──
const MUSIC_KEY = 'music_enabled';

function readMusicInitial(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(MUSIC_KEY);
    return val !== 'false';
  } catch { return true; }
}

export function useMusicEnabled() {
  const [musicEnabled, setMusicEnabled] = useState(true);
  const musicEnabledRef = useRef(true);

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
