# Retro Phish

A retro terminal phishing awareness game and research platform studying human detection rates for AI-generated phishing across six attack techniques.

**Live:** [retro-phish.scottaltiparmak.com](https://retro-phish.scottaltiparmak.com)

---

## What it is

Retro Phish presents emails in a retro terminal interface. All cards are AI-generated, both phishing and legitimate. Players classify each message, bet confidence on their answer, and earn XP based on accuracy and streak. Forensic signals are revealed after each answer so players can see exactly what they missed.

The game has two modes. **Freeplay** is a standard training mode. **Research Mode** is a structured game mode that collects pseudonymous answer data contributing to a published study on which phishing techniques humans miss most when AI eliminates linguistic quality as a detection signal.

---

## Research

**Study question:** Which phishing techniques are humans most likely to miss when linguistic quality is no longer a reliable detection signal?

**Dataset:** 550 AI-generated cards. 360 phishing across 6 techniques, 190 legitimate. All cards are AI-generated so linguistic quality is held constant as a baseline. Technique is the only independent variable.

**Six phishing techniques, equal volume, controlled difficulty:**

`urgency` · `authority-impersonation` · `credential-harvest` · `hyper-personalization` · `pretexting` · `fluent-prose`

Each technique has 60 cards: 15 easy, 15 medium, 15 hard, 15 extreme. Legitimate cards cover three categories: transactional (70), marketing (60), workplace (60). The dataset is frozen at v1 once 550 approved cards are reached.

**Research Mode deck structure:**

Each Research Mode round draws 10 cards at random from the full dataset. With equal card volume per technique (60 each), technique representation balances naturally at scale. This avoids artificial deck constraints and produces a realistic sampling distribution.

**Data collection:**

Research Mode requires a player account. Answers are linked to a pseudonymous player UUID. Email addresses are held only in Supabase Auth and are never stored in research tables. Our own tables store only UUIDs, game mode, technique, correctness, confidence, and timing signals. No behavioural tracking outside the game session.

**Sample limitation:** Participants are self-selected players who opted into Research Mode and created an account. This is disclosed as a limitation in the published methodology.

- Methodology: [retro-phish.scottaltiparmak.com/methodology](https://retro-phish.scottaltiparmak.com/methodology)
- Live findings: [retro-phish.scottaltiparmak.com/intel](https://retro-phish.scottaltiparmak.com/intel)

---

## Game

**Freeplay:** 10 cards per round drawn randomly from the full dataset. Open to all players, no account required.

**Research Mode:** 10 cards drawn at random from the full dataset (see above). Requires an account. Contributes to the study dataset.

**Core loop:**
- Classify each message as phishing or legitimate
- Bet confidence: GUESSING (1x) · LIKELY (2x) · CERTAIN (3x)
- Earn XP from correct answers and streak bonuses
- Forensic signal breakdown after each round shows what you missed

**Forensic signals revealed after each answer:**
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
- Ambient terminal drone on the start screen (Web Audio API, synthesised, no audio files)
- Terminal click and keypress sounds throughout
- Toggled via SFX button, off by default

---

## Player Accounts

Accounts use email OTP, no password. Enter your email, get a 6-digit code, enter it in-app. Works in PWA context on iOS without a browser redirect.

**XP and progression:**
- 30 levels with compounding XP requirements (~15% per level, ~37,700 XP at level 30)
- 10 ranks tied to level ranges: CLICK_HAPPY · PHISH_BAIT · LINK_CHECKER · HEADER_READER · SOC_ANALYST · THREAT_HUNTER · INCIDENT_HANDLER · RED_TEAMER · APT_ANALYST · ZERO_DAY
- Personal best score, session history, and background tracked per account

**Expert Mode:**
- Unlocked after completing 10 Research Mode sessions
- Draws exclusively from extreme difficulty cards
- Double XP

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Auth | Supabase Auth (email OTP, no passwords) |
| Database | Supabase (PostgreSQL): cards, players, answers, sessions |
| Leaderboard | Upstash Redis: global + daily sorted sets |
| Hosting | Vercel, auto-deploys from master |
| Card generation | Claude Haiku + Sonnet (3 Haiku + 1 Sonnet per 20-card batch) |
| Email | Resend (SMTP via scottaltiparmak.com) |
| PWA | Service worker with auto-update broadcast, no HTML caching |

---

## Card Generation Pipeline

1. Prompt templates in `docs/prompts/` define technique, difficulty, and format
2. `scripts/generate-batch.sh` generates cards via Claude API and writes to `cards_staging` with `status=pending`
3. `/admin` review dashboard: approve, reject, or flag for follow-up
4. Approved cards land in `cards_real` and go live immediately
5. Dataset freezes at 550 approved cards (v1)

---

## License

MIT
