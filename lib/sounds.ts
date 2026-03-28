// ═══════════════════════════════════════════════════
// Unified Audio System — single AudioContext, lazy resume
// ═══════════════════════════════════════════════════

// Create context immediately — it starts suspended on mobile until
// a user gesture calls resume(). On desktop it's usually running.
let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  return _ctx;
}

/**
 * Resume the AudioContext. Call from user gesture handlers.
 * Returns true if context is running (ready to play sounds).
 */
export function ensureUnlocked(): boolean {
  const c = ctx();
  if (c.state === 'running') return true;
  if (c.state === 'suspended') c.resume().catch(() => {});
  return false; // just issued resume, not running yet
}

/** Alias for backward compat (Typewriter uses this) */
export function getCtx(): AudioContext { return ctx(); }

/** Check if context is ready to play sounds */
function ready(): boolean {
  return !!_ctx && _ctx.state === 'running';
}

export function isSfxEnabled(): boolean {
  try { return localStorage.getItem('sfx_enabled') !== 'false'; } catch { return true; }
}

function createNote(freq: number, startTime: number, duration: number, volume = 0.12) {
  if (!ready()) return;
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

function sfx(fn: () => void) {
  if (!isSfxEnabled() || !ready()) return;
  try { fn(); } catch {}
}

export function playClick() {
  sfx(() => {
    const c = ctx(); const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t); osc.stop(t + 0.035);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  });
}

export function playKeyPress() {
  sfx(() => {
    const c = ctx(); const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square'; osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t); osc.stop(t + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  });
}

export function playCorrect() { sfx(() => { const t = ctx().currentTime; createNote(523, t, 0.08); createNote(784, t + 0.09, 0.14); }); }
export function playWrong() { sfx(() => { const t = ctx().currentTime; createNote(220, t, 0.08); createNote(165, t + 0.09, 0.14); }); }
export function playBootTick() { sfx(() => createNote(480, ctx().currentTime, 0.04, 0.07)); }
export function playStreak() { sfx(() => { const t = ctx().currentTime; createNote(523, t, 0.08); createNote(659, t + 0.09, 0.08); createNote(784, t + 0.18, 0.18); }); }
export function playCommit() { sfx(() => createNote(1200, ctx().currentTime, 0.03, 0.10)); }
export function playLevelUp() { sfx(() => { const t = ctx().currentTime; createNote(523, t, 0.10, 0.12); createNote(659, t + 0.10, 0.10, 0.12); createNote(784, t + 0.20, 0.10, 0.12); createNote(1047, t + 0.30, 0.25, 0.15); }); }
export function playAchievement() { sfx(() => { const t = ctx().currentTime; createNote(784, t, 0.06, 0.10); createNote(1047, t + 0.07, 0.06, 0.10); createNote(784, t + 0.20, 0.08, 0.12); createNote(1047, t + 0.27, 0.15, 0.14); }); }
export function playMatchFound() { sfx(() => { const t = ctx().currentTime; createNote(440, t, 0.12, 0.14); createNote(660, t + 0.13, 0.12, 0.14); createNote(880, t + 0.26, 0.20, 0.16); }); }
export function playCountdownBeep() { sfx(() => createNote(440, ctx().currentTime, 0.08, 0.10)); }
export function playCountdownGo() { sfx(() => createNote(880, ctx().currentTime, 0.15, 0.15)); }
export function playVictory() { sfx(() => { const t = ctx().currentTime; createNote(523, t, 0.08, 0.12); createNote(659, t + 0.09, 0.08, 0.12); createNote(784, t + 0.18, 0.08, 0.12); createNote(1047, t + 0.27, 0.30, 0.15); }); }
export function playDefeat() { sfx(() => { const t = ctx().currentTime; createNote(330, t, 0.15, 0.10); createNote(262, t + 0.16, 0.25, 0.10); }); }
export function playOpponentDown() { sfx(() => { const t = ctx().currentTime; createNote(660, t, 0.05, 0.08); createNote(880, t + 0.06, 0.10, 0.10); }); }

// ── Music helpers (used by TerminalSounds) ──
export function getMusicCtx(): AudioContext { return ctx(); }
