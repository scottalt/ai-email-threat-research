# Inline Red Flag Highlighting — Design Doc

**Date:** 2026-03-01
**Status:** Approved

## Overview

After a user answers a card, the FeedbackCard re-displays the original email/SMS body with exact phishing phrases highlighted in amber. Highlights are only shown on phishing cards. This teaches players what to look for without giving anything away before they answer.

## Data Changes

### `lib/types.ts`
- Add `highlights?: string[]` to the `Card` interface
- Optional field — legit cards omit it entirely

### `data/cards.ts`
- Add `highlights: string[]` to all phishing cards with exact substrings from the body text
- Matching is case-insensitive at render time, but substrings should be authored to match actual body text
- While iterating all 40 cards, remove any real names (Scott's) from body/from/subject fields and replace with generic placeholder names (e.g., Alex Johnson, Jamie Lee, Chris Patel, etc.)

## Rendering

### Utility function: `lib/highlightBody.ts`
- Signature: `highlightBody(body: string, highlights: string[]): Segment[]`
- Returns alternating `{ text: string, highlighted: boolean }` segments
- Case-insensitive matching, handles overlapping/multiple highlights in a single pass
- Pure function, no side effects — easy to test

### `components/FeedbackCard.tsx`
- Add a "MESSAGE BODY" section above the existing ANALYST_NOTES box
- Renders the segmented body using `<span>` elements
- Highlighted segments: amber background (`#ffaa00`), dark text (`#060c06`), slight padding
- Only renders if `card.isPhishing && card.highlights?.length`
- Body text rendered in `<pre>` or with `whitespace-pre-wrap` to preserve newlines

## Visual Style

- Background: `#ffaa00` (amber — matches existing streak/medium color)
- Text: `#060c06` (dark bg color — high contrast)
- Slight horizontal padding on highlighted spans for readability
- No animation — static highlight, revealed with the rest of the feedback

## Scope

- ~20 phishing cards get `highlights` authored
- All 40 cards audited for real names, replaced with generic placeholders
- No changes to GameCard (pre-answer view stays clean)
- No changes to scoring, game flow, or leaderboard
