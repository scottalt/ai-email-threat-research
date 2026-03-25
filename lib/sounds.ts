// Shared AudioContext for low-latency UI sounds (click, keypress)
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

export function playClick() {
  try {
    const ctx = getCtx();
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
  } catch { /* silently ignore */ }
}

export function playKeyPress() {
  try {
    const ctx = getCtx();
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
  } catch { /* silently ignore */ }
}

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
}

export function playCorrect() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    createNote(ctx, 523, t,        0.08); // C5
    createNote(ctx, 784, t + 0.09, 0.14); // G5
  } catch { /* silently ignore if audio unavailable */ }
}

export function playWrong() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    createNote(ctx, 220, t,        0.08); // A3
    createNote(ctx, 165, t + 0.09, 0.14); // E3
  } catch { /* silently ignore if audio unavailable */ }
}

export function playBootTick() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    createNote(ctx, 480, t, 0.04, 0.07);
  } catch { /* silently ignore if audio unavailable */ }
}

export function playStreak() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    createNote(ctx, 523, t,        0.08); // C5
    createNote(ctx, 659, t + 0.09, 0.08); // E5
    createNote(ctx, 784, t + 0.18, 0.18); // G5
  } catch { /* silently ignore if audio unavailable */ }
}

// ── New sounds for AAA polish ──

/** Answer commit — crisp confirmation when pressing PHISHING/LEGIT */
export function playCommit() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 1200, t, 0.03, 0.10);
  } catch { /* silently ignore */ }
}

/** Level-up fanfare — ascending C major arpeggio */
export function playLevelUp() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 523, t,        0.10, 0.12); // C5
    createNote(ctx, 659, t + 0.10, 0.10, 0.12); // E5
    createNote(ctx, 784, t + 0.20, 0.10, 0.12); // G5
    createNote(ctx, 1047, t + 0.30, 0.25, 0.15); // C6 (longer, louder)
  } catch { /* silently ignore */ }
}

/** Achievement unlock — shimmering double-hit */
export function playAchievement() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 784, t,        0.06, 0.10); // G5
    createNote(ctx, 1047, t + 0.07, 0.06, 0.10); // C6
    createNote(ctx, 784, t + 0.20, 0.08, 0.12); // G5 echo
    createNote(ctx, 1047, t + 0.27, 0.15, 0.14); // C6 sustain
  } catch { /* silently ignore */ }
}

/** PvP match found — rising three-tone alert */
export function playMatchFound() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 440, t,        0.12, 0.14);
    createNote(ctx, 660, t + 0.13, 0.12, 0.14);
    createNote(ctx, 880, t + 0.26, 0.20, 0.16);
  } catch { /* silently ignore */ }
}

/** Countdown beep (3, 2, 1) */
export function playCountdownBeep() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 440, t, 0.08, 0.10);
  } catch { /* silently ignore */ }
}

/** Countdown GO — higher, louder */
export function playCountdownGo() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 880, t, 0.15, 0.15);
  } catch { /* silently ignore */ }
}

/** PvP victory — ascending triumph */
export function playVictory() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 523, t,        0.08, 0.12);
    createNote(ctx, 659, t + 0.09, 0.08, 0.12);
    createNote(ctx, 784, t + 0.18, 0.08, 0.12);
    createNote(ctx, 1047, t + 0.27, 0.30, 0.15);
  } catch { /* silently ignore */ }
}

/** PvP defeat — somber descending */
export function playDefeat() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 330, t,        0.15, 0.10); // E4
    createNote(ctx, 262, t + 0.16, 0.25, 0.10); // C4
  } catch { /* silently ignore */ }
}

/** Opponent eliminated — quick alert */
export function playOpponentDown() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    createNote(ctx, 660, t,        0.05, 0.08);
    createNote(ctx, 880, t + 0.06, 0.10, 0.10);
  } catch { /* silently ignore */ }
}
