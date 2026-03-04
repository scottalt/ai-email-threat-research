# Retro Phish

A retro terminal phishing awareness game and anonymised research platform studying human detection rates for AI-generated phishing across six attack techniques.

**Live:** [retro-phish.scottaltiparmak.com](https://retro-phish.scottaltiparmak.com)

---

## What it is

Retro Phish presents AI-generated phishing and legitimate emails/SMS in a retro terminal interface. Players classify each message, bet confidence on their answer, and earn XP based on accuracy and streak. After each round, forensic signals are highlighted so players can see exactly what they missed.

The game doubles as a research platform. **Research Mode** collects anonymised answer data contributing to a published study on which phishing techniques humans miss most when AI eliminates linguistic quality as a detection signal.

---

## Research

**Study question:** Which phishing techniques are humans most likely to miss when linguistic quality is no longer a reliable detection signal?

The dataset is 550 AI-generated cards — 360 phishing across 6 techniques and 190 legitimate. All cards are AI-generated so linguistic quality is held constant as a baseline. Technique is the only independent variable.

**Six phishing techniques, equal volume, controlled difficulty:**

`urgency` · `authority-impersonation` · `credential-harvest` · `hyper-personalization` · `pretexting` · `fluent-prose`

Each technique has 60 cards split across easy / medium / hard difficulty tiers. The dataset is frozen at v1 once 550 approved cards are reached.

Research Mode answers are collected anonymously — no PII, no tracking. Each session gets a UUID generated in memory only. Results will be published once 600+ answers per technique are collected.

- Methodology: [retro-phish.scottaltiparmak.com/methodology](https://retro-phish.scottaltiparmak.com/methodology)
- Live findings: [retro-phish.scottaltiparmak.com/intel](https://retro-phish.scottaltiparmak.com/intel)

---

## Game

**Core loop:**
- 10 cards per round drawn from the dataset
- Classify each as phishing or legitimate
- Bet confidence: GUESSING (1x) · LIKELY (2x) · CERTAIN (3x)
- Earn XP from correct answers and streak bonuses
- Post-round forensic signal breakdown shows what you missed

**Forensic signals shown after each card:**
- SPF / DKIM / DMARC auth status
- Reply-To mismatch detection
- Send timestamp analysis (odd hours, unusual timezone offsets)
- URL inspector (tappable links reveal destinations)
- Attachment name analysis

**Leaderboards:**
- Global all-time (score-based)
- Daily challenge (shared deterministic deck, one attempt per day)
- XP leaderboard (account holders only)

**Sound:**
- Ambient terminal drone on the start screen (Web Audio API, synthesised — no audio files)
- Terminal click and keypress sounds throughout
- Toggled via SFX button, off by default

---

## Player Accounts

Accounts use email OTP — no password. You enter your email, get a 6-digit code, enter it in-app. Works in PWA context on iOS without any browser redirect.

**XP and progression:**
- 30 levels with compounding XP requirements (~15% per level, ~37,700 XP at level 30)
- 10 ranks tied to level ranges: CLICK_HAPPY · PHISH_BAIT · LINK_CHECKER · HEADER_READER · SOC_ANALYST · THREAT_HUNTER · INCIDENT_HANDLER · RED_TEAMER · APT_ANALYST · ZERO_DAY
- Personal best score, session history, and background tracked per account

**Expert Mode:**
- Unlocked after completing 10 Research Mode sessions (research_graduated)
- Pulls exclusively from extreme difficulty cards
- Double XP

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Auth | Supabase Auth (email OTP, no passwords) |
| Database | Supabase (PostgreSQL) — cards, players, answers, sessions |
| Leaderboard | Upstash Redis — global + daily sorted sets |
| Hosting | Vercel — auto-deploys from master |
| Card generation | Claude Haiku + Sonnet (3 Haiku + 1 Sonnet per 20-card batch) |
| Email | Resend (SMTP via scottaltiparmak.com) |
| PWA | Service worker with auto-update broadcast, no HTML caching |

---

## Card Generation Pipeline

1. Prompt templates in `docs/prompts/` define technique, difficulty, and format
2. `scripts/generate-batch.sh` generates cards via Claude API → `cards_staging` table with `status=pending`
3. `/admin` review dashboard — approve, reject, or flag for follow-up
4. Approved cards land in `cards_real` and become live immediately
5. Dataset freezes at 550 approved cards (v1)

---

## License

MIT
