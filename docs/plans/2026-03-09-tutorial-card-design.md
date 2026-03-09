# Tutorial Card — Design

## Overview

A static training card shown once to first-time Research Mode players, after the ResearchIntro disclaimer. Teaches forensic signals and confidence betting through example before the first real round begins.

## Flow

```
ResearchIntro → [BEGIN RESEARCH]
  → check profile.researchAnswersSubmitted === 0
    → yes: phase = 'tutorial' → TutorialCard
    → no:  phase = 'loading' → playing (unchanged)

TutorialCard → [GOT IT — START RESEARCH]
  → phase = 'loading' → playing
```

Trigger: `profile.researchAnswersSubmitted === 0` (no new DB field or localStorage key needed).

## Component

New `TutorialCard` component. Separate from `GameCard` — same visual structure, but:
- No swipe interaction
- No confidence selector
- No answer buttons
- No answer logging
- No timer

## Fake Card Content

Designed to surface every forensic signal simultaneously:

| Field | Value | Signal demonstrated |
|-------|-------|---------------------|
| FROM | `security-alerts@paypa1.com` | Typosquatted domain (1 not l) |
| SUBJ | `Urgent: Your account has been limited` | Urgency language |
| SENT | `3:14 AM` | Odd send hour |
| ATCH | `account_recovery.zip` | Suspicious attachment |
| AUTH | SPF: FAIL / DKIM: FAIL / DMARC: FAIL | Authentication failure |
| Reply-To | `support@gmail-helpdesk.com` | Free provider mismatch |
| Body | Urgent copy with one URL | Pressure + link |
| URL | `http://paypa1-secure.com/verify?token=a9f3k2` | Typosquatted URL |

Headers panel starts **pre-expanded** so AUTH is immediately visible.
URL inspector is interactive (tap to reveal full URL).
FROM [↗] is interactive (tap to reveal full email address).

## Annotation Strip

Amber-bordered banner rendered above the card:

```
TRAINING_SIMULATION
This card demonstrates the forensic signals used in Research Mode.
Tap [HEADERS], URLs, and [↗] on the sender to explore each tool.
```

## Confidence Block

Static section below the annotation strip, above the card:

```
CONFIDENCE BETTING
Before answering each card, set your confidence level:
  GUESSING  1× — no penalty if wrong
  LIKELY    2× — lose 100 pts if wrong
  CERTAIN   3× — lose 200 pts if wrong
Don't bet CERTAIN unless you're sure.
```

## Bottom Action

Full-width green button, same style as ResearchIntro CTA:

```
[ GOT IT — START RESEARCH ]
```

No confidence selector. No PHISHING/LEGIT buttons.

## Game.tsx Changes

- Add `'tutorial'` to the `Phase` union type
- After `research_intro` completes (`handleResearchIntroComplete`), check `profile.researchAnswersSubmitted === 0`
  - If true: `setPhase('tutorial')`
  - If false: proceed to `loading` → `playing` as today
- Render `<TutorialCard onComplete={() => startRound(pendingMode)} />` in the tutorial phase
