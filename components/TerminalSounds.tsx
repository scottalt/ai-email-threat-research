'use client';

import { useEffect, useRef } from 'react';
import { playClick, playKeyPress } from '@/lib/sounds';

const MUSIC_SRC = '/audio/joelfazhari-synthetic-deception-loopable-epic-cyberpunk-crime-music-157454.mp3';

const SKIP_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'PageUp', 'PageDown', 'Home', 'End', 'Insert',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

function sfxEnabled(): boolean {
  try { return localStorage.getItem('sfx_enabled') === 'true'; } catch { return false; }
}

export function TerminalSounds() {
  const musicRef = useRef<HTMLAudioElement | null>(null);

  // Background music — persists across all routes
  useEffect(() => {
    function startMusic() {
      console.log('[TerminalSounds] startMusic called');
      if (!musicRef.current) {
        const audio = new Audio(MUSIC_SRC);
        audio.loop = true;
        audio.volume = 0.06;
        musicRef.current = audio;
        console.log('[TerminalSounds] Audio element created');
      }
      musicRef.current.play()
        .then(() => console.log('[TerminalSounds] Music playing'))
        .catch((err) => console.warn('[TerminalSounds] Play blocked:', err.message));
    }

    function stopMusic() {
      if (musicRef.current) {
        musicRef.current.pause();
      }
    }

    // Retry on first user gesture to bypass autoplay block
    function handleFirstInteraction() {
      if (sfxEnabled()) {
        if (!musicRef.current) {
          const audio = new Audio(MUSIC_SRC);
          audio.loop = true;
          audio.volume = 0.06;
          musicRef.current = audio;
        }
        if (musicRef.current.paused) {
          musicRef.current.play().then(() => {
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
          }).catch(() => {});
          return;
        }
      }
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    }

    // React to SFX toggle
    function handleSfxChange(e: Event) {
      const enabled = (e as CustomEvent<boolean>).detail;
      console.log('[TerminalSounds] sfx-change event, enabled:', enabled);
      if (enabled) startMusic(); else stopMusic();
    }

    if (sfxEnabled()) startMusic();

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('sfx-change', handleSfxChange);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('sfx-change', handleSfxChange);
      musicRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!sfxEnabled()) return;
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) {
        playClick();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!sfxEnabled()) return;
      if (SKIP_KEYS.has(e.key)) return;
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        playKeyPress();
      }
    }

    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
}
