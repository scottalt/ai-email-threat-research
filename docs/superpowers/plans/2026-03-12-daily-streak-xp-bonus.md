# Daily Streak XP Bonus Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily streak system that awards escalating XP bonuses (5-35 XP) for consecutive days of play, with three new streak achievements.

**Architecture:** New `player_streaks` table tracks per-player streak state. Streak logic runs inside the existing `/api/player/xp` PATCH handler after the rate limit check and before the XP write. Three new achievements in the `daily` category are checked via the existing achievement system.

**Tech Stack:** Next.js API routes, Supabase PostgreSQL, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-12-daily-streak-xp-bonus-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/add-player-streaks.sql` | New table DDL + RLS policies |
| Modify | `lib/xp.ts` | Add `getStreakBonusXp()` function |
| Modify | `lib/types.ts:106-119` | Add `currentStreak`, `longestStreak` to `PlayerProfile` |
| Modify | `lib/achievements.ts:4,59-66` | Add `'daily'` category + 3 new achievements |
| Modify | `lib/achievement-checker.ts:24-29,74-80,110` | Widen `Extra` type, add `currentStreak` param, add streak checks |
| Modify | `app/api/player/xp/route.ts:96-207` | Streak fetch/compute/write + pass to achievements + return in response |
| Modify | `app/api/player/route.ts:27-42,50-53,67-72` | LEFT JOIN `player_streaks`, extend `toProfile` |
| Modify | `components/RoundSummary.tsx:53-55,71-86,99-116` | Display streak bonus and streak day |
| Modify | `app/profile/page.tsx:167-176` | Show current/longest streak in profile |

---

## Chunk 1: Database + Pure Functions

### Task 1: Create the `player_streaks` migration

**Files:**
- Create: `supabase/migrations/add-player-streaks.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Daily streak tracking table
-- One row per player, tracks consecutive days of play
CREATE TABLE IF NOT EXISTS player_streaks (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  streak_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own streak"
  ON player_streaks FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE auth_id = auth.uid()));

CREATE POLICY "Service role can insert streaks"
  ON player_streaks FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update streaks"
  ON player_streaks FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 2: Run the migration against Supabase**

Run the SQL in the Supabase dashboard SQL editor or via CLI:
```bash
npx supabase db push
```
Expected: table `player_streaks` created with RLS policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/add-player-streaks.sql
git commit -m "feat: add player_streaks table migration"
```

---

### Task 2: Add `getStreakBonusXp` to `lib/xp.ts`

**Files:**
- Modify: `lib/xp.ts` (append after line 46)

- [ ] **Step 1: Add the streak bonus function**

Append to `lib/xp.ts`:

```typescript
/** Daily streak XP bonus: 5 XP per streak day, capped at 35 (day 7+) */
export function getStreakBonusXp(currentStreak: number): number {
  return Math.min(currentStreak * 5, 35);
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npx next build --no-lint 2>&1 | head -20
```
Expected: no errors related to `xp.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/xp.ts
git commit -m "feat: add getStreakBonusXp function"
```

---

### Task 3: Extend `PlayerProfile` type

**Files:**
- Modify: `lib/types.ts:106-119`

- [ ] **Step 1: Add streak fields to `PlayerProfile`**

Add two new fields before the closing `}` of the `PlayerProfile` interface (after line 118, before line 119):

```typescript
  currentStreak: number;
  longestStreak: number;
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add streak fields to PlayerProfile type"
```

---

### Task 4: Add `daily` achievement category and 3 streak achievements

**Files:**
- Modify: `lib/achievements.ts:4,16-48,59-66`

- [ ] **Step 1: Add `'daily'` to the `AchievementCategory` union type**

Change line 4 from:
```typescript
export type AchievementCategory = 'progression' | 'skill' | 'streak' | 'speed' | 'investigation' | 'xp';
```
to:
```typescript
export type AchievementCategory = 'progression' | 'skill' | 'streak' | 'speed' | 'investigation' | 'xp' | 'daily';
```

- [ ] **Step 2: Add 3 new achievements to the `ACHIEVEMENTS` array**

After the XP achievements block (after `pb_2500` on line 47, before the closing `];` on line 48), add:

```typescript
  // Daily streak (names follow codebase ALL_CAPS convention; spec names were placeholders)
  { id: 'streak_3d',  name: 'CONSISTENT',      description: 'Play 3 days in a row',   category: 'daily', rarity: 'common',   icon: '▶' },
  { id: 'streak_7d',  name: 'DEDICATED',        description: 'Play 7 days in a row',   category: 'daily', rarity: 'uncommon', icon: '▶' },
  { id: 'streak_30d', name: 'RELENTLESS',       description: 'Play 30 days in a row',  category: 'daily', rarity: 'rare',     icon: '▶' },
```

Note: The spec used generic names ("3-Day Streak", etc.) but all existing achievements use thematic ALL_CAPS names (FIRST_BLOOD, HOT_STREAK, ZERO_MISS). These names follow that convention.

- [ ] **Step 3: Add `daily` to `CATEGORY_LABELS`**

Change line 59-66 to add the new entry after `xp`:

```typescript
export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  progression:   'PROGRESSION',
  skill:         'SKILL',
  streak:        'STREAK',
  speed:         'SPEED',
  investigation: 'INVESTIGATION',
  xp:            'XP / RANK',
  daily:         'DAILY',
};
```

- [ ] **Step 4: Commit**

```bash
git add lib/achievements.ts
git commit -m "feat: add daily streak achievements and category"
```

---

### Task 5: Wire streak data into achievement checker

**Files:**
- Modify: `lib/achievement-checker.ts:24-29,31-68,74-80,110`

- [ ] **Step 1: Widen the `Extra` type to include `currentStreak`**

Change lines 28-29 from:
```typescript
  extra: { dailySessionCount: number },
) => boolean;
```
to:
```typescript
  extra: { dailySessionCount: number; currentStreak?: number },
) => boolean;
```

- [ ] **Step 2: Add streak checks to the `CHECKS` map**

After the `daily_3` check (line 47), add:

```typescript
  // Daily streak
  streak_3d:       (_p, _a, _gm, extra) => (extra.currentStreak ?? 0) >= 3,
  streak_7d:       (_p, _a, _gm, extra) => (extra.currentStreak ?? 0) >= 7,
  streak_30d:      (_p, _a, _gm, extra) => (extra.currentStreak ?? 0) >= 30,
```

- [ ] **Step 3: Add `currentStreak` parameter to `checkAchievements`**

Change the function signature (lines 74-80) from:
```typescript
export async function checkAchievements(
  admin: SupabaseClient,
  player: PlayerStats,
  sessionId: string,
  sessionAnswers: AnswerRow[],
  gameMode: string,
): Promise<string[]> {
```
to:
```typescript
export async function checkAchievements(
  admin: SupabaseClient,
  player: PlayerStats,
  sessionId: string,
  sessionAnswers: AnswerRow[],
  gameMode: string,
  currentStreak: number = 0,
): Promise<string[]> {
```

- [ ] **Step 4: Thread `currentStreak` into the `extra` bag**

Change line 110 from:
```typescript
    if (check(player, sessionAnswers, gameMode, { dailySessionCount })) {
```
to:
```typescript
    if (check(player, sessionAnswers, gameMode, { dailySessionCount, currentStreak })) {
```

- [ ] **Step 5: Verify build compiles**

```bash
npx next build --no-lint 2>&1 | head -20
```
Expected: no type errors. The `backfillPlayerAchievements` function still compiles because `currentStreak` has a default value and the `Extra` type makes it optional.

- [ ] **Step 6: Commit**

```bash
git add lib/achievement-checker.ts
git commit -m "feat: wire streak data into achievement checker"
```

---

## Chunk 2: API Integration

### Task 6: Add streak logic to the XP award endpoint

**Files:**
- Modify: `app/api/player/xp/route.ts`

This is the core integration. The streak logic runs after the rate limit check, computes the streak state in memory, adds the bonus to XP, writes XP with the optimistic lock, and only then commits the streak update.

**Note:** Line numbers in this task reference the file *before* any insertions. After Step 2 inserts ~50 lines, subsequent line references will be shifted. Search for the code patterns rather than relying on exact line numbers.

**Design note:** The spec defines activity as "submit at least one answer," but streak advancement is triggered at session completion (XP award). Players who abandon mid-round won't trigger a streak update. This is intentional — the XP endpoint is the only authenticated, rate-limited, deduplication-safe hook. Tracking partial sessions would require a separate mechanism with its own dedup logic.

- [ ] **Step 1: Add the `getStreakBonusXp` import**

Change line 5 from:
```typescript
import { getLevelFromXp, getXpForRound, RESEARCH_GRADUATION_ANSWERS } from '@/lib/xp';
```
to:
```typescript
import { getLevelFromXp, getXpForRound, getStreakBonusXp, RESEARCH_GRADUATION_ANSWERS } from '@/lib/xp';
```

- [ ] **Step 2: Add streak computation after XP calculation**

After line 111 (`}` closing the sessionId answers block), before line 113 (`const newXp = ...`), insert the streak computation block:

```typescript
  // --- Daily streak computation ---
  // Compute today/yesterday once to avoid UTC midnight boundary issues
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  let streakDay = 0;
  let streakBonusXp = 0;
  const playerId = p.id as string;

  // Upsert streak row (ON CONFLICT DO NOTHING handles race conditions)
  await admin.from('player_streaks').upsert(
    { player_id: playerId },
    { onConflict: 'player_id', ignoreDuplicates: true }
  );

  const { data: streakRow } = await admin
    .from('player_streaks')
    .select('current_streak, longest_streak, last_active_date')
    .eq('player_id', playerId)
    .maybeSingle();

  let newCurrentStreak = 1;
  let newLongestStreak = streakRow?.longest_streak ?? 0;
  let streakAdvanced = false;

  if (streakRow) {
    const lastActive = streakRow.last_active_date; // DATE comes as YYYY-MM-DD string

    if (lastActive === today) {
      // Same day — no advancement, return current values
      newCurrentStreak = streakRow.current_streak;
      newLongestStreak = streakRow.longest_streak;
      streakDay = newCurrentStreak;
      streakBonusXp = 0;
    } else {
      if (lastActive === yesterday) {
        newCurrentStreak = streakRow.current_streak + 1;
      } else {
        newCurrentStreak = 1;
      }
      newLongestStreak = Math.max(newLongestStreak, newCurrentStreak);
      streakDay = newCurrentStreak;
      streakBonusXp = getStreakBonusXp(newCurrentStreak);
      streakAdvanced = true;
    }
  } else {
    // No row existed (shouldn't happen after upsert, but defensive)
    streakDay = 1;
    streakBonusXp = getStreakBonusXp(1);
    streakAdvanced = true;
  }
  // --- End streak computation ---
```

- [ ] **Step 3: Add streak bonus to XP calculation**

Find the line (originally line 113, shifted down ~50 lines after Step 2's insertion):
```typescript
  const newXp = (p.xp as number) + xpEarned;
```
to:
```typescript
  const newXp = (p.xp as number) + xpEarned + streakBonusXp;
```

- [ ] **Step 4: Commit streak update after successful XP write**

After the rate limit counter increment block (after line 180), before the achievement check (line 182), insert:

```typescript
  // Commit streak update only after successful XP write
  if (streakAdvanced) {
    await admin.from('player_streaks').update({
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_active_date: today,
      streak_updated_at: new Date().toISOString(),
    }).eq('player_id', playerId);
  }
```

- [ ] **Step 5: Pass `currentStreak` to `checkAchievements`**

Change line 186-193 from:
```typescript
      newAchievements = await checkAchievements(admin, {
        id: p.id as string,
        xp: newXp,
        level: newLevel,
        totalSessions: newTotalSessions,
        researchGraduated: nowGraduated,
        personalBestScore: newBest,
      }, sessionId, sessionAnswers, verifiedGameMode);
```
to:
```typescript
      newAchievements = await checkAchievements(admin, {
        id: p.id as string,
        xp: newXp,
        level: newLevel,
        totalSessions: newTotalSessions,
        researchGraduated: nowGraduated,
        personalBestScore: newBest,
      }, sessionId, sessionAnswers, verifiedGameMode, newCurrentStreak);
```

- [ ] **Step 6: Add streak fields to the response**

Change line 199-207 from:
```typescript
  return NextResponse.json({
    xp: newXp,
    level: newLevel,
    xpEarned,
    levelUp,
    graduated: !wasGraduated && nowGraduated,
    researchSessionsCompleted: newResearchSessions,
    newAchievements,
  });
```
to:
```typescript
  return NextResponse.json({
    xp: newXp,
    level: newLevel,
    xpEarned,
    levelUp,
    graduated: !wasGraduated && nowGraduated,
    researchSessionsCompleted: newResearchSessions,
    newAchievements,
    streakDay,
    streakBonusXp,
  });
```

Note: `xpEarned` stays as base XP only (excludes streak bonus). The streak bonus is returned separately in `streakBonusXp` so the frontend can display them as distinct line items without double-counting. The total XP written to the DB (`newXp`) includes both.

- [ ] **Step 7: Verify build compiles**

```bash
npx next build --no-lint 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/api/player/xp/route.ts
git commit -m "feat: integrate daily streak logic into XP award endpoint"
```

---

### Task 7: Add streak data to player profile endpoint

**Files:**
- Modify: `app/api/player/route.ts:27-42,50-53,67-72`

- [ ] **Step 1: Update `toProfile` to accept and map streak data**

Change the `toProfile` function (lines 27-42) from:
```typescript
function toProfile(row: Record<string, unknown>, researchAnswersSubmitted = 0, achievements: string[] = []): PlayerProfile {
  return {
    id: row.id as string,
    authId: row.auth_id as string,
    displayName: row.display_name as string | null,
    xp: row.xp as number,
    level: row.level as number,
    totalSessions: row.total_sessions as number,
    researchSessionsCompleted: row.research_sessions_completed as number,
    researchAnswersSubmitted,
    researchGraduated: row.research_graduated as boolean,
    personalBestScore: row.personal_best_score as number,
    background: (row.background as PlayerBackground | null) ?? null,
    achievements,
  };
}
```
to:
```typescript
function toProfile(row: Record<string, unknown>, researchAnswersSubmitted = 0, achievements: string[] = [], streakData?: { current_streak: number; longest_streak: number } | null): PlayerProfile {
  return {
    id: row.id as string,
    authId: row.auth_id as string,
    displayName: row.display_name as string | null,
    xp: row.xp as number,
    level: row.level as number,
    totalSessions: row.total_sessions as number,
    researchSessionsCompleted: row.research_sessions_completed as number,
    researchAnswersSubmitted,
    researchGraduated: row.research_graduated as boolean,
    personalBestScore: row.personal_best_score as number,
    background: (row.background as PlayerBackground | null) ?? null,
    achievements,
    currentStreak: streakData?.current_streak ?? 0,
    longestStreak: streakData?.longest_streak ?? 0,
  };
}
```

- [ ] **Step 2: Fetch streak data in the GET handler**

Change lines 67-72 (the parallel fetch block) from:
```typescript
  const [{ count: researchAnswersSubmitted }, { data: achievementRows }] = await Promise.all([
    admin.from('answers').select('*', { count: 'exact', head: true })
      .eq('player_id', row.id as string).eq('game_mode', 'research'),
    admin.from('player_achievements').select('achievement_id')
      .eq('player_id', row.id as string),
  ]);
```
to:
```typescript
  const [{ count: researchAnswersSubmitted }, { data: achievementRows }, { data: streakData }] = await Promise.all([
    admin.from('answers').select('*', { count: 'exact', head: true })
      .eq('player_id', row.id as string).eq('game_mode', 'research'),
    admin.from('player_achievements').select('achievement_id')
      .eq('player_id', row.id as string),
    admin.from('player_streaks').select('current_streak, longest_streak')
      .eq('player_id', row.id as string).maybeSingle(),
  ]);
```

- [ ] **Step 3: Pass streak data to `toProfile`**

Change line 76 from:
```typescript
  return NextResponse.json(toProfile(row, researchAnswersSubmitted ?? 0, achievements), {
```
to:
```typescript
  return NextResponse.json(toProfile(row, researchAnswersSubmitted ?? 0, achievements, streakData), {
```

- [ ] **Step 4: Fix the POST handler to include streak data**

The POST handler at line 123 also calls `toProfile`. After the plan's changes, it needs streak data too, otherwise profile updates will return `currentStreak: 0`.

Change line 123 from:
```typescript
  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json(toProfile(data as unknown as Record<string, unknown>));
```
to:
```typescript
  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  const updatedRow = data as unknown as Record<string, unknown>;
  const { data: postStreakData } = await admin.from('player_streaks').select('current_streak, longest_streak')
    .eq('player_id', updatedRow.id as string).maybeSingle();
  return NextResponse.json(toProfile(updatedRow, 0, [], postStreakData));
```

Note: The POST response doesn't return `researchAnswersSubmitted` or `achievements` (passed as defaults). This matches the existing behavior — the POST handler was already a lightweight response. The frontend calls `applyProfile` with the result, so streak data will be correct.

- [ ] **Step 5: Verify build compiles**

```bash
npx next build --no-lint 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/player/route.ts
git commit -m "feat: include streak data in player profile response"
```

---

## Chunk 3: Frontend

### Task 8: Show streak bonus in RoundSummary

**Files:**
- Modify: `components/RoundSummary.tsx:53-55,71-86,99-116`

- [ ] **Step 1: Extend the `xpResult` type**

Change lines 53-55 from:
```typescript
  const [xpResult, setXpResult] = useState<{
    xpEarned: number; level: number; levelUp: boolean; graduated: boolean; newAchievements?: string[];
  } | null>(null);
```
to:
```typescript
  const [xpResult, setXpResult] = useState<{
    xpEarned: number; level: number; levelUp: boolean; graduated: boolean; newAchievements?: string[];
    streakDay?: number; streakBonusXp?: number;
  } | null>(null);
```

- [ ] **Step 2: Add streak display in the XP award section**

After the `LevelMeter` component (line 114), before the closing `</div>` (line 115), add the streak display:

```tsx
          {/* Daily streak */}
          {(xpResult.streakDay ?? 0) > 0 && (
            <div className="flex justify-between text-sm font-mono">
              <span className="text-[#00aa28]">
                {(xpResult.streakBonusXp ?? 0) > 0 ? 'STREAK BONUS' : 'STREAK'}
              </span>
              <span className="text-[#00ff41]">
                {(xpResult.streakBonusXp ?? 0) > 0
                  ? `+${xpResult.streakBonusXp} XP · Day ${xpResult.streakDay}`
                  : `Day ${xpResult.streakDay} (bonus already earned today)`}
              </span>
            </div>
          )}
```

- [ ] **Step 3: Verify with dev server**

```bash
npm run dev
```
Visit `http://localhost:3000`, complete a round while signed in. Verify:
- The streak bonus line appears after XP earned
- First play of the day shows `+5 XP · Day 1`
- Second play same day shows `Day 1 (earned today)`

- [ ] **Step 4: Commit**

```bash
git add components/RoundSummary.tsx
git commit -m "feat: display daily streak bonus in round summary"
```

---

### Task 9: Show streak in profile page

**Files:**
- Modify: `app/profile/page.tsx:167-176`

- [ ] **Step 1: Add streak rows to the profile stats**

Change lines 169-176 (the `bottomRows` array) from:
```typescript
  const bottomRows: { label: string; value: string | number }[] = [
    { label: 'LEVEL',             value: profile.level },
    { label: 'TOTAL XP',          value: `${profile.xp.toLocaleString()} XP` },
    { label: 'SESSIONS',          value: profile.totalSessions },
    { label: 'RESEARCH SESSIONS', value: profile.researchSessionsCompleted },
    { label: 'GRADUATION',        value: profile.researchGraduated ? 'GRADUATED — EXPERT UNLOCKED' : `${profile.researchSessionsCompleted}/3 sessions` },
    { label: 'PERSONAL BEST',     value: `${profile.personalBestScore.toLocaleString()} pts` },
  ];
```
to:
```typescript
  const bottomRows: { label: string; value: string | number }[] = [
    { label: 'LEVEL',             value: profile.level },
    { label: 'TOTAL XP',          value: `${profile.xp.toLocaleString()} XP` },
    { label: 'CURRENT STREAK',    value: profile.currentStreak > 0 ? `${profile.currentStreak} days` : '—' },
    { label: 'LONGEST STREAK',    value: profile.longestStreak > 0 ? `${profile.longestStreak} days` : '—' },
    { label: 'SESSIONS',          value: profile.totalSessions },
    { label: 'RESEARCH SESSIONS', value: profile.researchSessionsCompleted },
    { label: 'GRADUATION',        value: profile.researchGraduated ? 'GRADUATED — EXPERT UNLOCKED' : `${profile.researchSessionsCompleted}/3 sessions` },
    { label: 'PERSONAL BEST',     value: `${profile.personalBestScore.toLocaleString()} pts` },
  ];
```

- [ ] **Step 2: Verify with dev server**

Visit `http://localhost:3000/profile`. Verify:
- CURRENT STREAK and LONGEST STREAK rows appear
- Shows `—` for players with no streak data yet
- Shows `X days` format for players with streaks

- [ ] **Step 3: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: display streak stats in player profile"
```

---

## Chunk 4: Verification

### Task 10: End-to-end manual verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```
Expected: clean build, no errors.

- [ ] **Step 2: Test the full flow**

1. Start dev server: `npm run dev`
2. Sign in with a test account
3. Play a round and complete it
4. Verify RoundSummary shows: `+5 XP · Day 1` streak bonus
5. Visit `/profile` — verify CURRENT STREAK shows `1 days`
6. Play another round same day — verify streak shows `Day 1 (bonus already earned today)` with no bonus
7. Visit `/profile` — verify CURRENT STREAK still shows `1 days`
8. Check the achievements section on `/profile` — verify DAILY category appears with CONSISTENT, DEDICATED, RELENTLESS badges (all locked)

- [ ] **Step 3: Final commit with any fixes**

If any fixes were needed during verification, commit them:
```bash
git add -A
git commit -m "fix: address issues found during streak feature verification"
```
