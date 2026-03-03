# Confidence Penalty Scoring — Design

**Date:** 2026-03-03

## Problem

Wrong answers currently award 0 points regardless of confidence level. This means picking "certain" has no downside — the optimal strategy is to always pick the highest confidence and hope for the best.

## Decision

Wrong answers with "likely" or "certain" confidence incur a point penalty. "Guessing" wrong has no penalty — acknowledging uncertainty shouldn't be punished.

## Scoring Table

| Confidence | Correct | Wrong |
|---|---|---|
| Guessing   | +100    | 0     |
| Likely     | +200    | -100  |
| Certain    | +300    | -200  |

Streak bonus (+50 every 3 correct) unchanged, applies on correct answers only.

## Score Floor

`totalScore` is clamped to `Math.max(0, prev + pointsEarned)`. `pointsEarned` can be a negative number, but the running total never drops below zero. XP is unaffected by penalties.

## Visible Penalties

`pointsEarned` stored in `RoundResult` will be negative for penalized wrong answers (e.g. -100). The round log in RoundSummary already renders `pointsEarned` directly, so penalties will be visible automatically.

## Files Changed

- `components/Game.tsx` — add `CONFIDENCE_PENALTY` map, update `pointsEarned` calculation for wrong answers, clamp `setTotalScore`
