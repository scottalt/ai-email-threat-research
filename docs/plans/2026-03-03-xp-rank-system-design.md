# XP-Based Rank System — Design

**Date:** 2026-03-03

## Problem

The current rank system (`getRank(score)`) is based on per-session score efficiency. This means rank changes every round and provides no persistent identity. Players have no long-term progression marker visible on the leaderboard.

## Decision

Replace score-based ranks with XP level-based ranks. Every 6 levels is a new rank tier. Rank is a persistent identity tied to account progression, not session performance.

## Rank Tiers

| Levels | Rank       |
|--------|------------|
| 1–6    | NOVICE     |
| 7–12   | OPERATOR   |
| 13–18  | ANALYST    |
| 19–24  | SPECIALIST |
| 25–30  | ELITE      |

## Implementation

### lib/rank.ts
Replace `getRank(score: number)` with `getRankFromLevel(level: number)`. Delete old function and `MAX_SCORE` constant.

### Score leaderboard (Redis)
- POST `/api/leaderboard`: accept `level` in request body alongside `name` and `score`, store it in Redis
- GET `/api/leaderboard`: return `level` alongside `name` and `score`
- Rank badge at render time: `getRankFromLevel(entry.level ?? 1)`

### XP leaderboard (Supabase)
- Already stores XP. Compute level at render time: `getLevelFromXp(entry.xp)` → `getRankFromLevel(level)`
- No schema changes needed

### RoundSummary score header
- If signed in: use `profile.level` → `getRankFromLevel(profile.level)`
- If guest: hide rank badge (guests have no level)

### Leaderboard submission (RoundSummary auto-submit)
- Include `level: profile.level` in the POST body

## Files Changed

- `lib/rank.ts` — replace `getRank(score)` with `getRankFromLevel(level)`
- `components/RoundSummary.tsx` — use `profile.level` for rank badge; include `level` in leaderboard POST; update leaderboard row rendering
- `components/StartScreen.tsx` — update leaderboard row rendering to use `getRankFromLevel(entry.level ?? 1)`
- `app/api/leaderboard/route.ts` — accept + store `level` on POST, return it on GET

## Out of Scope

- Migrating existing Redis leaderboard entries (no entries exist yet)
- Showing rank on the feedback card or game HUD
