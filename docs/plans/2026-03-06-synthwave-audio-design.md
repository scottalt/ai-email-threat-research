# Synthwave Audio Design

## Goal

Replace the existing ambient drone and add gameplay background music with a dark cyberpunk/synthwave aesthetic using Tone.js — fully synthesized, no audio files.

## Aesthetic

Dark synthwave / cyberpunk. Cold, mechanical, pulsing. Reference: Deus Ex, Tron Legacy OST. Minor key (Am → F → C → Em progression). Reverb and delay for depth.

## Architecture

### Library
- **Tone.js** — Web Audio framework for sequencing, synthesis, and effects
- Install: `npm install tone`
- No audio files. All synthesized.
- Respects existing `sfx_enabled` localStorage toggle via `useSoundEnabled` hook

### Files

| File | Change |
|---|---|
| `lib/drone.ts` | Full rewrite — Tone.js FMSynth pad + slow chord movement + reverb |
| `lib/gameMusic.ts` | New file — Tone.js Transport, arpeggiator, bass, kick |
| `components/StartScreen.tsx` | Minor update — use new drone API |
| `components/Game.tsx` | Start/stop/update gameMusic on phase transitions |

---

## StartScreen Drone (lib/drone.ts rewrite)

### Layers
- `Tone.FMSynth` — cold metallic pad, long attack (4s) and release (8s)
- `Tone.Synth` — sub bass root note, simple sine, very quiet
- `Tone.Reverb` — large room (decay: 6s)
- `Tone.FeedbackDelay` — 3/8 note delay, low feedback

### Chord progression
- Am → F → C → Em, one chord every 16 seconds
- Cycles indefinitely, crossfades between chords
- Random in-key blips (same as now but pitched to current chord root)

### Fade
- Fade in over 2.5s on mount
- Fade out over 1.5s on stop (same as current behavior)

---

## Gameplay Music (lib/gameMusic.ts)

### Transport
- 120 BPM
- 4/4 time
- Loops a 4-bar pattern (Am → F → C → Em, one chord per bar)

### Layers
- **Arpeggio**: `Tone.Synth` (sawtooth), 16th-note pattern through chord tones, slight portamento
- **Bass**: `Tone.Synth` (triangle/sine), root on beat 1 and 3, one octave below arp root
- **Kick**: `Tone.MembraneSynth`, beats 1 and 3 (half-time feel, not 4-on-the-floor)
- **Master filter**: `Tone.Filter` (lowpass), cutoff controlled by card difficulty

### Difficulty → filter cutoff

| Difficulty | Cutoff |
|---|---|
| easy | 400 Hz |
| medium | 800 Hz |
| hard | 1600 Hz |
| extreme | 3200 Hz |

Filter transitions smoothly (rampTo over 0.5s) when card changes.

### Phase transitions

| Phase | Action |
|---|---|
| `playing` (card shown) | Fade master gain to 1.0 over 1s, arp active |
| `feedback` | Filter closes to 200 Hz, arp gain → 0, bass+kick continue quietly |
| Next card (`playing`) | Filter reopens to difficulty cutoff, arp resumes |
| `summary` | Fade master gain to 0 over 2s, Transport stops |

### SFX toggle
- Off mid-round: master gain → 0 immediately, Transport keeps running
- On again: master gain → 1.0 over 0.5s from current Transport position

---

## API (public interface)

### AmbientDrone (lib/drone.ts)
```ts
class AmbientDrone {
  start(): void
  stop(fade?: boolean): void
}
```
Identical to current API — no changes needed in StartScreen.tsx beyond import.

### GameMusic (lib/gameMusic.ts)
```ts
class GameMusic {
  start(): void                          // begin Transport, fade in
  stop(): void                           // fade out, stop Transport
  setDifficulty(d: string | null): void  // update filter cutoff
  setPhase(p: 'playing' | 'feedback'): void  // arp on/off
  setEnabled(enabled: boolean): void     // SFX toggle
}
```
