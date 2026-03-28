// ═══════════════════════════════════════════════════
// Sound System — Web Audio oscillators, simple and reliable
// ═══════════════════════════════════════════════════

let _ctx: AudioContext | null = null;

export function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  // Always try to resume — browsers allow this inside user gesture handlers
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

export function getMusicCtx(): AudioContext { return getCtx(); }

export function ensureUnlocked(): boolean {
  const c = getCtx();
  return c.state === 'running';
}

export function isSfxEnabled(): boolean {
  try { return localStorage.getItem('sfx_enabled') !== 'false'; } catch { return true; }
}

function note(freq: number, start: number, dur: number, vol = 0.12) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.start(start); osc.stop(start + dur);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  } catch {}
}

export function playClick() {
  if (!isSfxEnabled()) return;
  try {
    const c = getCtx(); const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'square'; osc.frequency.value = 880;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.035);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  } catch {}
}

export function playKeyPress() {
  if (!isSfxEnabled()) return;
  try {
    const c = getCtx(); const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'square'; osc.frequency.value = 660;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.02);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  } catch {}
}

function sfx(fn: () => void) { if (isSfxEnabled()) try { fn(); } catch {} }

export function playCorrect() { sfx(() => { const t = getCtx().currentTime; note(523, t, 0.08); note(784, t + 0.09, 0.14); }); }
export function playWrong() { sfx(() => { const t = getCtx().currentTime; note(220, t, 0.08); note(165, t + 0.09, 0.14); }); }
export function playBootTick() { sfx(() => note(480, getCtx().currentTime, 0.04, 0.07)); }
export function playStreak() { sfx(() => { const t = getCtx().currentTime; note(523, t, 0.08); note(659, t + 0.09, 0.08); note(784, t + 0.18, 0.18); }); }
export function playCommit() { sfx(() => note(1200, getCtx().currentTime, 0.03, 0.10)); }
export function playLevelUp() { sfx(() => { const t = getCtx().currentTime; note(523, t, 0.10, 0.12); note(659, t + 0.10, 0.10, 0.12); note(784, t + 0.20, 0.10, 0.12); note(1047, t + 0.30, 0.25, 0.15); }); }
export function playAchievement() { sfx(() => { const t = getCtx().currentTime; note(784, t, 0.06, 0.10); note(1047, t + 0.07, 0.06, 0.10); note(784, t + 0.20, 0.08, 0.12); note(1047, t + 0.27, 0.15, 0.14); }); }
export function playMatchFound() { sfx(() => { const t = getCtx().currentTime; note(440, t, 0.12, 0.14); note(660, t + 0.13, 0.12, 0.14); note(880, t + 0.26, 0.20, 0.16); }); }
export function playCountdownBeep() { sfx(() => note(440, getCtx().currentTime, 0.08, 0.10)); }
export function playCountdownGo() { sfx(() => note(880, getCtx().currentTime, 0.15, 0.15)); }
export function playVictory() { sfx(() => { const t = getCtx().currentTime; note(523, t, 0.08, 0.12); note(659, t + 0.09, 0.08, 0.12); note(784, t + 0.18, 0.08, 0.12); note(1047, t + 0.27, 0.30, 0.15); }); }
export function playDefeat() { sfx(() => { const t = getCtx().currentTime; note(330, t, 0.15, 0.10); note(262, t + 0.16, 0.25, 0.10); }); }
export function playOpponentDown() { sfx(() => { const t = getCtx().currentTime; note(660, t, 0.05, 0.08); note(880, t + 0.06, 0.10, 0.10); }); }
