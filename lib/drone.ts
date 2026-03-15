/**
 * Ambient terminal drone — Tone.js synthesizer.
 * Dark synthwave pad: FM synth chord layers + bass root + reverb + delay.
 * Chord progression: Am → F → C → Em, one chord every 16 seconds.
 * No audio files — all synthesized.
 */
import * as Tone from 'tone';

const CHORD_NOTES = [
  ['A3', 'C4', 'E4'], // Am
  ['F3', 'A3', 'C4'], // F
  ['C3', 'E3', 'G3'], // C
  ['E3', 'G3', 'B3'], // Em
];

const BASS_NOTES = ['A2', 'F2', 'C2', 'E2'];

// In-key blip notes per chord
const BLIP_NOTES = [
  ['A4', 'C5', 'E5', 'A5'], // Am
  ['F4', 'A4', 'C5', 'F5'], // F
  ['C4', 'E4', 'G4', 'C5'], // C
  ['E4', 'G4', 'B4', 'E5'], // Em
];

const CHORD_DURATION_MS = 16_000;

export class AmbientDrone {
  private padSynth: Tone.PolySynth | null = null;
  private bassSynth: Tone.Synth | null = null;
  private master: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private blipTimer: ReturnType<typeof setTimeout> | null = null;
  private chordTimer: ReturnType<typeof setTimeout> | null = null;
  private chordIndex = 0;
  private active = false;

  start() {
    if (this.active) return;
    this.active = true;
    try {
      Tone.start();

      this.master = new Tone.Gain(0).toDestination();
      this.reverb = new Tone.Reverb({ decay: 6, preDelay: 0.2, wet: 0.5 });
      this.delay = new Tone.FeedbackDelay('3n', 0.2);

      this.reverb.connect(this.master);
      this.delay.connect(this.reverb);

      // FM pad — cold, metallic
      this.padSynth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 10,
        volume: -14,
        envelope: { attack: 4, decay: 1, sustain: 0.8, release: 8 },
        modulation: { type: 'sine' as const },
        modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 4 },
      });
      this.padSynth.connect(this.delay);

      // Sub bass — sine, very quiet
      this.bassSynth = new Tone.Synth({
        oscillator: { type: 'sine' as const },
        envelope: { attack: 2, decay: 0, sustain: 1, release: 4 },
        volume: -22,
      });
      this.bassSynth.connect(this.master);

      // Fade in over 2.5s — background level, SFX should dominate
      this.master.gain.rampTo(0.06, 2.5);

      this.playChord();
      this.scheduleBlip();
    } catch {
      // Web Audio unavailable
    }
  }

  private playChord() {
    if (!this.active || !this.padSynth || !this.bassSynth) return;

    const notes = CHORD_NOTES[this.chordIndex];
    const bass = BASS_NOTES[this.chordIndex];

    // Brief silence between chords for clean crossfade
    this.padSynth.releaseAll();
    try { this.bassSynth.triggerRelease(); } catch { /* ignore if not started */ }

    setTimeout(() => {
      if (!this.active || !this.padSynth || !this.bassSynth) return;
      this.padSynth.triggerAttack(notes);
      this.bassSynth.triggerAttack(bass);
    }, 300);

    this.chordTimer = setTimeout(() => {
      this.chordIndex = (this.chordIndex + 1) % CHORD_NOTES.length;
      this.playChord();
    }, CHORD_DURATION_MS);
  }

  private scheduleBlip() {
    if (!this.active) return;
    this.blipTimer = setTimeout(() => {
      this.fireBlip();
      this.scheduleBlip();
    }, 3000 + Math.random() * 7000);
  }

  private fireBlip() {
    if (!this.active || !this.master) return;
    try {
      const notes = BLIP_NOTES[this.chordIndex];
      const note = notes[Math.floor(Math.random() * notes.length)];
      const blip = new Tone.Synth({
        oscillator: { type: 'square' as const },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
        volume: -30,
      }).connect(this.master);
      blip.triggerAttackRelease(note, '32n');
      setTimeout(() => blip.dispose(), 500);
    } catch { /* ignore */ }
  }

  stop(fade = false) {
    this.active = false;
    if (this.blipTimer) { clearTimeout(this.blipTimer); this.blipTimer = null; }
    if (this.chordTimer) { clearTimeout(this.chordTimer); this.chordTimer = null; }

    const doDispose = () => {
      try { this.padSynth?.releaseAll(); } catch { /* ignore */ }
      try { this.bassSynth?.triggerRelease(); } catch { /* ignore */ }
      setTimeout(() => {
        this.padSynth?.dispose(); this.padSynth = null;
        this.bassSynth?.dispose(); this.bassSynth = null;
        this.reverb?.dispose(); this.reverb = null;
        this.delay?.dispose(); this.delay = null;
        this.master?.dispose(); this.master = null;
      }, 500);
    };

    if (fade && this.master) {
      this.master.gain.rampTo(0, 1.5);
      setTimeout(doDispose, 1600);
    } else {
      doDispose();
    }
  }
}
