/**
 * Ambient terminal drone — Web Audio API synthesizer.
 * Low bass drone + slow LFO breathing + occasional square-wave blips.
 * No audio files — all synthesized.
 */
export class AmbientDrone {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private blipTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  start() {
    if (this.active) return;
    this.active = true;
    try {
      this.ctx = new AudioContext();
      const ctx = this.ctx;

      // Master gain — fade in over 2.5s
      this.master = ctx.createGain();
      this.master.gain.setValueAtTime(0, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 2.5);
      this.master.connect(ctx.destination);

      // Dark low-pass filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      filter.Q.value = 0.5;
      filter.connect(this.master);
      this.nodes.push(filter);

      // Slow LFO → master gain (subtle breathing, ~14s cycle)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 0.06;
      lfo.connect(lfoGain);
      lfoGain.connect(this.master.gain);
      lfo.start();
      this.nodes.push(lfo, lfoGain);

      // Drone layers: A1 (sub), A2 (bass), ~E3 (slightly detuned), A3 (top)
      const layers: [number, number][] = [
        [55,    0.50],
        [110,   0.35],
        [164.5, 0.12],
        [220,   0.06],
      ];
      for (const [freq, gain] of layers) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.value = gain;
        osc.connect(g);
        g.connect(filter);
        osc.start();
        this.nodes.push(osc, g);
      }

      this.scheduleBlip();
    } catch {
      // Web Audio unavailable
    }
  }

  private scheduleBlip() {
    if (!this.active) return;
    this.blipTimer = setTimeout(() => {
      this.playBlip();
      this.scheduleBlip();
    }, 3000 + Math.random() * 7000);
  }

  private playBlip() {
    if (!this.ctx || !this.active) return;
    const ctx = this.ctx;
    const freq = [220, 330, 440, 660][Math.floor(Math.random() * 4)];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.025, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  stop(fade = false) {
    this.active = false;
    if (this.blipTimer) { clearTimeout(this.blipTimer); this.blipTimer = null; }
    if (!this.ctx) return;

    const doStop = () => {
      this.nodes.forEach((n) => { try { (n as OscillatorNode).stop?.(); } catch {} });
      this.nodes = [];
      this.ctx?.close();
      this.ctx = null;
      this.master = null;
    };

    if (fade && this.master) {
      this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
      setTimeout(doStop, 1600);
    } else {
      doStop();
    }
  }
}
