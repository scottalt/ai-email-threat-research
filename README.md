# Retro Phish

A cybersecurity research game measuring how humans detect AI-generated phishing emails. Built as a retro terminal experience.

**Live:** [research.scottaltiparmak.com](https://research.scottaltiparmak.com)

<p align="center">
  <img src="docs/menu.jpg" alt="Terminal boot screen" width="280" />
  <img src="docs/example.jpg" alt="Email analysis gameplay" width="280" />
  <img src="docs/roundsummary.jpg" alt="Round summary with score" width="280" />
</p>

---

## The Problem

AI can now generate phishing emails with perfect grammar, flawless spelling, and convincing context. The old signals (broken English, awkward phrasing, obvious typos) no longer apply. So how do humans detect phishing in 2026?

## What This Is

Retro Phish is a game and live research platform. Players read AI-generated emails in a retro terminal interface, decide if each one is phishing or legitimate, and bet their confidence. Every answer contributes to a live dataset measuring which phishing techniques humans miss most when linguistic quality is no longer a reliable signal.

No security background needed. If you use email, you're a valid research participant.

---

## Game Modes

| Mode | Description | Access |
|------|-------------|--------|
| **Research Mode** | 10 cards per round from the research dataset. Every answer contributes to the live study. | Requires sign-in |
| **Freeplay** | 10 random cards per round. Unlimited replays. | Open to all |
| **Daily Challenge** | Same 10 cards for all players each day. Resets at UTC midnight. One attempt per day. | Unlocked after 30 research answers |
| **Expert Mode** | Extreme difficulty only. Double XP. | Unlocked after 30 research answers |

**Core loop:**
- Read an email and classify it as phishing or legitimate
- Bet confidence: GUESSING (1x) · LIKELY (2x) · CERTAIN (3x)
- Earn XP from correct answers and streak bonuses
- Forensic signal breakdown after each answer shows what you missed

**Forensic signals available during gameplay:**
- Sender domain inspection (tap to reveal full email address)
- SPF / DKIM / DMARC authentication headers
- Reply-To mismatch detection
- Send timestamp analysis
- URL destination inspector (tap any link)
- Attachment filename analysis

---

## Research

**Study question:** Which phishing techniques are humans most likely to miss when linguistic quality is no longer a reliable detection signal?

**Dataset:** 1,000+ AI-generated email cards. Phishing cards span 6 techniques, legitimate cards cover transactional, marketing, and workplace categories. All cards are AI-generated so linguistic quality is held constant. Technique is the independent variable.

**Six phishing techniques under study:**

`urgency` · `authority-impersonation` · `credential-harvest` · `hyper-personalization` · `pretexting` · `fluent-prose`

**Data collection:** Research Mode requires a player account. Answers are linked to a pseudonymous player UUID. Email addresses are held only in Supabase Auth and are never stored in research tables. No behavioural tracking outside the game session.

**Recorded per answer:** classification, confidence level, response time, whether headers were opened, whether URLs were inspected, position within the session, card difficulty, and technique.

**Not recorded:** email address, IP address, location, or any identifying information.

Players optionally self-report their professional background: `NON-TECHNICAL`, `TECHNICAL / NON-SECURITY`, or `INFOSEC / CYBERSECURITY`. This enables comparison of bypass rates across expertise levels.

**Intel Briefing:** After submitting 30 research answers, players unlock the Intel Briefing, a live dashboard showing aggregate findings from all participants including overall bypass rates, accuracy by background, and technique effectiveness.

- Methodology: [research.scottaltiparmak.com/methodology](https://research.scottaltiparmak.com/methodology)

---

## Progression

- **30 levels** with compounding XP requirements
- **10 ranks:** CLICK_HAPPY · PHISH_BAIT · LINK_CHECKER · HEADER_READER · SOC_ANALYST · THREAT_HUNTER · INCIDENT_HANDLER · RED_TEAMER · APT_ANALYST · ZERO_DAY
- **Leaderboards:** XP (global, account holders) and Daily Challenge (score-based, resets daily)
- **Expert Mode + Intel Briefing** unlock after 30 research answers

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS v4 |
| Auth | Supabase Auth (email OTP, no passwords) |
| Database | Supabase (PostgreSQL) |
| Cache / Rate Limiting | Upstash Redis |
| Hosting | Vercel |
| Email | Resend (SMTP via scottaltiparmak.com) |
| Card Generation | Claude (Anthropic API) |
| Analytics | Vercel Analytics |
| PWA | Service worker with auto-update, installable on mobile |

---

## Card Pools

| Pool | Cards | Difficulties | Used By |
|------|-------|-------------|---------|
| Daily / Freeplay | 450+ | Easy, Medium, Hard | Daily Challenge, Freeplay |
| Expert | 180+ | Extreme | Expert Mode |
| Research | 1,000+ | Easy → Extreme | Research Mode (frozen dataset) |

Each pool is independent. Research cards are never reused in other game modes.

---

## Sound

- Ambient cyberpunk background music (loopable, low volume)
- Terminal click and keypress sound effects
- All sound off by default, toggled via SFX button

---

## License

MIT
