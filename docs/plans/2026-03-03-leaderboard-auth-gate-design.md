# Leaderboard Auth Gate — Design

**Date:** 2026-03-03

## Problem

The leaderboard submission form accepts any manually typed name, allowing anonymous or spoofed entries. Now that player accounts exist, leaderboard submissions should be tied to authenticated identities.

## Decision

Restrict leaderboard submission to signed-in users only. Guests see an inline sign-in prompt encouraging them to register for future leaderboard eligibility. No pending score logic — the round they sign up during is not submitted.

## Flow

### Signed-in users
- Auto-submit on RoundSummary mount using `profile.display_name` and `totalScore`
- No form, no button
- Shows "SCORE LOGGED. GL HF." once submission completes

### Guests
- Replace the name input form with a short message: `SIGN IN TO APPEAR ON FUTURE LEADERBOARDS`
- Inline `AuthFlow` component (magic link email input)
- No pending score saved — cross-device magic link makes this unreliable

## Files Changed

- `components/RoundSummary.tsx` — conditional render on `signedIn`: auto-submit vs. inline AuthFlow prompt

## Out of Scope

- Pending score recovery after auth (cross-device magic link makes this unreliable)
- Leaderboard deduplication per player (future concern)
