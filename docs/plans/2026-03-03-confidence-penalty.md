# Confidence Penalty Scoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Penalize wrong answers based on confidence level — "likely" wrong costs -100pts, "certain" wrong costs -200pts, "guessing" wrong stays at 0.

**Architecture:** Two file changes. `Game.tsx` gets a `CONFIDENCE_PENALTY` map and updated scoring logic with a floor clamp. `RoundSummary.tsx` gets a display fix so negative `pointsEarned` renders correctly (currently hardcodes `+` prefix).

**Tech Stack:** React, TypeScript, Next.js App Router

---

### Task 1: Update scoring logic in Game.tsx

**Files:**
- Modify: `components/Game.tsx`

**Context:**

Current constants (lines 16–22):
```tsx
const BASE_POINTS = 100;
const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  guessing: 1,
  likely: 2,
  certain: 3,
};
const STREAK_BONUS = 50;
```

Current `pointsEarned` calculation (lines 173–175):
```tsx
const pointsEarned = correct
  ? BASE_POINTS * CONFIDENCE_MULTIPLIER[confidence] + streakBonus
  : 0;
```

Current `setTotalScore` (line 183):
```tsx
setTotalScore((prev) => prev + pointsEarned);
```

**Step 1: Add CONFIDENCE_PENALTY constant**

After the `CONFIDENCE_MULTIPLIER` block (after line 21), add:

```tsx
const CONFIDENCE_PENALTY: Record<Confidence, number> = {
  guessing: 0,
  likely: -100,
  certain: -200,
};
```

**Step 2: Update pointsEarned calculation**

Replace lines 173–175:
```tsx
const pointsEarned = correct
  ? BASE_POINTS * CONFIDENCE_MULTIPLIER[confidence] + streakBonus
  : 0;
```

With:
```tsx
const pointsEarned = correct
  ? BASE_POINTS * CONFIDENCE_MULTIPLIER[confidence] + streakBonus
  : CONFIDENCE_PENALTY[confidence];
```

**Step 3: Clamp totalScore to floor of 0**

Replace line 183:
```tsx
setTotalScore((prev) => prev + pointsEarned);
```

With:
```tsx
setTotalScore((prev) => Math.max(0, prev + pointsEarned));
```

**Step 4: Build check**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, build succeeds.

**Step 5: Commit**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add components/Game.tsx && git commit -m "feat: add confidence penalty scoring with score floor"
```

---

### Task 2: Fix pointsEarned display in RoundSummary.tsx

**Files:**
- Modify: `components/RoundSummary.tsx`

**Context:**

The round log renders each result's points at line 225–227:
```tsx
<span className={`text-xs font-mono font-bold ${r.correct ? 'text-[#00ff41]' : 'text-[#003a0e]'}`}>
  +{r.pointsEarned}
</span>
```

The hardcoded `+` prefix means a penalty of -100 would render as `+-100`. The color is also wrong — penalized wrong answers should show in red (`text-[#ff3333]`), not the dim `text-[#003a0e]`.

**Step 1: Fix the display**

Replace lines 225–227:
```tsx
<span className={`text-xs font-mono font-bold ${r.correct ? 'text-[#00ff41]' : 'text-[#003a0e]'}`}>
  +{r.pointsEarned}
</span>
```

With:
```tsx
<span className={`text-xs font-mono font-bold ${
  r.pointsEarned > 0 ? 'text-[#00ff41]'
  : r.pointsEarned < 0 ? 'text-[#ff3333]'
  : 'text-[#003a0e]'
}`}>
  {r.pointsEarned > 0 ? `+${r.pointsEarned}` : r.pointsEarned}
</span>
```

This renders:
- Correct answers: green `+100` / `+200` / `+300`
- Penalized wrong answers: red `-100` / `-200`
- Zero-point wrong answers (guessing): dim `0`

**Step 2: Build check**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, build succeeds.

**Step 3: Commit**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add components/RoundSummary.tsx && git commit -m "fix: render negative pointsEarned correctly in round log"
```

---

### Task 3: Manual verification

**Scoring logic:**
1. Play a round, answer a card wrong with "certain" — round log should show `-200` in red
2. Answer a card wrong with "likely" — round log should show `-100` in red
3. Answer a card wrong with "guessing" — round log should show `0` in dim
4. Answer correctly with "certain" — should show `+300` in green

**Score floor:**
5. Start a round, answer the first card wrong with "certain" from a score of 0 — total score should stay at 0, not go to -200

**Streak bonus unaffected:**
6. Get 3 correct in a row — streak bonus still fires, shows `+350` (300 + 50) on the third

**Push:**
```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git push
```
