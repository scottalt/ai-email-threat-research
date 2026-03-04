# Design: Forensic Signals Feedback Section

**Date:** 2026-03-02
**Status:** Approved

## Problem

Post-answer feedback (FeedbackCard) surfaces body-visible red flags via `RED_FLAGS_DETECTED` (clues) and a paragraph explanation (`ANALYST_NOTES`). Three signal categories are never mentioned:

1. **Auth status** — SPF/DKIM/DMARC result visible in the [HEADERS] panel
2. **Reply-To mismatch** — attacker-controlled reply address visible in [HEADERS]
3. **URL presence** — suspicious links inspectable via the URL inspector

Players who used these tools get no validation of that reasoning. Players who didn't get no guidance to use them next time.

## Solution

Add a new `FORENSIC_SIGNALS` section to `FeedbackCard.tsx`, rendered on all cards (phishing and legit). Signals are derived dynamically from card data — no AI regeneration needed, works for existing cards.

## Signals

| Signal | Condition | Message |
|---|---|---|
| Auth FAIL | `authStatus === 'fail'` | `SPF/DKIM/DMARC: FAIL — sender could not authenticate with the claimed domain. Strong indicator of spoofing.` |
| Auth NONE (phishing) | `authStatus === 'unverified' && isPhishing` | `SPF/DKIM/DMARC: NONE — authentication headers absent, consistent with domain spoofing.` |
| Auth NONE (legit) | `authStatus === 'unverified' && !isPhishing` | `SPF/DKIM/DMARC: NONE — small senders often lack email authentication. Absence of auth headers alone is not a reliable phishing indicator.` |
| Auth PASS (phishing) | `authStatus === 'verified' && isPhishing` | `SPF/DKIM/DMARC: PASS — attacker registered a lookalike domain with valid authentication. Headers are clean; the domain name itself is the tell.` |
| Auth PASS (legit) | `authStatus === 'verified' && !isPhishing` | `SPF/DKIM/DMARC: PASS — sender domain authenticated correctly.` |
| Reply-To mismatch | `card.replyTo` is set | `Reply-To: {replyTo} — replies would route to the attacker's address, not the sender's domain.` |
| URL present | URLs detected in `card.body` | `This email contained URLs. The URL inspector reveals the full destination before clicking.` |

## Design

- **Section label:** `FORENSIC_SIGNALS`
- **Header color:** amber (`text-[#ffaa00]`) to distinguish from content-based signals
- **Bullet prefix:** `▸` in amber
- **Placement:** after `ANALYST_NOTES`, before `RED_FLAGS_DETECTED`
- **Scope:** all cards (phishing and legit)
- **URL detection:** reuse existing `parseBody()` function from `GameCard.tsx`, or inline equivalent

## Files Changed

- `components/FeedbackCard.tsx` — add `FORENSIC_SIGNALS` section
