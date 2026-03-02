# Headers Panel — Design Doc

**Date:** 2026-03-02
**Status:** Approved

## Problem

The current `AuthBadge` component passively reveals auth status in the email header bar. It hands players the answer without requiring investigation, undermining both game realism and research value. A player who spots `[AUTH: FAIL]` doesn't need to read the email.

## Solution

Replace `AuthBadge` with a neutral `[HEADERS]` button. Players must actively open the panel to see auth results. The panel inserts between the FROM/SUBJ metadata row and the email body — semantically correct (headers precede body) and consistent with how real email clients expose this information.

## Design Decisions

### Button appearance
Neutral — no color hint before opening. Maximum realism. Matches how actual email clients show header expand controls. Preserves the research signal: we can track whether clicking headers correlates with correct answers.

### Panel placement
Between the FROM/SUBJ metadata section and the body. Dismissed with `[ × ]`. State is one `useState<boolean>` in `EmailDisplay`. SMS cards unchanged (SPF/DKIM/DMARC don't apply to SMS).

### Fields shown
- SPF
- DKIM
- DMARC
- Reply-To
- Return-Path

### Color coding inside the panel
- PASS → `#00aa28` green
- FAIL → `#ff3333` red (glow-red)
- NONE → `#ffaa00` amber

## Auth Status Distribution (Breaking the Cheat Pattern)

The critical design constraint: headers must be a signal, not an answer. The current 1:1 mapping (legit=PASS, phishing=FAIL/NONE) makes the panel a difficulty-stratified answer key. Real-world email auth is noisy — this must be reflected.

### Target distribution

| Segment | PASS | NONE | FAIL |
|---|---|---|---|
| Legit transactional (70) | 80% | 18% | 2% |
| Legit marketing (60) | 75% | 20% | 5% |
| Legit workplace (60) | 82% | 18% | 0% |
| Phishing easy (60) | 0% | 15% | 85% |
| Phishing medium (60) | 5% | 15% | 80% |
| Phishing hard (60) | 45% | 40% | 15% |
| Phishing extreme (60) | 60% | 30% | 10% |

### Rationale for noise

**Legit NONE/FAIL:** Small senders, nonprofits, forwarded emails, community orgs, legacy systems — realistically have no SPF/DKIM configured. 2-5% FAIL covers misconfigured legitimate senders.

**Phishing hard/extreme PASS:** Sophisticated attackers register lookalike domains and set up proper SPF/DKIM. The headers pass because the attacker controls the sending domain. This is the most realistic hard phishing scenario and the most important one for the research question.

### Interpretation for players

- FAIL: suspicious, but not proof (some legit mail fails)
- PASS: reassuring, but not safe (some phishing passes)
- NONE: neutral — many legitimate senders have no auth configured

## Implementation Approach

### New cards (going forward)
Encode `authStatus` in the generation prompt. The model has full context (sender domain, industry, technique, difficulty) and can make a contextually appropriate call.

### Existing approved cards (~105)
One-time batch update using rules derived from difficulty + card category. Admin review UI provides override capability for any card that looks wrong.

### Field derivation in the panel (v1)
Values are derived from the existing `authStatus` field on `Card`. No new card fields required for v1.

| authStatus | SPF | DKIM | DMARC | Reply-To | Return-Path |
|---|---|---|---|---|---|
| `verified` | PASS | PASS | PASS | matches FROM | matches FROM |
| `fail` | FAIL | FAIL | FAIL | matches FROM | matches FROM |
| `unverified` | NONE | NONE | NONE | NOT PRESENT | NOT PRESENT |

Note: The `replyTo` field (backlog item #2) will allow Reply-To to show actual mismatched addresses on hard/extreme phishing cards. When that field lands, the panel will use it instead of deriving from authStatus.

## Files to Change

- `lib/types.ts` — no changes needed (authStatus already exists)
- `components/GameCard.tsx` — remove `AuthBadge`, add `[HEADERS]` button + panel in `EmailDisplay`
- `app/globals.css` — no new animations needed
- `data/cards.ts` — batch update authStatus on existing legit cards to add NONE/FAIL noise
- Generation prompt templates — add authStatus field with distribution guidance

## Out of Scope (v1)

- `replyTo` field on Card type (backlog #2)
- Actual mismatched Reply-To addresses on hard/extreme phishing (requires replyTo field)
- sentAt timestamp (backlog #3)
