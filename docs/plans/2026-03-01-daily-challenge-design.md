# Daily Challenge Mode — Design

**Date:** 2026-03-01

## Overview

A daily challenge mode where every player gets the same 10 cards on a given day. One attempt per day, enforced via localStorage. Separate daily leaderboard backed by Upstash Redis.

## Card Selection

- Function: `getDailyDeck()` in `data/cards.ts`
- Seed: today's date string `YYYY-MM-DD` converted to a number
- PRNG: mulberry32
- Process: seeded Fisher-Yates shuffle of all 40 cards, take first 10
- Result is deterministic — same cards for every player on the same day, resets at midnight local time

## One-and-Done Enforcement

- localStorage key: `daily_YYYY-MM-DD`
- On daily challenge start: check for existing key
  - If present: skip to completed state, show stored score + daily leaderboard
  - If absent: proceed with game
- On round complete: write `{ score, totalScore }` to localStorage key

## Daily Leaderboard

- Redis key: `leaderboard:daily:YYYY-MM-DD`
- TTL: 7 days (set on first write via Upstash TTL)
- API: existing `/api/leaderboard` route extended with optional `?date=YYYY-MM-DD` query param
  - With param: uses daily key
  - Without param: uses global key (existing behavior unchanged)
- Displayed: top 10 on StartScreen under daily button, top 20 on RoundSummary after a daily round

## UI Changes

### StartScreen
- Daily challenge button: full-width, bright border, `[ DAILY CHALLENGE ]` with today's date
- Regular play button: secondary styling, dimmer
- Daily top 10 leaderboard rendered below daily button
- Global top 10 leaderboard rendered below regular play button (existing)

### Game.tsx
- Receives `mode: 'daily' | 'freeplay'` prop
- Daily mode: uses `getDailyDeck()` instead of `getShuffledDeck()`
- Passes mode down to `RoundSummary`

### RoundSummary
- Receives `mode` prop
- Leaderboard submission routes to daily key when `mode === 'daily'`
- Shows daily leaderboard after a daily round

## Files to Change

- `data/cards.ts` — add `getDailyDeck()`
- `app/api/leaderboard/route.ts` — support `?date=` param
- `components/Game.tsx` — accept and pass `mode` prop
- `components/StartScreen.tsx` — two buttons, daily leaderboard, callback for mode selection
- `components/RoundSummary.tsx` — route submission by mode, show daily leaderboard

## Out of Scope

- Server-side enforcement (localStorage only)
- Countdown timer to next day
- Score sharing / social features
