# Retro Phish

A retro terminal phishing awareness game and anonymised research platform studying human detection rates for AI-generated phishing across six attack techniques.

**Live:** [retro-phish.scottaltiparmak.com](https://retro-phish.scottaltiparmak.com)

## What it is

Retro Phish presents AI-generated phishing and legitimate emails/SMS in a retro terminal interface. Players classify each message, bet confidence on their answer, and earn points based on accuracy and streak. After each round, forensic signals are highlighted so players can see exactly what they missed.

The game doubles as a research platform. **Research Mode** collects anonymised answer data contributing to a published study on which phishing techniques humans miss most when AI eliminates linguistic quality as a detection signal.

## Research

**Study question:** Which phishing techniques are humans most likely to miss when linguistic quality is no longer a reliable detection signal?

The dataset is 550 AI-generated cards (360 phishing across 6 techniques + 190 legitimate), deliberately all generated so linguistic quality is held constant as a baseline — technique is the only independent variable.

Six phishing techniques are studied with equal volume and controlled difficulty:
`urgency` · `authority-impersonation` · `credential-harvest` · `hyper-personalization` · `pretexting` · `fluent-prose`

Research Mode answers are collected anonymously (no PII, no accounts, session UUID in memory only) and will be published once 600+ answers per technique are collected.

- Methodology: [retro-phish.scottaltiparmak.com/methodology](https://retro-phish.scottaltiparmak.com/methodology)
- Live findings: [retro-phish.scottaltiparmak.com/intel](https://retro-phish.scottaltiparmak.com/intel)

## Game Features

- 10 cards per round drawn from a 550-card AI-generated dataset
- Confidence betting: GUESSING (1x), LIKELY (2x), CERTAIN (3x)
- Streak bonuses every 3 consecutive correct answers
- Rank system: NOVICE → OPERATOR → ANALYST → SPECIALIST → ELITE
- Daily challenge mode with a shared daily leaderboard
- Global all-time leaderboard
- Forensic signal panel: SPF/DKIM/DMARC headers, Reply-To mismatch, send time, URL inspector, attachment name
- Inline red flag highlighting on feedback screen
- Swipe or button-click to answer
- Chiptune sound effects via Web Audio API (off by default)
- PWA-ready

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Database:** Supabase (PostgreSQL) — card storage, answer collection, research data
- **Leaderboard:** Upstash Redis (global + daily)
- **Hosting:** Vercel (master branch → auto-deploy)
- **Generation:** GPT-4o + Claude 3.5 Haiku/Sonnet via documented prompt templates

## Local Development

```bash
npm install
npm run dev
```

Required environment variables:

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
KV_URL
KV_REST_API_URL
KV_REST_API_TOKEN
KV_REST_API_READ_ONLY_TOKEN
ADMIN_PASSWORD
```
