/**
 * Gameplay background music — Tone.js synthwave synthesizer.
 * Dark arpeggio + bass + kick over Am → F → C → Em at 120 BPM.
 * No audio files — all synthesized.
 */
import * as Tone from 'tone';

const BPM = 120;

// 16th-note arp patterns per chord, each chord is 1 bar (16 sixteenth notes)
// Pattern repeats 4× per bar to fill the bar
const ARP_CHORD_TONES: Record<string, string[]> = {
  Am: ['A3', 'C4', 'E4', 'A4'],
  F:  ['F3', 'A3', 'C4', 'F4'],
  C:  ['C3', 'E3', 'G3', 'C4'],
  Em: ['E3', 'G3', 'B3', 'E4'],
};

const PROGRESSION = ['Am', 'F', 'C', 'Em'];
const BASS_NOTES: Record<string, string> = { Am: 'A2', F: 'F2', C: 'C2', Em: 'E2' };

const DIFFICULTY_CUTOFF: Record<string, number> = {
  easy:    400,
  medium:  800,
  hard:   1600,
  extreme: 3200,
};

export class GameMusic {
  private arpSynth: Tone.Synth | null = null;
  private bassSynth: Tone.Synth | null = null;
  private kick: Tone.MembraneSynth | null = null;
  private filter: Tone.Filter | null = null;
  private arpGain: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private master: Tone.Gain | null = null;
  private arpSeq: Tone.Sequence | null = null;
  private bassSeq: Tone.Sequence | null = null;
  private kickSeq: Tone.Sequence | null = null;
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    try {
      Tone.start();
      Tone.getTransport().bpm.value = BPM;

      // Signal chain: arpGain → filter → reverb → master → destination
      //               bassSynth → filter
      //               kick → master
      this.master = new Tone.Gain(0).toDestination();
      this.reverb = new Tone.Reverb({ decay: 2, wet: 0.25 });
      this.filter = new Tone.Filter(800, 'lowpass');
      this.arpGain = new Tone.Gain(1);

      this.reverb.connect(this.master);
      this.filter.connect(this.reverb);
      this.arpGain.connect(this.filter);

      // Sawtooth arp — classic synthwave
      this.arpSynth = new Tone.Synth({
        oscillator: { type: 'sawtooth' as const },
        envelope: { attack: 0.01, decay: 0.12, sustain: 0.25, release: 0.15 },
        volume: -20,
      });
      this.arpSynth.connect(this.arpGain);

      // Triangle bass
      this.bassSynth = new Tone.Synth({
        oscillator: { type: 'triangle' as const },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.4 },
        volume: -16,
      });
      this.bassSynth.connect(this.filter);

      // Kick — synthesized membrane
      this.kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
        volume: -12,
      });
      this.kick.connect(this.master);

      // Build flat 64-step arp note array (4 chords × 4 repeats × 4 notes = 64 sixteenth notes)
      const arpNotes: string[] = [];
      for (const chord of PROGRESSION) {
        const tones = ARP_CHORD_TONES[chord];
        for (let repeat = 0; repeat < 4; repeat++) {
          arpNotes.push(...tones);
        }
      }

      this.arpSeq = new Tone.Sequence(
        (time, note) => {
          this.arpSynth?.triggerAttackRelease(note as string, '16n', time);
        },
        arpNotes,
        '16n',
      );

      // Bass: root on beat 1 and 3 of each bar (8th-note grid, hit on steps 0 and 4)
      // 4 chords × 8 eighth-note steps = 32 steps
      const bassPattern: (string | null)[] = [];
      for (const chord of PROGRESSION) {
        const note = BASS_NOTES[chord];
        bassPattern.push(note, null, null, null, note, null, null, null);
      }

      this.bassSeq = new Tone.Sequence(
        (time, note) => {
          if (note) this.bassSynth?.triggerAttackRelease(note as string, '8n', time);
        },
        bassPattern,
        '8n',
      );

      // Kick: beats 1 and 3 per bar, half-time feel (8th-note grid)
      // 4 bars × 8 steps each = 32 steps
      const kickPattern: number[] = [];
      for (let bar = 0; bar < 4; bar++) {
        kickPattern.push(1, 0, 0, 0, 1, 0, 0, 0);
      }

      this.kickSeq = new Tone.Sequence(
        (time, hit) => {
          if (hit) this.kick?.triggerAttackRelease('C1', '8n', time);
        },
        kickPattern,
        '8n',
      );

      this.arpSeq.start(0);
      this.bassSeq.start(0);
      this.kickSeq.start(0);
      Tone.getTransport().start();

      // Fade in over 1s — background level, SFX should dominate
      this.master.gain.rampTo(0.08, 1);
    } catch {
      // Web Audio unavailable
    }
  }

  /** Call when a new card is shown. Adjusts filter to difficulty. */
  setDifficulty(difficulty: string | null) {
    const cutoff = DIFFICULTY_CUTOFF[difficulty ?? 'medium'] ?? 800;
    this.filter?.frequency.rampTo(cutoff, 0.5);
  }

  /** Call on phase transitions within a round. */
  setPhase(phase: 'playing' | 'feedback') {
    if (phase === 'feedback') {
      // Muffle: close filter, silence arp
      this.filter?.frequency.rampTo(200, 0.3);
      this.arpGain?.gain.rampTo(0, 0.3);
    } else {
      // Re-open arp; caller must also call setDifficulty to restore cutoff
      this.arpGain?.gain.rampTo(1, 0.3);
    }
  }

  /** Sync to SFX toggle. Transport keeps running; only master gain changes. */
  setEnabled(enabled: boolean) {
    if (!this.master) return;
    this.master.gain.rampTo(enabled ? 0.08 : 0, 0.3);
  }

  /** Fade out and tear down. Safe to call multiple times. */
  stop() {
    if (!this.started) return;
    this.started = false;

    this.master?.gain.rampTo(0, 2);

    setTimeout(() => {
      this.arpSeq?.dispose(); this.arpSeq = null;
      this.bassSeq?.dispose(); this.bassSeq = null;
      this.kickSeq?.dispose(); this.kickSeq = null;
      this.arpSynth?.dispose(); this.arpSynth = null;
      this.bassSynth?.dispose(); this.bassSynth = null;
      this.kick?.dispose(); this.kick = null;
      this.arpGain?.dispose(); this.arpGain = null;
      this.filter?.dispose(); this.filter = null;
      this.reverb?.dispose(); this.reverb = null;
      this.master?.dispose(); this.master = null;
    }, 2200);
  }
}
