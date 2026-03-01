# Retro Phish

A terminal-aesthetic phishing awareness game. Identify phishing emails and SMS messages before they get you.

**Live:** [retro-phish.scottaltiparmak.com](https://retro-phish.scottaltiparmak.com)

## What it is

Retro Phish presents real-world phishing scenarios styled as a retro terminal interface. Players classify each message as phishing or legit, bet confidence levels on their answers, and earn points based on accuracy and streaks. After each round, red flags are highlighted inline so players can see exactly what they missed.

## Features

- 40 phishing and legitimate email/SMS scenarios across easy, medium, and hard difficulty
- Confidence betting: GUESSING (1x), LIKELY (2x), CERTAIN (3x) — risk/reward on every answer
- Streak bonuses every 3 consecutive correct answers
- Rank system: NOVICE → OPERATOR → ANALYST → SPECIALIST → ELITE based on score efficiency
- Daily challenge mode with a shared daily leaderboard
- Global all-time leaderboard
- Inline red flag highlighting on the feedback screen
- Chiptune sound effects via Web Audio API (off by default)
- Swipe or button-click to answer
- PWA-ready

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS v4
- Upstash Redis (leaderboard storage)
- Web Audio API (sounds, no audio files)
- Vercel (hosting)
