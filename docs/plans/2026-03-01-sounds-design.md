# Sound System — Design Doc

**Date:** 2026-03-01
**Status:** Approved

## Overview

Chiptune sound effects for three gameplay events: correct answer, wrong answer, and streak milestone. Sounds are off by default with a persistent toggle in the GameCard HUD.

## Sound Events

| Event | Sound | Trigger |
|-------|-------|---------|
| Correct answer | Short ascending two-note ding | User answers correctly |
| Wrong answer | Descending buzzer tone | User answers incorrectly |
| Streak milestone | Three-note ascending fanfare | Every 3 correct in a row (streak % 3 === 0) |

## Technical Approach

Web Audio API for programmatic synthesis — no audio files, zero bundle impact. Square wave oscillator type for authentic 8-bit chiptune character.

## Architecture

### `lib/sounds.ts`
Three exported pure functions, each creates a short oscillator sequence:
- `playCorrect()` — ascending two-note ding
- `playWrong()` — descending buzzer
- `playStreak()` — three-note ascending fanfare

No state. Each function creates and immediately destroys its AudioContext nodes.

### `lib/useSoundEnabled.ts`
React hook managing sound toggle state:
- Reads/writes `soundEnabled` boolean to `localStorage` key `sfx_enabled`
- Defaults to `false` (off) if key absent
- Returns `{ soundEnabled, toggleSound }`

### Toggle UI
Small `[SFX]` / `[SFX OFF]` button added to the GameCard HUD. Persists across sessions via localStorage.

### Sound calls
In `Game.tsx` — it already processes answer results and tracks streak state, so it's the correct place to call sound functions. Calls are conditional on `soundEnabled`.

## Scope

- 3 new files: `lib/sounds.ts`, `lib/useSoundEnabled.ts`
- 2 modified files: `components/GameCard.tsx` (toggle in HUD), `components/Game.tsx` (sound calls)
- No API changes, no data changes
- No audio files — all synthesis is runtime
