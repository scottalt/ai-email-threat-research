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
