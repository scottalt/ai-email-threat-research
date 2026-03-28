// ═══════════════════════════════════════════════════
// Sound System — HTML Audio for reliability, Web Audio for precision
// ═══════════════════════════════════════════════════

// ── SFX enabled check ──
export function isSfxEnabled(): boolean {
  try { return localStorage.getItem('sfx_enabled') !== 'false'; } catch { return true; }
}

// ── Shared AudioContext (lazy, for game sounds that need precise timing) ──
let _ctx: AudioContext | null = null;

export function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  return _ctx;
}

export function getMusicCtx(): AudioContext { return getCtx(); }

export function ensureUnlocked(): boolean {
  const c = getCtx();
  if (c.state === 'running') return true;
  if (c.state === 'suspended') c.resume().catch(() => {});
  return false;
}

// ── Simple HTML Audio pool for UI sounds (no AudioContext needed) ──
// These work immediately on any browser, no unlock required.

const audioPool: HTMLAudioElement[] = [];
const POOL_SIZE = 4;

function getPooledAudio(): HTMLAudioElement {
  // Reuse a finished audio element or create a new one
  for (const a of audioPool) {
    if (a.ended || a.paused) return a;
  }
  if (audioPool.length < POOL_SIZE) {
    const a = new Audio();
    audioPool.push(a);
    return a;
  }
  return audioPool[0]; // reuse oldest
}

// Pre-encoded tiny WAV beeps as base64 data URIs
// Generated from the oscillator specs: 880Hz square wave, 35ms
const CLICK_WAV = 'data:audio/wav;base64,UklGRiQBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQABAAB/f39/f39/f39/f39/gICAgICAgIB/f39/f39/f3+AgICAgICAgH9/f39/f39/f4CAgICAgICAf39/f39/f39/gICAgICAgIB/f39/f39/f3+AgICAgICAgH9/f39/f39/f4CAgICAgICAgICAgH9/f39/f39/gICAgICAgIB/f39/f39/f3+AgICAgICAgH9/f39/f39/f4CAgICAgICAgH9/f39/f39/gICAgICAgIB/f39/f39/f3+AgICAgICAgH9/f39/f39/f4CAgICAgICAgH9/f39/f39/gICAgICAgIB/f39/f39/f3+AgICAgICAgH9/f39/f39/f4CAgICAgICA';

function playBeep(volume = 0.15) {
  if (!isSfxEnabled()) return;
  try {
    const a = getPooledAudio();
    a.src = CLICK_WAV;
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

// ── Public SFX functions ──

export function playClick() { playBeep(0.08); }
export function playKeyPress() { playBeep(0.05); }

// ── Web Audio game sounds (need AudioContext — only play when running) ──

function ready(): boolean {
  return !!_ctx && _ctx.state === 'running';
}

function note(freq: number, start: number, dur: number, vol = 0.12) {
  if (!ready()) return;
  const c = _ctx!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g); g.connect(c.destination);
  osc.type = 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start); osc.stop(start + dur);
  osc.onended = () => { osc.disconnect(); g.disconnect(); };
}

function gameSfx(fn: () => void) {
  if (!isSfxEnabled() || !ready()) return;
  try { fn(); } catch {}
}

export function playCorrect() { gameSfx(() => { const t = _ctx!.currentTime; note(523, t, 0.08); note(784, t + 0.09, 0.14); }); }
export function playWrong() { gameSfx(() => { const t = _ctx!.currentTime; note(220, t, 0.08); note(165, t + 0.09, 0.14); }); }
export function playBootTick() { gameSfx(() => note(480, _ctx!.currentTime, 0.04, 0.07)); }
export function playStreak() { gameSfx(() => { const t = _ctx!.currentTime; note(523, t, 0.08); note(659, t + 0.09, 0.08); note(784, t + 0.18, 0.18); }); }
export function playCommit() { gameSfx(() => note(1200, _ctx!.currentTime, 0.03, 0.10)); }
export function playLevelUp() { gameSfx(() => { const t = _ctx!.currentTime; note(523, t, 0.10, 0.12); note(659, t + 0.10, 0.10, 0.12); note(784, t + 0.20, 0.10, 0.12); note(1047, t + 0.30, 0.25, 0.15); }); }
export function playAchievement() { gameSfx(() => { const t = _ctx!.currentTime; note(784, t, 0.06, 0.10); note(1047, t + 0.07, 0.06, 0.10); note(784, t + 0.20, 0.08, 0.12); note(1047, t + 0.27, 0.15, 0.14); }); }
export function playMatchFound() { gameSfx(() => { const t = _ctx!.currentTime; note(440, t, 0.12, 0.14); note(660, t + 0.13, 0.12, 0.14); note(880, t + 0.26, 0.20, 0.16); }); }
export function playCountdownBeep() { gameSfx(() => note(440, _ctx!.currentTime, 0.08, 0.10)); }
export function playCountdownGo() { gameSfx(() => note(880, _ctx!.currentTime, 0.15, 0.15)); }
export function playVictory() { gameSfx(() => { const t = _ctx!.currentTime; note(523, t, 0.08, 0.12); note(659, t + 0.09, 0.08, 0.12); note(784, t + 0.18, 0.08, 0.12); note(1047, t + 0.27, 0.30, 0.15); }); }
export function playDefeat() { gameSfx(() => { const t = _ctx!.currentTime; note(330, t, 0.15, 0.10); note(262, t + 0.16, 0.25, 0.10); }); }
export function playOpponentDown() { gameSfx(() => { const t = _ctx!.currentTime; note(660, t, 0.05, 0.08); note(880, t + 0.06, 0.10, 0.10); }); }
