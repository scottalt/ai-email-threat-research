# Daily Streak XP Bonus — Design Spec

## Overview

A daily streak system that rewards players with escalating XP bonuses for playing on consecutive days. Streaks reset on a missed day. Ties into the existing achievements system with three new streak badges.

## Qualifying Activity

A player is considered "active" for a given UTC day if they submit at least one answer (any game mode, any correctness). This is the lowest-friction threshold to maximize retention.

## Database Schema

### New table: `player_streaks`

```sql
CREATE TABLE IF NOT EXISTS player_streaks (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  streak_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No separate index needed — player_id is PRIMARY KEY (implicit unique index)

ALTER TABLE player_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own streak"
  ON player_streaks FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE auth_id = auth.uid()));

-- Note: The service role bypasses RLS entirely in Supabase.
-- These write policies are scoped to service_role for defense-in-depth.
CREATE POLICY "Service role can insert streaks"
  ON player_streaks FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update streaks"
  ON player_streaks FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- One row per player, created lazily on first XP award via `INSERT ... ON CONFLICT (player_id) DO NOTHING` (upsert) to handle concurrent first-session race conditions
- `last_active_date` is `DATE` (not timestamp) for clean day comparison

## Streak Logic

Runs inside `/api/player/xp` PATCH handler. The streak update is performed **after** a successful XP write. If the XP write fails the optimistic concurrency check (409), the streak update is skipped entirely. If the process crashes between a successful XP write and the streak update, the streak may lag by one day — this is self-correcting on the next play (the missed update simply means the player doesn't get the streak bonus for that one round, and the next day's play will still see "yesterday" correctly).

### Algorithm

All streak state below is computed in memory. The `streakDay` value in the API response reflects the computed value, not the DB value — so it is always >= 1 for authenticated players.

```
1. today = current UTC date
2. Fetch or create player_streaks row (upsert with ON CONFLICT DO NOTHING)
3. Compare last_active_date to today:
   - Same day       → no-op, streak_bonus = 0 (streak already advanced today)
                       streakDay = current_streak (return current value for display)
   - Yesterday      → current_streak += 1
                       longest_streak = max(longest_streak, current_streak)
                       last_active_date = today
   - Null or other  → current_streak = 1
                       longest_streak = max(longest_streak, 1)
                       last_active_date = today
4. streak_bonus = min(current_streak * 5, 35)
5. Add streak_bonus to total XP awarded
6. Write XP (including streak bonus) to DB with optimistic lock
7. If XP write succeeds, update player_streaks row
8. If XP write fails (409), discard all in-memory streak state — no retry needed
```

**Crash between steps 6 and 7:** The player receives the streak bonus XP but the streak row is stale. On the next day's play, the streak will still advance correctly (yesterday check passes). The bounded risk is a duplicate bonus of at most 35 XP if the same scenario repeats — an acceptable trade-off.

### Ordering with rate limiting

Streak logic runs after the rate limit check. If the request is rate-limited (429), the streak is not updated. This prevents edge cases where a rate-limited first-of-day play could miss the streak window.

### Edge Cases

- **Multiple rounds in one day:** Only the first round triggers streak advancement. Subsequent rounds get `streakBonusXp = 0` but still receive `streakDay` reflecting the current streak length for display.
- **Guest players:** No streak tracking. Streaks require authentication. API returns `streakDay: 0, streakBonusXp: 0`.
- **New player, first ever round:** Row created with `current_streak = 1`, bonus = 5 XP. A "streak of 1" means "you played today" — the escalation rewards consistency starting from Day 2.
- **Timezone:** All comparisons use UTC dates. No player-local timezone support.
- **Concurrent requests (same session):** The streak update piggybacks on the existing `last_xp_session_id` optimistic lock — only one request per session succeeds.
- **Concurrent requests (different sessions, new player):** The `INSERT ... ON CONFLICT DO NOTHING` upsert prevents primary key violations. The first request to win the XP optimistic lock will advance the streak.
- **Crash between XP write and streak update:** Streak may lag by one day. Self-correcting on next play — acceptable trade-off vs. the complexity of a Postgres RPC for atomicity.

## XP Bonus Schedule

| Streak Day | Bonus XP |
|------------|----------|
| 1          | 5        |
| 2          | 10       |
| 3          | 15       |
| 4          | 20       |
| 5          | 25       |
| 6          | 30       |
| 7+         | 35       |

Formula: `min(current_streak * 5, 35)`

Cap at Day 7. Maximum daily bonus is 35 XP. For context, a normal round earns ~100-150 XP, so the streak bonus is a meaningful perk (~25%) without overshadowing gameplay.

## XP Integration

### `lib/xp.ts`

New export:

```typescript
export function getStreakBonusXp(currentStreak: number): number {
  return Math.min(currentStreak * 5, 35)
}
```

### `/api/player/xp/route.ts`

After computing base XP (`getXpForRound`):
1. Check rate limit — if 429, return early (no streak update)
2. Fetch streak row (upsert if missing)
3. Compute streak advancement (same-day / yesterday / reset)
4. Call `getStreakBonusXp(currentStreak)` to get bonus
5. Add bonus to total XP
6. Write XP to DB with optimistic lock
7. If XP write succeeds, commit streak update to `player_streaks`
8. Pass `currentStreak` to `checkAchievements` via the `extra` bag
9. Return `streakDay` and `streakBonusXp` in response

Response shape addition:

```typescript
{
  // ...existing fields (xpEarned, level, levelUp, graduated, newAchievements)
  streakDay: number,      // current streak length after this session (0 for guests)
  streakBonusXp: number   // XP bonus awarded for streak (0 if same-day repeat or guest)
}
```

The existing `xpResult` state type in `RoundSummary.tsx` must be extended to include `streakDay` and `streakBonusXp`. These fields default to `0` if absent (backward compatibility during rollout).

### Fetching streak data outside XP flow

The `/api/player` GET endpoint (used by profile/stats) will LEFT JOIN `player_streaks` when fetching the player profile. This uses the existing RLS SELECT policy. No new API route needed.

The `PlayerProfile` type in `lib/types.ts` is extended with:

```typescript
currentStreak: number   // from player_streaks.current_streak, default 0
longestStreak: number   // from player_streaks.longest_streak, default 0
```

The `toProfile` mapper (or equivalent) maps NULL join results to `0`.

### Frontend type handling

The `xpResult` state type in `RoundSummary.tsx` adds optional fields:

```typescript
streakDay?: number
streakBonusXp?: number
```

Usage sites use `?? 0` (e.g., `xpResult.streakDay ?? 0`) for backward compatibility during rollout.

## Achievements

Three new achievements in `lib/achievements.ts`, using a new `daily` category to distinguish from the existing `streak` category (which tracks in-round consecutive correct answers). The existing `daily_3` achievement ("Complete 3 daily challenges") remains unchanged in the `streak` category — it refers to daily challenge game mode sessions, not login streaks.

### Type changes required

- Add `'daily'` to the `AchievementCategory` union type
- Add `daily: 'DAILY'` to `CATEGORY_LABELS`

### New achievements

| ID          | Name           | Description                  | Rarity   | Category   |
|-------------|----------------|------------------------------|----------|------------|
| `streak_3d` | 3-Day Streak   | Play 3 days in a row         | common   | daily      |
| `streak_7d` | 7-Day Streak   | Play 7 days in a row         | uncommon | daily      |
| `streak_30d`| 30-Day Streak  | Play 30 days in a row        | rare     | daily      |

### Achievement Checking

The `CheckFn` type in `achievement-checker.ts` must be widened to include `currentStreak` in the `extra` bag. The field is optional so that `backfillPlayerAchievements` (which doesn't have streak context) continues to compile — streak achievements simply won't match during backfill, which is the intended behavior:

```typescript
type Extra = {
  dailySessionCount: number,   // existing
  currentStreak?: number,       // NEW — from player_streaks row (optional for backfill compat)
}
```

The `checkAchievements` function currently constructs the `extra` object internally. It will be modified to accept `currentStreak` as an additional parameter, which it threads into the `extra` bag alongside `dailySessionCount`:

```typescript
export async function checkAchievements(
  supabase: SupabaseClient,
  playerId: string,
  sessionId: string,
  gameMode: string,
  currentStreak: number  // NEW parameter
): Promise<string[]>
```

Achievement checks (guard against undefined for backfill safety):

```typescript
{ id: 'streak_3d',  check: (player, answers, gameMode, extra) => (extra.currentStreak ?? 0) >= 3 },
{ id: 'streak_7d',  check: (player, answers, gameMode, extra) => (extra.currentStreak ?? 0) >= 7 },
{ id: 'streak_30d', check: (player, answers, gameMode, extra) => (extra.currentStreak ?? 0) >= 30 },
```

### Backfill

No backfill. Streaks start fresh for all players from the date this feature ships. Reconstructing historical streaks from `sessions.completed_at` would be unreliable (gaps in data, timezone ambiguity) and not worth the complexity. The `backfillPlayerAchievements` function does not need to handle streak achievements — they are earned going forward only.

## Frontend Changes

### RoundSummary.tsx

In the XP award section, add a streak line when `streakBonusXp > 0`:

```
+15 XP    Day 3 streak bonus
```

Styled consistently with existing XP display. Use the existing terminal/retro aesthetic.

When `streakBonusXp === 0` and `streakDay > 0` (same-day repeat, signed-in player), show current streak status without bonus:

```
Day 3 streak (bonus already earned today)
```

When `streakDay === 0` (guest user or feature not yet deployed), show nothing. Note: `streakDay` will never be `0` for an authenticated player post-deployment — even a first-time player gets `streakDay: 1`.

### Profile/Stats Display

The `/api/player` GET response is extended to include streak data (from `player_streaks` join). The stats dashboard shows:
- "Current Streak: X days"
- "Longest Streak: X days"

Defaults to 0 if no `player_streaks` row exists yet.

## Research Impact

None. Streak data lives in `player_streaks` and `players.xp`. Research queries use `answers` and `sessions` tables exclusively. The streak bonus is purely a player progression mechanic.

## Out of Scope

- Social sharing (backlogged)
- Streak freeze / grace period mechanics
- Player-local timezone support
- Streak leaderboard
- Historical streak backfill
- Atomic Postgres RPC for streak+XP (accepted trade-off, see Edge Cases)
