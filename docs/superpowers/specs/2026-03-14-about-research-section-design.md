# About This Research — Collapsible Section on Start Screen

## Summary

Add an `ABOUT_THIS_RESEARCH` collapsible section to the start screen, following the same pattern as the existing `SIGNAL GUIDE`. Provides participants and visitors with a brief explanation of the study and links out to the full research write-up.

## Motivation

- Participants should understand what their data contributes to — builds trust and engagement
- The full research write-up already lives at `scottaltiparmak.com/research` — no need to duplicate content in-app
- A `/methodology` page exists but is unlinked; this approach avoids adding another unlinked page and instead surfaces context where users already spend time

## Design

### Placement

- On the start screen, **after the SIGNAL GUIDE section** (around line 373 in `StartScreen.tsx`)
- Visible to **all users** (signed in or not)
- Collapsed by default

### Visual Pattern

Matches the existing SIGNAL GUIDE collapsible exactly:

- `term-border` container with `bg-[#060c06]`
- Use green accent (`rgba(0,255,65,...)`) instead of the amber used by SIGNAL GUIDE, to visually differentiate
- Header button: `[i] ABOUT_THIS_RESEARCH` on the left, `▲`/`▼` toggle on the right
- Collapsed by default via a `showAbout` state boolean

### Content When Expanded

2-3 sentences summarizing the study, followed by a link:

> Threat Terminal is a research platform studying how humans detect AI-generated phishing emails. Every classification you make contributes to an empirical study on which phishing techniques are hardest to spot when AI eliminates traditional red flags like poor grammar.

Then a styled external link:

```
> READ_FULL_RESEARCH → scottaltiparmak.com/research
```

- Opens in a new tab (`target="_blank" rel="noopener noreferrer"`)
- Styled as a terminal-green link with tracking-widest, matching the app aesthetic

### State Management

- Add `showAbout` boolean to the StartScreen component state (alongside existing `showGuide`)
- Toggle on header click, same pattern as `setShowGuide`

## What This Does NOT Include

- No new pages or routes
- No changes to the nav bar
- No changes to the existing `/methodology` page
- No additional content beyond the blurb + link

## Implementation Scope

- **Single file change:** `components/StartScreen.tsx`
- **~20 lines of JSX** following the established collapsible pattern
- **One new state variable:** `showAbout`
