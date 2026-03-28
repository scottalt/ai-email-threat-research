'use client';

import { useEffect, useRef } from 'react';
import { getCtx, ensureUnlocked, playClick, playKeyPress } from '@/lib/sounds';

const MUSIC_SRC = '/audio/joelfazhari-synthetic-deception-loopable-epic-cyberpunk-crime-music-157454.mp3';
const MUSIC_GAIN = 0.04;
const FADE_TIME = 0.05; // 50ms gain ramp to prevent pops

const SKIP_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'PageUp', 'PageDown', 'Home', 'End', 'Insert',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

function musicEnabled(): boolean {
  try { return localStorage.getItem('music_enabled') !== 'false'; } catch { return true; }
}

interface MusicState {
  audio: HTMLAudioElement;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
}

export function TerminalSounds() {
  const musicRef = useRef<MusicState | null>(null);
  const musicStarted = useRef(false);

  // Create music nodes lazily — connects to the shared AudioContext
  function getMusic(): MusicState {
    if (musicRef.current) return musicRef.current;
    const ctx = getCtx();
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = 0; // start silent
    source.connect(gain);
    gain.connect(ctx.destination);
    musicRef.current = { audio, gain, source };
    return musicRef.current;
  }

  function startMusic() {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const m = getMusic();
    const t = ctx.currentTime;
    // Fade in to prevent pop
    m.gain.gain.cancelScheduledValues(t);
    m.gain.gain.setValueAtTime(m.gain.gain.value, t);
    m.gain.gain.linearRampToValueAtTime(MUSIC_GAIN, t + FADE_TIME);
    if (m.audio.paused) {
      m.audio.play().catch(() => {});
    }
    musicStarted.current = true;
  }

  function stopMusic() {
    if (!musicRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    // Fade out to prevent pop
    musicRef.current.gain.gain.cancelScheduledValues(t);
    musicRef.current.gain.gain.setValueAtTime(musicRef.current.gain.gain.value, t);
    musicRef.current.gain.gain.linearRampToValueAtTime(0, t + FADE_TIME);
    // Pause after fade completes
    setTimeout(() => {
      musicRef.current?.audio.pause();
    }, FADE_TIME * 1000 + 10);
    musicStarted.current = false;
  }

  useEffect(() => {
    // ── User gesture handler — unlocks AudioContext + starts music ──
    function handleGesture() {
      ensureUnlocked();
      // Try to start music on first gesture if enabled
      if (musicEnabled() && !musicStarted.current) {
        // Small delay to let context resume
        setTimeout(() => startMusic(), 50);
      }
    }

    // ── Music toggle handler ──
    function handleMusicChange(e: Event) {
      const enabled = (e as CustomEvent<boolean>).detail;
      if (enabled) {
        startMusic();
      } else {
        stopMusic();
      }
    }

    // ── Visibility change — resume context when returning from background ──
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        const ctx = getCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // Restart music if it was playing before background
        if (musicEnabled() && musicStarted.current && musicRef.current?.audio.paused) {
          startMusic();
        }
      }
    }

    document.addEventListener('click', handleGesture, { capture: true });
    document.addEventListener('touchstart', handleGesture, { capture: true });
    window.addEventListener('music-change', handleMusicChange);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('click', handleGesture, { capture: true });
      document.removeEventListener('touchstart', handleGesture, { capture: true });
      window.removeEventListener('music-change', handleMusicChange);
      document.removeEventListener('visibilitychange', handleVisibility);
      musicRef.current?.audio.pause();
    };
  }, []);

  // ── Global SFX — click and keypress sounds ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Ensure context is unlocked on every click (handles first interaction)
      ensureUnlocked();
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]') || target.closest('a')) {
        playClick();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
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
