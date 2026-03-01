# Daily Challenge Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a daily challenge mode where every player gets the same 10 cards per day, one attempt per day enforced via localStorage, with a separate daily leaderboard in Redis.

**Architecture:** Seeded client-side PRNG (mulberry32) derives today's card set from the date string. `Game.tsx` tracks `mode: GameMode` and gates daily replays via localStorage. The existing `/api/leaderboard` route is extended with an optional `?date=` param to key into `leaderboard:daily:YYYY-MM-DD` sorted sets with 7-day TTL.

**Tech Stack:** Next.js 16 App Router, React 19, Upstash Redis (`@upstash/redis`), localStorage, CSS animations (existing globals.css)

---

### Task 1: Add `GameMode` type and `getDailyDeck()` to cards

**Files:**
- Modify: `lib/types.ts`
- Modify: `data/cards.ts`

**Step 1: Add `GameMode` type to `lib/types.ts`**

Append to the bottom of the file:

```typescript
export type GameMode = 'daily' | 'freeplay';
```

**Step 2: Add mulberry32 PRNG and `getDailyDeck()` to `data/cards.ts`**

Add after the `CARDS` array and before/after `getShuffledDeck`. Add these two functions:

```typescript
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr: string): number {
  return dateStr.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 0);
}

export function getDailyDeck(): Card[] {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const rand = mulberry32(dateToSeed(today));
  const shuffled = [...CARDS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 10);
}
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add lib/types.ts data/cards.ts
git commit -m "feat: add GameMode type and getDailyDeck() with seeded PRNG"
```

---

### Task 2: Extend `/api/leaderboard` to support daily key

**Files:**
- Modify: `app/api/leaderboard/route.ts`

**Step 1: Update GET to accept `?date=` param**

Replace the current GET handler with:

```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const key = date ? `leaderboard:daily:${date}` : KEY;

  const results = await redis.zrange(key, 0, 19, {
    rev: true,
    withScores: true,
  }) as (string | number)[];

  const entries: { name: string; score: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    const member = results[i] as string;
    const score = results[i + 1] as number;
    entries.push({ name: member.split(':')[0], score });
  }

  return NextResponse.json(entries);
}
```

**Step 2: Update POST to accept `date` in body and set TTL on daily keys**

Replace the current POST handler with:

```typescript
export async function POST(req: Request) {
  try {
    const { name, score, date } = await req.json();
    const key = date ? `leaderboard:daily:${date}` : KEY;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    const trimmed = name.trim().slice(0, 20);

    if (trimmed.length < 1) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    if (!isClean(trimmed)) {
      return NextResponse.json({ error: 'Keep it clean.' }, { status: 400 });
    }

    if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const member = `${trimmed}:${Date.now()}`;
    await redis.zadd(key, { score, member });

    if (date) {
      await redis.expire(key, 60 * 60 * 24 * 7);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add app/api/leaderboard/route.ts
git commit -m "feat: extend leaderboard API to support daily key with TTL"
```

---

### Task 3: Update `Game.tsx` to handle mode and daily state

**Files:**
- Modify: `components/Game.tsx`

**Step 1: Update imports and types**

Add `getDailyDeck` to the import from cards, add `GameMode` to the types import:

```typescript
import { getShuffledDeck, getDailyDeck } from '@/data/cards';
import type { Card, Answer, Confidence, RoundResult, GameMode } from '@/lib/types';
```

**Step 2: Add mode state, daily helper, and new phase**

Add `'daily_complete'` to the `GamePhase` type and new state variables:

```typescript
type GamePhase = 'start' | 'playing' | 'feedback' | 'summary' | 'daily_complete';

// Inside Game():
const [mode, setMode] = useState<GameMode>('freeplay');
const [dailyResult, setDailyResult] = useState<{ score: number; totalScore: number } | null>(null);
```

**Step 3: Add helper to get today's localStorage key**

Add inside the `Game` function before `startRound`:

```typescript
function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDailyStorageKey(): string {
  return `daily_${getToday()}`;
}
```

**Step 4: Update `startRound` to accept mode and handle daily gate**

Replace the existing `startRound` function:

```typescript
function startRound(newMode: GameMode = 'freeplay') {
  if (newMode === 'daily') {
    const stored = localStorage.getItem(getDailyStorageKey());
    if (stored) {
      try {
        setDailyResult(JSON.parse(stored));
      } catch {
        setDailyResult(null);
      }
      setMode('daily');
      setPhase('daily_complete');
      return;
    }
  }
  setMode(newMode);
  setDeck(newMode === 'daily' ? getDailyDeck() : getShuffledDeck(ROUND_SIZE));
  setCurrentIndex(0);
  setResults([]);
  setLastResult(null);
  setStreak(0);
  setTotalScore(0);
  setPhase('playing');
}
```

**Step 5: Save to localStorage when daily round completes**

In `handleNext`, when `nextIndex >= ROUND_SIZE` and mode is daily, save to localStorage before setting phase. Update the relevant block:

```typescript
function handleNext() {
  const nextIndex = currentIndex + 1;
  if (nextIndex >= ROUND_SIZE) {
    if (mode === 'daily') {
      const correctCount = results.filter((r) => r.correct).length;
      localStorage.setItem(
        getDailyStorageKey(),
        JSON.stringify({ score: correctCount, totalScore })
      );
    }
    setPhase('summary');
  } else {
    setCurrentIndex(nextIndex);
    setPhase('playing');
  }
}
```

**Step 6: Update StartScreen render call**

Change the StartScreen call to pass mode:

```typescript
if (phase === 'start') {
  return <StartScreen onStart={startRound} />;
}
```

No change needed here — StartScreen will call `onStart('daily')` or `onStart('freeplay')`, and TypeScript will validate.

**Step 7: Update RoundSummary render call to pass mode and date**

```typescript
if (phase === 'summary') {
  return (
    <RoundSummary
      score={results.filter((r) => r.correct).length}
      total={ROUND_SIZE}
      totalScore={totalScore}
      results={results}
      mode={mode}
      date={getToday()}
      onPlayAgain={() => startRound('freeplay')}
    />
  );
}
```

**Step 8: Add `daily_complete` phase render**

Add before the final `return null`:

```typescript
if (phase === 'daily_complete') {
  return (
    <div className="anim-fade-in-up w-full max-w-sm px-4 flex flex-col gap-4">
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[#00aa28] text-xs tracking-widest">DAILY_CHALLENGE</span>
          <span className="text-[#003a0e] text-xs font-mono">{getToday()}</span>
        </div>
        <div className="px-3 py-6 text-center space-y-2">
          <div className="text-xs font-mono text-[#00aa28] tracking-widest">ALREADY_DEPLOYED</div>
          <div className="text-4xl font-black font-mono text-[#00ff41] glow">
            {dailyResult?.totalScore ?? 0}
          </div>
          <div className="text-xs font-mono text-[#00aa28]">Come back tomorrow.</div>
        </div>
      </div>
      <button
        onClick={() => setPhase('start')}
        className="w-full py-4 term-border text-[#00aa28] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] active:scale-95 transition-all"
      >
        [ BACK TO TERMINAL ]
      </button>
    </div>
  );
}
```

**Step 9: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: errors about StartScreen and RoundSummary prop mismatches — those are fixed in the next tasks.

**Step 10: Commit when Tasks 4 and 5 are also done** (skip commit here, batch with next tasks)

---

### Task 4: Update `StartScreen` for dual-mode UI

**Files:**
- Modify: `components/StartScreen.tsx`

**Step 1: Update props interface**

Change `onStart: () => void` to:

```typescript
interface Props {
  onStart: (mode: GameMode) => void;
}
```

Add import at top:

```typescript
import type { GameMode } from '@/lib/types';
```

**Step 2: Add daily date display helper**

Add inside the component before the return:

```typescript
const today = new Date();
const dateLabel = today.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
```

**Step 3: Replace the single start button with two buttons**

In the `showButton` section, replace the single `[ INITIALIZE SESSION ]` button with:

```tsx
<button
  onClick={() => onStart('daily')}
  className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
>
  [ DAILY CHALLENGE — {dateLabel} ]
</button>

<button
  onClick={() => onStart('freeplay')}
  className="w-full py-3 term-border text-[#00aa28] font-mono font-bold tracking-widest text-xs hover:bg-[rgba(0,255,65,0.05)] active:scale-95 transition-all"
>
  [ FREEPLAY ]
</button>
```

**Step 4: Add daily leaderboard section**

Add a second leaderboard state for the daily:

```typescript
const [dailyLeaderboard, setDailyLeaderboard] = useState<LeaderboardEntry[]>([]);
```

In `fetchLeaderboard`, also fetch the daily:

```typescript
const fetchLeaderboard = useCallback(async () => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  try {
    const [globalRes, dailyRes] = await Promise.all([
      fetch('/api/leaderboard'),
      fetch(`/api/leaderboard?date=${today}`),
    ]);
    if (globalRes.ok) setLeaderboard(await globalRes.json());
    if (dailyRes.ok) setDailyLeaderboard(await dailyRes.json());
  } catch {
    // silently fail
  }
}, []);
```

**Step 5: Add daily leaderboard block in JSX**

Add between the daily button and the freeplay button (or after both, above the global leaderboard):

```tsx
{dailyLeaderboard.length > 0 && (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
      <span className="text-[#00aa28] text-xs tracking-widest">DAILY_TOP_ANALYSTS</span>
      <span className="text-[#003a0e] text-xs font-mono">{dateLabel}</span>
    </div>
    <div className="divide-y divide-[rgba(0,255,65,0.08)]">
      {dailyLeaderboard.slice(0, 10).map((entry, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-1.5">
          <span className={`text-[10px] font-mono w-4 shrink-0 ${i === 0 ? 'text-[#ffaa00]' : 'text-[#003a0e]'}`}>
            {i + 1}
          </span>
          <span className="text-[#00aa28] text-xs font-mono flex-1 truncate">
            {entry.name}
          </span>
          <span className="text-[#00ff41] text-xs font-mono font-bold glow">
            {entry.score}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

Place the global leaderboard block (existing) after the freeplay button.

**Step 6: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: errors about RoundSummary props — fixed in Task 5.

---

### Task 5: Update `RoundSummary` for daily mode

**Files:**
- Modify: `components/RoundSummary.tsx`

**Step 1: Update props interface**

Add `mode` and `date` to Props, import GameMode:

```typescript
import type { GameMode } from '@/lib/types';

interface Props {
  score: number;
  total: number;
  totalScore: number;
  results: RoundResult[];
  mode: GameMode;
  date: string;
  onPlayAgain: () => void;
}
```

**Step 2: Update component signature**

```typescript
export function RoundSummary({ score, total, totalScore, results, mode, date, onPlayAgain }: Props) {
```

**Step 3: Add daily leaderboard state**

```typescript
const [dailyLeaderboard, setDailyLeaderboard] = useState<{ name: string; score: number }[]>([]);

useEffect(() => {
  if (mode !== 'daily') return;
  fetch(`/api/leaderboard?date=${date}`)
    .then((r) => r.ok ? r.json() : [])
    .then(setDailyLeaderboard)
    .catch(() => {});
}, [mode, date]);
```

**Step 4: Update leaderboard POST to include date for daily mode**

In `handleSubmit`, change the fetch body:

```typescript
body: JSON.stringify({
  name: name.trim(),
  score: totalScore,
  ...(mode === 'daily' ? { date } : {}),
}),
```

After successful POST in daily mode, refresh the daily leaderboard:

```typescript
if (res.ok) {
  setSubmitState('done');
  if (mode === 'daily') {
    fetch(`/api/leaderboard?date=${date}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setDailyLeaderboard)
      .catch(() => {});
  }
}
```

**Step 5: Update the summary header label for daily mode**

Change `SESSION_COMPLETE` to show mode:

```tsx
<span className="text-[#00aa28] text-xs tracking-widest">
  {mode === 'daily' ? 'DAILY_COMPLETE' : 'SESSION_COMPLETE'}
</span>
```

**Step 6: Add daily leaderboard block after submission form**

Add between the submission block and the play-again button:

```tsx
{mode === 'daily' && dailyLeaderboard.length > 0 && (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
      <span className="text-[#00aa28] text-xs tracking-widest">DAILY_LEADERBOARD</span>
      <span className="text-[#003a0e] text-xs font-mono">{date}</span>
    </div>
    <div className="divide-y divide-[rgba(0,255,65,0.08)]">
      {dailyLeaderboard.slice(0, 10).map((entry, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-1.5">
          <span className={`text-[10px] font-mono w-4 shrink-0 ${i === 0 ? 'text-[#ffaa00]' : 'text-[#003a0e]'}`}>
            {i + 1}
          </span>
          <span className="text-[#00aa28] text-xs font-mono flex-1 truncate">{entry.name}</span>
          <span className="text-[#00ff41] text-xs font-mono font-bold glow">{entry.score}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 7: Update the play-again button for daily mode**

```tsx
<button
  onClick={onPlayAgain}
  className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:scale-95 transition-all glow"
>
  {mode === 'daily' ? '[ BACK TO TERMINAL ]' : '[ RUN AGAIN ]'}
</button>
```

**Step 8: Verify everything compiles clean**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 9: Commit all changes**

```bash
git add components/Game.tsx components/StartScreen.tsx components/RoundSummary.tsx
git commit -m "feat: daily challenge mode with localStorage gate and daily leaderboard"
```

---

### Task 6: Smoke test and push

**Step 1: Start dev server if not running**

```bash
npm run dev
```

**Step 2: Test freeplay still works**
- Open http://localhost:3000
- Click `[ FREEPLAY ]`
- Play through a round, submit to leaderboard
- Verify global leaderboard updates

**Step 3: Test daily challenge**
- Click `[ DAILY CHALLENGE — <date> ]`
- Play through a round
- Verify `DAILY_COMPLETE` header on summary
- Submit callsign — verify daily leaderboard appears on summary
- Go back to start — verify daily leaderboard appears under daily button

**Step 4: Test one-and-done gate**
- Click `[ DAILY CHALLENGE ]` again
- Verify `ALREADY_DEPLOYED` screen shows stored score
- Verify `[ BACK TO TERMINAL ]` returns to start

**Step 5: Push**

```bash
git push origin master
```
