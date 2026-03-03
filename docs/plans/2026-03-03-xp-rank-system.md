# XP-Based Rank System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace per-session score-based ranks with XP level-based ranks — every 6 levels is a rank promotion, shown on both leaderboards and the round summary.

**Architecture:** `lib/rank.ts` gets a new `getRankFromLevel(level)` function (replacing `getRank(score)`). The leaderboard Redis API stores `level` in the member string. All render sites switch from `getRank(entry.score)` to `getRankFromLevel(entry.level ?? 1)`. The round summary rank badge uses `profile.level` for signed-in users and is hidden for guests.

**Tech Stack:** Next.js App Router, TypeScript, Upstash Redis, React

---

### Task 1: Replace rank function in lib/rank.ts

**Files:**
- Modify: `lib/rank.ts`

**Context:**

Current file (`lib/rank.ts`):
```ts
export interface Rank {
  label: string;
  color: string;
  glowClass: string;
}

const MAX_SCORE = 3000;

export function getRank(score: number): Rank {
  const efficiency = score / MAX_SCORE;
  if (efficiency >= 0.9) return { label: 'ELITE',      color: '#ffaa00', glowClass: 'glow-amber' };
  if (efficiency >= 0.75) return { label: 'SPECIALIST', color: '#ffaa00', glowClass: '' };
  if (efficiency >= 0.6)  return { label: 'ANALYST',    color: '#00ff41', glowClass: 'glow' };
  if (efficiency >= 0.4)  return { label: 'OPERATOR',   color: '#00ff41', glowClass: '' };
  return                         { label: 'NOVICE',     color: '#00aa28', glowClass: '' };
}
```

**Step 1: Replace entire file contents**

Replace the entire file with:

```ts
export interface Rank {
  label: string;
  color: string;
  glowClass: string;
}

// 30 levels / 5 ranks = 6 levels per rank
export function getRankFromLevel(level: number): Rank {
  if (level >= 25) return { label: 'ELITE',      color: '#ffaa00', glowClass: 'glow-amber' };
  if (level >= 19) return { label: 'SPECIALIST', color: '#ffaa00', glowClass: '' };
  if (level >= 13) return { label: 'ANALYST',    color: '#00ff41', glowClass: 'glow' };
  if (level >= 7)  return { label: 'OPERATOR',   color: '#00ff41', glowClass: '' };
  return                  { label: 'NOVICE',     color: '#00aa28', glowClass: '' };
}
```

**Step 2: Build check**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npm run build 2>&1 | tail -30
```

Expected: TypeScript errors for all call sites still using `getRank` — that's expected and will be fixed in subsequent tasks. If there are no call-site errors, something is wrong.

**Step 3: Commit**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add lib/rank.ts && git commit -m "feat: replace getRank(score) with getRankFromLevel(level)"
```

---

### Task 2: Update leaderboard API to store and return level

**Files:**
- Modify: `app/api/leaderboard/route.ts`

**Context:**

The current Redis member format is `${name}:${timestamp}` (e.g. `OPERATOR42:1709500000000`).
The GET handler parses name with `member.split(':')[0]`.
The POST handler builds the member with `const member = \`${trimmed}:${Date.now()}\``.

The current GET return type is `{ name: string; score: number }[]`.
The current POST accepts `{ name, score, date }`.

There are no existing entries in Redis, so no migration is needed.

**Step 1: Update POST to accept and encode level**

Find the POST handler's `const member = ...` line:
```ts
const member = `${trimmed}:${Date.now()}`;
```

Replace with (after destructuring `level` from the request body):

```ts
const { name, score, date, level } = await req.json();
```

And:
```ts
const safeLevel = typeof level === 'number' && level >= 1 && level <= 30 ? level : 1;
const member = `${trimmed}:${safeLevel}:${Date.now()}`;
```

Note: the `const { name, score, date } = await req.json();` line near the top of the POST handler must also be updated to include `level`.

**Step 2: Update GET to parse and return level**

Find the GET handler's entries loop:
```ts
const entries: { name: string; score: number }[] = [];
for (let i = 0; i < results.length; i += 2) {
  const member = results[i] as string;
  const score = results[i + 1] as number;
  entries.push({ name: member.split(':')[0], score });
}
```

Replace with:
```ts
const entries: { name: string; score: number; level: number }[] = [];
for (let i = 0; i < results.length; i += 2) {
  const member = results[i] as string;
  const score = results[i + 1] as number;
  const parts = member.split(':');
  const name = parts[0];
  const level = parts.length >= 3 ? parseInt(parts[1], 10) || 1 : 1;
  entries.push({ name, score, level });
}
```

The `parts.length >= 3` guard handles the old two-part format gracefully (falls back to level 1).

**Step 3: Build check**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npm run build 2>&1 | tail -30
```

**Step 4: Commit**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add app/api/leaderboard/route.ts && git commit -m "feat: store and return player level in leaderboard API"
```

---

### Task 3: Update StartScreen.tsx

**Files:**
- Modify: `components/StartScreen.tsx`

**Context:**

Current import at line 5: `import { getRank } from '@/lib/rank';`

`LeaderboardEntry` interface (lines 11–14):
```ts
interface LeaderboardEntry {
  name: string;
  score: number;
}
```

Score leaderboard row (around line 349):
```tsx
{(() => { const r = getRank(entry.score); return (
  <span className={...} style={{ color: r.color }}>
    {r.label}
  </span>
); })()}
```

Daily leaderboard row (around line 288):
```tsx
{(() => { const r = getRank(entry.score); return (
  ...
); })()}
```

XP leaderboard row (lines 360–366): currently shows `LVL {row.level}` as plain text with no rank badge.

**Step 1: Update import**

Change:
```ts
import { getRank } from '@/lib/rank';
```
To:
```ts
import { getRankFromLevel } from '@/lib/rank';
```

**Step 2: Add level to LeaderboardEntry**

Change:
```ts
interface LeaderboardEntry {
  name: string;
  score: number;
}
```
To:
```ts
interface LeaderboardEntry {
  name: string;
  score: number;
  level?: number;
}
```

**Step 3: Update score leaderboard row rank badge**

Find all occurrences of `getRank(entry.score)` in this file and replace with `getRankFromLevel(entry.level ?? 1)`.

There are two occurrences — one in the daily leaderboard section (~line 288) and one in the tabbed score leaderboard section (~line 349).

**Step 4: Update XP leaderboard row to show rank badge**

Find the XP leaderboard row (the one rendering `row.display_name`, `row.research_graduated`, `row.level`, `row.xp`):

```tsx
<div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono">
  <span className="text-[#003a0e] w-4">{i + 1}.</span>
  <span className="text-[#00aa28] flex-1 truncate">{row.display_name ?? 'ANON'}</span>
  {row.research_graduated && <span className="text-[#ffaa00] text-[10px]">★</span>}
  <span className="text-[#003a0e] text-[10px]">LVL {row.level}</span>
  <span className="text-[#00ff41]">{row.xp.toLocaleString()} XP</span>
</div>
```

Replace with:
```tsx
<div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono">
  <span className="text-[#003a0e] w-4">{i + 1}.</span>
  <span className="text-[#00aa28] flex-1 truncate">{row.display_name ?? 'ANON'}</span>
  {row.research_graduated && <span className="text-[#ffaa00] text-[10px]">★</span>}
  {(() => { const r = getRankFromLevel(row.level); return (
    <span className={`text-[9px] font-mono shrink-0 ${r.glowClass}`} style={{ color: r.color }}>
      {r.label}
    </span>
  ); })()}
  <span className="text-[#00ff41]">{row.xp.toLocaleString()} XP</span>
</div>
```

**Step 5: Build check**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npm run build 2>&1 | tail -30
```

**Step 6: Commit**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add components/StartScreen.tsx && git commit -m "feat: show XP-based rank badges on score and XP leaderboards in StartScreen"
```

---

### Task 4: Update RoundSummary.tsx

**Files:**
- Modify: `components/RoundSummary.tsx`

**Context:**

Current import at line 5: `import { getRank } from '@/lib/rank';`

Current rank usage on score header (line 35): `const rank = getRank(totalScore);`

Leaderboard state types (lines 38–39):
```ts
const [globalLeaderboard, setGlobalLeaderboard] = useState<{ name: string; score: number }[]>([]);
const [dailyLeaderboard, setDailyLeaderboard] = useState<{ name: string; score: number }[]>([]);
```

Leaderboard row rank badge (around line 325):
```tsx
{(() => { const r = getRank(entry.score); return (
  <span className={`text-[9px] font-mono shrink-0 ${r.glowClass}`} style={{ color: r.color }}>
    {r.label}
  </span>
); })()}
```

Auto-submit POST body (in the leaderboard useEffect):
```ts
body: JSON.stringify({
  name: profile.displayName,
  score: totalScore,
  ...(mode === 'daily' ? { date } : {}),
}),
```

**Step 1: Update import**

Change:
```ts
import { getRank } from '@/lib/rank';
```
To:
```ts
import { getRankFromLevel } from '@/lib/rank';
```

**Step 2: Update leaderboard state types**

Change:
```ts
const [globalLeaderboard, setGlobalLeaderboard] = useState<{ name: string; score: number }[]>([]);
const [dailyLeaderboard, setDailyLeaderboard] = useState<{ name: string; score: number }[]>([]);
```
To:
```ts
const [globalLeaderboard, setGlobalLeaderboard] = useState<{ name: string; score: number; level?: number }[]>([]);
const [dailyLeaderboard, setDailyLeaderboard] = useState<{ name: string; score: number; level?: number }[]>([]);
```

**Step 3: Update score header rank badge**

The score header currently has:
```ts
const rank = getRank(totalScore);
```
And renders `rank.label`, `rank.color`, `rank.glowClass` in the score header section.

Replace with:
```ts
const rank = profile ? getRankFromLevel(profile.level) : null;
```

Then find where `rank` is rendered in the score header JSX. It renders something like:
```tsx
<div
  className={`text-xs font-mono font-bold tracking-widest mt-1 ${rank.glowClass}`}
  style={{ color: rank.color }}
>
  [ {rank.label} ]
</div>
```

Wrap it in a conditional so guests don't see it:
```tsx
{rank && (
  <div
    className={`text-xs font-mono font-bold tracking-widest mt-1 ${rank.glowClass}`}
    style={{ color: rank.color }}
  >
    [ {rank.label} ]
  </div>
)}
```

**Step 4: Add level to leaderboard POST body**

Find the `body: JSON.stringify({...})` in the leaderboard auto-submit useEffect. Add `level`:

```ts
body: JSON.stringify({
  name: profile.displayName,
  score: totalScore,
  level: profile.level,
  ...(mode === 'daily' ? { date } : {}),
}),
```

**Step 5: Update leaderboard row rank badge**

Find the leaderboard row that calls `getRank(entry.score)` and replace with `getRankFromLevel(entry.level ?? 1)`.

**Step 6: Build check**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npm run build 2>&1 | tail -30
```

Expected: clean build, no TypeScript errors.

**Step 7: Commit and push**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add components/RoundSummary.tsx && git commit -m "feat: use XP-based rank badge in round summary and leaderboard submission"
git push
```

---

### Task 5: Manual verification

1. **Rank tiers**: Sign in as a level 1 player — rank badge should show `NOVICE`
2. **Score leaderboard**: Play a round, check the leaderboard rows show the rank badge (not score-based)
3. **XP leaderboard**: Check the XP leaderboard tab — each row should now show a rank badge
4. **Guest**: Play a round without signing in — score header should have NO rank badge
5. **Signed in**: Play a round signed in — score header shows rank badge from `profile.level`
6. **Redis level storage**: Check Vercel logs or Redis to confirm the member format is `name:level:timestamp`
