# Leaderboard Fix + XP Per Question Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix leaderboard submission being silently blocked when XP PATCH fails, and show XP earned per answer on the FeedbackCard.

**Architecture:** Two independent changes. (1) Decouple leaderboard submission from `xpResult` — use `profile.level` directly so it fires as soon as signed in. (2) Pass `mode` to `FeedbackCard` and display `+10 XP` (or `+20` for expert) on correct answers using the existing `XP_PER_CORRECT` constant.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4

---

### Task 1: Fix leaderboard submission in RoundSummary

**Files:**
- Modify: `components/RoundSummary.tsx`

The leaderboard `useEffect` currently guards on `if (!xpResult) return`, which silently blocks submission if the XP PATCH fails. Remove this dependency.

**Step 1: Edit RoundSummary.tsx — change the leaderboard useEffect**

Find the leaderboard `useEffect` (around line 101) and make these changes:
- Remove `if (!xpResult) return;`
- Change `level: xpResult.level` to `level: profile?.level ?? 1`
- Change the deps array from `[signedIn, profile?.displayName, xpResult]` to `[signedIn, profile?.displayName]`

The effect should look like this after the change:

```tsx
useEffect(() => {
  if (!signedIn || !profile?.displayName || leaderboardFired.current) return;
  leaderboardFired.current = true;
  setSubmitState('loading');
  fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: profile.displayName,
      score: totalScore,
      level: profile.level ?? 1,
      sessionId,
      ...(mode === 'daily' ? { date } : {}),
    }),
  })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data) {
        setSubmitState('done');
        Promise.all([
          fetch('/api/leaderboard').then(r => r.ok ? r.json() : []),
          fetch(`/api/leaderboard?date=${date}`).then(r => r.ok ? r.json() : []),
        ]).then(([global, daily]) => {
          setGlobalLeaderboard(global);
          setDailyLeaderboard(daily);
        }).catch(() => {});
      } else {
        setSubmitState('error');
      }
    })
    .catch(() => { setSubmitState('error'); });
}, [signedIn, profile?.displayName]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Step 2: Verify the XP panel still works independently**

The XP panel (`signedIn && xpResult && (...)`) still depends on `xpResult` and is unaffected. The leaderboard and XP panels are now fully independent. No other changes needed in this file.

**Step 3: Commit**

```bash
git add components/RoundSummary.tsx
git commit -m "fix: decouple leaderboard submission from xpResult to prevent silent block"
```

---

### Task 2: Show XP per question on FeedbackCard

**Files:**
- Modify: `components/FeedbackCard.tsx`
- Modify: `components/Game.tsx`
- Modify: `lib/xp.ts` (no change needed — `XP_PER_CORRECT` already exported)

**Step 1: Add `mode` prop to FeedbackCard**

In `components/FeedbackCard.tsx`, update the `Props` interface to include `mode`:

```tsx
import type { RoundResult, GameMode } from '@/lib/types';
import { XP_PER_CORRECT } from '@/lib/xp';

interface Props {
  result: RoundResult;
  streak: number;
  totalScore: number;
  onNext: () => void;
  questionNumber: number;
  total: number;
  sessionId: string;
  mode: GameMode;
}
```

Update the function signature:
```tsx
export function FeedbackCard({ result, streak, totalScore, onNext, questionNumber, total, sessionId, mode }: Props) {
```

**Step 2: Compute XP earned this answer**

Add this near the top of the function body (after destructuring `result`):

```tsx
const xpMultiplier = mode === 'expert' ? 2 : 1;
const xpThisAnswer = correct ? XP_PER_CORRECT * xpMultiplier : 0;
```

**Step 3: Add XP display to the result header footer**

The result header footer is the `border-t` div at the bottom of the result header block (around line 141). It currently shows CONFIDENCE and points. Add XP after the points:

```tsx
<div className={`border-t px-3 py-2 flex items-center justify-between ${correct ? 'border-[rgba(0,255,65,0.25)]' : 'border-[rgba(255,51,51,0.25)]'}`}>
  <span className="text-xs font-mono text-[#00aa28]">
    CONFIDENCE: <span className="text-[#00ff41]">{CONFIDENCE_LABEL[confidence]}</span>
    {' '}({CONFIDENCE_MULTI[confidence]})
  </span>
  <span className="text-xs font-mono text-[#003a0e]">
    {xpThisAnswer > 0 ? (
      <span className="text-[#00ff41]">+{xpThisAnswer} XP</span>
    ) : (
      <span className="text-[#003a0e]">+0 XP</span>
    )}
  </span>
  <span className={`text-sm font-black font-mono ${
    pointsEarned > 0 ? 'text-[#00ff41] glow'
    : pointsEarned < 0 ? 'text-[#ff3333]'
    : 'text-[#003a0e]'
  }`}>
    {pointsEarned > 0 ? `+${pointsEarned}` : pointsEarned} PTS
  </span>
</div>
```

**Step 4: Pass `mode` from Game.tsx to FeedbackCard**

In `components/Game.tsx`, find the `FeedbackCard` usage (around line 381) and add `mode`:

```tsx
<FeedbackCard
  result={lastResult}
  streak={streak}
  totalScore={totalScore}
  onNext={handleNext}
  questionNumber={currentIndex + 1}
  total={ROUND_SIZE}
  sessionId={sessionId.current}
  mode={mode}
/>
```

**Step 5: Verify build compiles**

```bash
npm run build
```

Expected: no TypeScript errors.

**Step 6: Commit**

```bash
git add components/FeedbackCard.tsx components/Game.tsx
git commit -m "feat: show XP earned per answer on FeedbackCard"
```

---

### Task 3: Deploy

```bash
git push origin master
```

Vercel will auto-deploy from master. Check the live site to verify:
- Daily mode: leaderboard submits ("SCORE LOGGED. GL HF." appears after round ends)
- Any mode: correct answer shows `+10 XP` (or `+20` in expert), wrong answer shows `+0 XP`
