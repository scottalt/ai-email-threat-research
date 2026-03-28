// ═══════════════════════════════════════════════════
// Unified Audio System — single AudioContext for all sounds
// ═══════════════════════════════════════════════════

let _ctx: AudioContext | null = null;
let _unlocked = false;

/**
 * Get or create the shared AudioContext.
 * On first call, creates the context. On mobile, it starts suspended
 * and will be resumed on the next user gesture via ensureUnlocked().
 */
export function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();
  }
  return _ctx;
}

/**
 * Resume the AudioContext if suspended. Must be called from a user
 * gesture handler (click/touchstart) for iOS Safari compliance.
 */
export function ensureUnlocked(): void {
  if (_unlocked) return;
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => { _unlocked = true; }).catch(() => {});
  } else {
    _unlocked = true;
  }
}

// ── SFX enabled check (reads localStorage, fast & sync) ──
export function isSfxEnabled(): boolean {
  try { return localStorage.getItem('sfx_enabled') !== 'false'; } catch { return true; }
}

// ── Note generator ──
function createNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.12,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
  // Clean up after playback
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

// ── SFX functions (all check isSfxEnabled) ──

export function playClick() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.035);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  } catch {}
}

export function playKeyPress() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  } catch {}
}

export function playCorrect() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 523, t, 0.08);
    createNote(ctx, 784, t + 0.09, 0.14);
  } catch {}
}

export function playWrong() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 220, t, 0.08);
    createNote(ctx, 165, t + 0.09, 0.14);
  } catch {}
}

export function playBootTick() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    createNote(ctx, 480, ctx.currentTime, 0.04, 0.07);
  } catch {}
}

export function playStreak() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 523, t, 0.08);
    createNote(ctx, 659, t + 0.09, 0.08);
    createNote(ctx, 784, t + 0.18, 0.18);
  } catch {}
}

export function playCommit() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    createNote(ctx, 1200, ctx.currentTime, 0.03, 0.10);
  } catch {}
}

export function playLevelUp() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 523, t, 0.10, 0.12);
    createNote(ctx, 659, t + 0.10, 0.10, 0.12);
    createNote(ctx, 784, t + 0.20, 0.10, 0.12);
    createNote(ctx, 1047, t + 0.30, 0.25, 0.15);
  } catch {}
}

export function playAchievement() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 784, t, 0.06, 0.10);
    createNote(ctx, 1047, t + 0.07, 0.06, 0.10);
    createNote(ctx, 784, t + 0.20, 0.08, 0.12);
    createNote(ctx, 1047, t + 0.27, 0.15, 0.14);
  } catch {}
}

export function playMatchFound() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 440, t, 0.12, 0.14);
    createNote(ctx, 660, t + 0.13, 0.12, 0.14);
    createNote(ctx, 880, t + 0.26, 0.20, 0.16);
  } catch {}
}

export function playCountdownBeep() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    createNote(ctx, 440, ctx.currentTime, 0.08, 0.10);
  } catch {}
}

export function playCountdownGo() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    createNote(ctx, 880, ctx.currentTime, 0.15, 0.15);
  } catch {}
}

export function playVictory() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 523, t, 0.08, 0.12);
    createNote(ctx, 659, t + 0.09, 0.08, 0.12);
    createNote(ctx, 784, t + 0.18, 0.08, 0.12);
    createNote(ctx, 1047, t + 0.27, 0.30, 0.15);
  } catch {}
}

export function playDefeat() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 330, t, 0.15, 0.10);
    createNote(ctx, 262, t + 0.16, 0.25, 0.10);
  } catch {}
}

export function playOpponentDown() {
  if (!isSfxEnabled()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    createNote(ctx, 660, t, 0.05, 0.08);
    createNote(ctx, 880, t + 0.06, 0.10, 0.10);
  } catch {}
}
