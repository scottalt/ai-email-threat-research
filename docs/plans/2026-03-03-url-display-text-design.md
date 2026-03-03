# URL Display Text (Disguised Links) — Design

**Date:** 2026-03-03

## Problem

The URL inspector currently shows the same URL as what's rendered in the card body. Real phishing emails disguise links — the body shows `paypal.com/verify` but the href goes to `paypa1-security.ru/login`. This signal is missing from the game.

## Decision

Support `[display text](actual url)` markdown-style links in card bodies. Display text appears in the email body; actual URL is only revealed in the URL inspector. Existing raw URL format continues to work unchanged (display = actual).

## Display Text Rules by Card Type

| Card type | Display text | Actual URL |
|---|---|---|
| Legit | Legitimate-looking label matching real domain | Same — it is real |
| Phishing easy | Suspicious / barely dressed up | Same malicious URL |
| Phishing medium | Plausible but imperfect (`paypa1.com/verify`) | Same |
| Phishing hard/extreme | Completely convincing (`paypal.com/verify`) | Different malicious URL |

Hard/extreme phishing cards are DESIGNED to look legitimate in the body. The URL inspector is the forensic tool that reveals the mismatch. `urlInspected` tracking captures whether players used it — that's the research finding.

## Research Integrity

URL mismatch is NOT added to FORENSIC_SIGNALS. Telling players post-round that "the link was disguised" would train inspector usage and distort the research baseline. The existing `urlInspected` flag captures natural behaviour without feedback contamination.

## Visual Signal

Links (both raw URL and markdown-style) get a `[↗]` suffix so it's obvious something is clickable even when display text is a phrase rather than a URL string.

## Migration

All existing cards in `cards_staging` and `cards_real` with raw URLs in their body will be updated by a one-time migration script using Haiku. The script:
- Queries all cards with at least one URL in the body
- Calls Haiku with card context (body, difficulty, isPhishing, technique)
- Haiku wraps each raw URL in `[display text](url)` per the rules above
- Writes updated body back to Supabase

Legit cards get legitimate-looking display text (matching what a real email from that sender would show). This does not make them harder — the URL itself is real.

## Files Changed

- `components/GameCard.tsx` — update `parseBody` to handle `[text](url)`, add `[↗]` indicator
- `docs/prompts/system.md` — instruct future phishing card generation to use `[display](url)` format
- `scripts/fix-link-display-text.ts` — one-time migration script

## Out of Scope

- FORENSIC_SIGNALS changes (intentionally excluded)
- Retroactive changes to daily challenge deck selection logic
- Any UI changes beyond the `[↗]` indicator
