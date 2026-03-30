// Shared AudioContext for all sounds
let _ctx: AudioContext | null = null;
let _unlocked = false;
let _resuming: Promise<void> | null = null;

export function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();
    _unlocked = false;
    _resuming = null;
  }
  return _ctx;
}

export const getMusicCtx = getCtx;

/**
 * Resume the AudioContext if suspended (required on iOS before any sound plays).
 * Returns a promise that resolves once the context is running.
 * Coalesces multiple calls so we don't spam resume().
 */
function resumeIfSuspended(): Promise<void> {
  const ctx = getCtx();
  if (ctx.state === 'running') return Promise.resolve();
  if (!_resuming) {
    _resuming = ctx.resume().then(() => { _resuming = null; }).catch(() => { _resuming = null; });
  }
  return _resuming;
}

/**
 * Warm up AudioContext on user interaction (fixes iOS first-sound clipping).
 * Retries on every gesture until the context is actually running.
 */
export function ensureUnlocked() {
  const ctx = getCtx();
  // Always attempt resume — iOS may need multiple gestures
  resumeIfSuspended();
  if (_unlocked && ctx.state === 'running') return;
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    if (ctx.state === 'running') _unlocked = true;
  } catch {}
}

// Auto-warm on first tap/click/key — keeps retrying until actually unlocked.
// On iOS the first gesture unlocks the context, but the sound triggered by
// that same gesture misses because the context was still suspended when the
// SFX handler fired. Fix: await resume, then retroactively play the click
// so the user hears feedback on their very first tap.
if (typeof window !== 'undefined') {
  const warmUp = async () => {
    ensureUnlocked();
    // Wait for resume to actually complete
    await resumeIfSuspended();
    if (_ctx?.state === 'running') {
      _unlocked = true;
      // Retroactively play click so first tap isn't silent
      playFromPool(_clickPool, '/audio/click.wav', 0.3);
      window.removeEventListener('click', warmUp, true);
      window.removeEventListener('touchstart', warmUp, true);
      window.removeEventListener('keydown', warmUp, true);
    }
  };
  window.addEventListener('click', warmUp, true);
  window.addEventListener('touchstart', warmUp, true);
  window.addEventListener('keydown', warmUp, true);
}

export function isSfxEnabled(): boolean {
  try { return localStorage.getItem('sfx_enabled') !== 'false'; } catch { return true; }
}

// ── HTMLAudio pool for click/keypress with preloading ──
const _clickPool: HTMLAudioElement[] = [];
const _keypressPool: HTMLAudioElement[] = [];

/**
 * Preload audio pools so the first play isn't delayed by network fetch.
 * Called once on module load in browser.
 */
function preloadPool(pool: HTMLAudioElement[], src: string, count: number) {
  for (let i = 0; i < count; i++) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = 0;
    // Force iOS to begin loading
    a.load();
    pool.push(a);
  }
}

if (typeof window !== 'undefined') {
  preloadPool(_clickPool, '/audio/click.wav', 3);
  preloadPool(_keypressPool, '/audio/keypress.wav', 2);
}

function playFromPool(pool: HTMLAudioElement[], src: string, vol: number) {
  if (!isSfxEnabled()) return;
  try {
    let a = pool.find(el => el.paused || el.ended);
    if (!a && pool.length < 3) {
      a = new Audio(src);
      a.preload = 'auto';
      pool.push(a);
    }
    if (!a) { a = pool[0]; }
    a.volume = vol;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

export function playClick() { playFromPool(_clickPool, '/audio/click.wav', 0.3); }
export function playKeyPress() { playFromPool(_keypressPool, '/audio/keypress.wav', 0.2); }

// ── Synthesized SFX via Web Audio API ──

function createNote(ctx: AudioContext, freq: number, startTime: number, duration: number, volume = 0.12) {
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'square'; osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime); osc.stop(startTime + duration);
}

/**
 * Get a safe start time for scheduling notes.
 * On iOS, after resume() the context may report a stale currentTime.
 * Adding a small offset prevents scheduling in the past.
 */
function safeNow(ctx: AudioContext): number {
  return ctx.currentTime + 0.01;
}

export function playCorrect() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 523, t, 0.08); createNote(ctx, 784, t + 0.09, 0.14); } catch {} }
export function playWrong() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 220, t, 0.08); createNote(ctx, 165, t + 0.09, 0.14); } catch {} }
export function playBootTick() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; createNote(ctx, 480, safeNow(ctx), 0.04, 0.07); } catch {} }
export function playStreak() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 523, t, 0.08); createNote(ctx, 659, t + 0.09, 0.08); createNote(ctx, 784, t + 0.18, 0.18); } catch {} }
export function playCommit() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; createNote(ctx, 1200, safeNow(ctx), 0.03, 0.10); } catch {} }
export function playLevelUp() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 523, t, 0.10, 0.12); createNote(ctx, 659, t + 0.10, 0.10, 0.12); createNote(ctx, 784, t + 0.20, 0.10, 0.12); createNote(ctx, 1047, t + 0.30, 0.25, 0.15); } catch {} }
export function playAchievement() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 784, t, 0.06, 0.10); createNote(ctx, 1047, t + 0.07, 0.06, 0.10); createNote(ctx, 784, t + 0.20, 0.08, 0.12); createNote(ctx, 1047, t + 0.27, 0.15, 0.14); } catch {} }
export function playMatchFound() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 440, t, 0.12, 0.14); createNote(ctx, 660, t + 0.13, 0.12, 0.14); createNote(ctx, 880, t + 0.26, 0.20, 0.16); } catch {} }
export function playCountdownBeep() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; createNote(ctx, 440, safeNow(ctx), 0.08, 0.10); } catch {} }
export function playCountdownGo() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; createNote(ctx, 880, safeNow(ctx), 0.15, 0.15); } catch {} }
export function playVictory() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 523, t, 0.08, 0.12); createNote(ctx, 659, t + 0.09, 0.08, 0.12); createNote(ctx, 784, t + 0.18, 0.08, 0.12); createNote(ctx, 1047, t + 0.27, 0.30, 0.15); } catch {} }
export function playDefeat() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 330, t, 0.15, 0.10); createNote(ctx, 262, t + 0.16, 0.25, 0.10); } catch {} }
export function playOpponentDown() { if (!isSfxEnabled()) return; try { ensureUnlocked(); const ctx = getCtx(); if (ctx.state !== 'running') return; const t = safeNow(ctx); createNote(ctx, 660, t, 0.05, 0.08); createNote(ctx, 880, t + 0.06, 0.10, 0.10); } catch {} }
