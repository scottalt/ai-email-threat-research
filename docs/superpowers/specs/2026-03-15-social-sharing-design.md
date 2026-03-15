# Social Sharing from Round Summary

## Overview

Add a share button to the round summary screen that lets players share their results as text + link. Uses `navigator.share` on supported devices (mobile) with copy-to-clipboard as universal fallback. No platform-specific integrations (no Twitter/X buttons).

## Share Text Format

### Signed-in player (has rank)

```
🎣 THREAT_HUNTER · 9/10 · 2,650 pts
Can you spot the phish? Most people can't.
https://threatterminal.ai/?ref=share
```

### Guest (no rank, uses tier label)

```
🎣 SHARP_ANALYST · 8/10 · 2,100 pts
Can you spot the phish? Most people can't.
https://threatterminal.ai/?ref=share
```

### Daily challenge (adds date tag)

```
🎣 THREAT_HUNTER · 9/10 · 2,650 pts · Mar 15 Daily
Can you spot the phish? Most people can't.
https://threatterminal.ai/?ref=share
```

### Expert mode (adds expert tag)

```
🎣 THREAT_HUNTER · 9/10 · 2,650 pts · Expert
Can you spot the phish? Most people can't.
https://threatterminal.ai/?ref=share
```

### Mode tagging rules

- `daily` → append ` · Mon DD Daily`
- `expert` → append ` · Expert`
- `freeplay`, `research`, `preview` → no tag

## Behavior

1. Player taps **SHARE RESULTS** button in round summary
2. If `navigator.share` is available → open native share sheet with structured data:
   ```ts
   navigator.share({
     title: 'Threat Terminal',
     text: '🎣 THREAT_HUNTER · 9/10 · 2,650 pts\nCan you spot the phish? Most people can\'t.',
     url: 'https://threatterminal.ai/?ref=share',
   })
   ```
   The URL is passed separately so share targets can render it as a tappable link. On dismissal or error, silently swallow — no user feedback needed (the OS already showed the sheet).
3. If `navigator.share` is not available (desktop browsers) → copy full text (including URL) to clipboard, button text changes to **COPIED ✓** for 2 seconds then reverts
4. No new routes or landing pages — link points to homepage with `?ref=share` query param

## UI Placement

The share button sits between the round log (or weakness tracker in research mode) and the sign-in prompt / "BACK TO TERMINAL" button. Same `term-border` styling as other summary elements.

```
┌─────────────────────────────┐
│  XP EARNED / ACHIEVEMENTS   │
├─────────────────────────────┤
│  SCORE HEADER (accuracy)    │
├─────────────────────────────┤
│  PHISHING / LEGIT BREAKDOWN │
├─────────────────────────────┤
│  ROUND_LOG                  │
├─────────────────────────────┤
│  COGNITIVE_BLIND_SPOTS      │  ← research mode only
├─────────────────────────────┤
│  [ SHARE RESULTS ]          │  ← NEW
├─────────────────────────────┤
│  XP_TRACKING (sign-in)      │  ← guests only
├─────────────────────────────┤
│  [ BACK TO TERMINAL ]       │
└─────────────────────────────┘
```

### Button Design

- Full-width, same style as "BACK TO TERMINAL" button
- Text: `[ SHARE RESULTS ]` → `[ COPIED ✓ ]` on clipboard fallback (2s)
- Border color: `rgba(0,255,65,0.35)` (matches terminal aesthetic)
- No external icons or platform logos

## Data Sources

All data is already available in `RoundSummary` props and hooks:

| Field | Source |
|-------|--------|
| Score (e.g., 9/10) | `score` / `total` props |
| Points (e.g., 2,650) | `totalScore` prop |
| Rank title | `usePlayer()` → `profile.level` → `getRankFromLevel()` |
| Tier label (guest fallback) | `getTier(score, total).label` |
| Game mode | `mode` prop |
| Date (for daily) | `new Date()` formatted as "Mon DD" |

## Share Text Construction

Single function `buildShareText()` in `RoundSummary.tsx` (no separate util file needed):

```ts
function buildShareText(opts: {
  label: string;       // rank title or tier label
  score: number;
  total: number;
  totalScore: number;
  mode: GameMode;
}): { text: string; url: string }
```

- The caller resolves `label` before invoking `buildShareText()` — signed-in players pass their rank label from `getRankFromLevel()`, guests pass `getTier().label`. This keeps `getTier()` private to the component.
- Daily mode appends formatted date, expert mode appends "Expert", other modes have no tag
- Returns `{ text: string; url: string }` — `text` is the first two lines (headline + tagline), `url` is the share link. This allows structured `navigator.share({ title, text, url })` calls while also supporting clipboard fallback (concatenate text + url).

## Scope

### In scope
- Share button in RoundSummary
- `navigator.share` with clipboard fallback
- Share text with rank/tier, score, points, optional daily date tag
- `?ref=share` query param on link

### Out of scope
- Platform-specific share buttons (Twitter/X, LinkedIn, etc.)
- Shareable image cards or OG image generation
- Share analytics tracking beyond query param
- Share from profile page or leaderboard

## Implementation Notes

- All changes are in `components/RoundSummary.tsx` — no new files, routes, or API endpoints
- `navigator.share` availability check: `typeof navigator !== 'undefined' && !!navigator.share`
- Production URL should come from `NEXT_PUBLIC_SITE_URL` or be hardcoded to the production domain
- Clipboard API: `navigator.clipboard.writeText()` — widely supported, no polyfill needed
