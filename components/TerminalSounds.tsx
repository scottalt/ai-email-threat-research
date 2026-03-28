'use client';

import { useEffect, useRef } from 'react';
import { playClick, playKeyPress } from '@/lib/sounds';

const MUSIC_SRC = '/audio/joelfazhari-synthetic-deception-loopable-epic-cyberpunk-crime-music-157454.mp3';
const MUSIC_GAIN = 0.04;

const SKIP_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'PageUp', 'PageDown', 'Home', 'End', 'Insert',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

function musicEnabled(): boolean {
  try { return localStorage.getItem('music_enabled') !== 'false'; } catch { return true; }
}

function sfxEnabled(): boolean {
  try { return localStorage.getItem('sfx_enabled') !== 'false'; } catch { return true; }
}

interface MusicState {
  audio: HTMLAudioElement;
  ctx: AudioContext;
  gain: GainNode;
}

function createMusic(): MusicState {
  const audio = new Audio(MUSIC_SRC);
  audio.loop = true;
  audio.crossOrigin = 'anonymous';
  const ctx = new AudioContext();
  const source = ctx.createMediaElementSource(audio);
  const gain = ctx.createGain();
  gain.gain.value = MUSIC_GAIN;
  source.connect(gain);
  gain.connect(ctx.destination);
  return { audio, ctx, gain };
}

export function TerminalSounds() {
  const musicRef = useRef<MusicState | null>(null);

  // Background music
  useEffect(() => {
    function startMusic() {
      if (!musicRef.current) musicRef.current = createMusic();
      const { audio, ctx } = musicRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => audio.play()).catch(() => {});
      } else {
        audio.play().catch(() => {});
      }
    }

    function stopMusic() {
      if (!musicRef.current) return;
      musicRef.current.audio.pause();
      musicRef.current.audio.currentTime = 0;
      // Suspend the AudioContext to fully stop processing on mobile
      if (musicRef.current.ctx.state === 'running') {
        musicRef.current.ctx.suspend().catch(() => {});
      }
    }

    function handleFirstInteraction() {
      if (musicEnabled()) {
        if (!musicRef.current) musicRef.current = createMusic();
        if (musicRef.current.ctx.state === 'suspended') {
          musicRef.current.ctx.resume().catch(() => {});
        }
        if (musicRef.current.audio.paused) {
          musicRef.current.audio.play().then(() => {
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
          }).catch(() => {});
          return;
        }
      }
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    }

    function handleMusicChange(e: Event) {
      const enabled = (e as CustomEvent<boolean>).detail;
      if (enabled) startMusic(); else stopMusic();
    }

    if (musicEnabled()) startMusic();

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('music-change', handleMusicChange);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('music-change', handleMusicChange);
      musicRef.current?.audio.pause();
    };
  }, []);

  // SFX — respects sfx_enabled toggle
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!sfxEnabled()) return;
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]') || target.closest('a')) {
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
