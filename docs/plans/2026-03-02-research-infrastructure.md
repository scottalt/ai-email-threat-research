# Research Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tool-usage tracking (headers panel opened, URL inspected) and card-level signal metadata to every answer, update the intel API with research-grade analytics, and surface findings on the /intel page.

**Architecture:** Six code tasks + one Supabase migration SQL file. The migration must be run in the Supabase console by Scott before the new columns can receive data — but the game will never break even if it isn't run yet (fire-and-forget API). Changes flow: types → GameCard (tracking) → Game (wire-through) → /api/answers (persist) → /api/intel (aggregate) → /intel page (display).

**Tech Stack:** Next.js App Router, TypeScript, Supabase (postgres), Tailwind CSS v4, no test framework

**⚠️ Manual step required by Scott:** After Task 5 is committed, run the SQL from `supabase/migrations/add-research-signal-columns.sql` in the Supabase SQL editor before deploying. The code will not break without it but new columns will not receive data.

---

### Task 1: Extend AnswerEvent with research signal fields

**Files:**
- Modify: `lib/types.ts`

Add 6 new fields to the `AnswerEvent` interface, after `datasetVersion`:

```ts
export interface AnswerEvent {
  // ... all existing fields unchanged ...
  datasetVersion: string | null;
  // New research signal fields
  headersOpened: boolean;
  urlInspected: boolean;
  authStatusSignal: string;      // card.authStatus — denormalized for analytics
  hasReplyTo: boolean;           // card.replyTo is present (mismatched reply-to)
  hasUrl: boolean;               // card body contains at least one URL
  hasAttachment: boolean;        // card references an attachment (future use, always false for now)
}
```

**Step 1: Apply the edit**

Find the closing brace of `AnswerEvent` (currently ends at `datasetVersion: string | null;`). Add the 6 new fields after it.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors in Game.tsx because `AnswerEvent` now requires the new fields. That is correct — the errors will be fixed in Task 3.

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: extend AnswerEvent with tool-usage and card-signal fields"
```

---

### Task 2: Track tool usage in GameCard.tsx

**Files:**
- Modify: `components/GameCard.tsx`

**Context:** `EmailDisplay` is a child component of `GameCard`. It owns `headersOpen` and `inspectedUrl` state. `GameCard` needs to know if either was ever activated before the player answers, so it can include them in the answer event. The approach: add two refs in `GameCard` and pass callbacks into `EmailDisplay`.

**Step 1: Add refs to GameCard**

Inside the `GameCard` function body, after the existing refs (around line 183), add:

```tsx
const headersEverOpened = useRef(false);
const urlEverInspected  = useRef(false);
```

**Step 2: Update Props interface for GameCard**

The `Props` interface is at lines 11–26. No change needed here — the new tracking is internal.

**Step 3: Update the onAnswer prop type**

The `Props` interface has `onAnswer`. Update the `timing` object type to include the two new booleans:

```tsx
interface Props {
  card: Card;
  onAnswer: (answer: Answer, confidence: Confidence, timing?: {
    timeFromRenderMs: number;
    timeFromConfidenceMs: number | null;
    confidenceSelectionTimeMs: number | null;
    scrollDepthPct: number;
    answerMethod: 'swipe' | 'button';
    headersOpened: boolean;
    urlInspected: boolean;
  }) => void;
  questionNumber: number;
  total: number;
  streak: number;
  totalScore: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
}
```

**Step 4: Pass the new values in fly()**

The `fly()` function builds the timing object and calls `onAnswer`. Update the `setTimeout` call to include the two new booleans:

```tsx
setTimeout(() => onAnswer(
  direction === 'left' ? 'phishing' : 'legit',
  conf,
  {
    timeFromRenderMs: timeFromRender,
    timeFromConfidenceMs: timeFromConfidence,
    confidenceSelectionTimeMs: confidenceSelectionTime,
    scrollDepthPct: maxScrollDepth.current,
    answerMethod: method,
    headersOpened: headersEverOpened.current,
    urlInspected: urlEverInspected.current,
  }
), 230);
```

**Step 5: Add callback props to EmailDisplay**

`EmailDisplay` currently takes `{ card, onScroll }`. Add two optional callbacks:

```tsx
function EmailDisplay({ card, onScroll, onHeadersOpened, onUrlInspected }: {
  card: Card;
  onScroll?: (pct: number) => void;
  onHeadersOpened?: () => void;
  onUrlInspected?: () => void;
}) {
```

**Step 6: Fire onHeadersOpened when headers panel first opens**

Find the `[HEADERS]` button `onClick` in `EmailDisplay`. Update it to fire the callback when opening (not closing):

```tsx
onClick={(e) => {
  e.stopPropagation();
  if (!headersOpen) onHeadersOpened?.();
  setHeadersOpen((o) => !o);
}}
```

**Step 7: Fire onUrlInspected when a URL is tapped**

Find the URL `<span>` `onClick` in `EmailDisplay`. Update it to fire the callback:

```tsx
onClick={(e) => {
  e.stopPropagation();
  onUrlInspected?.();
  setInspectedUrl(seg.content);
}}
```

**Step 8: Pass callbacks from GameCard to EmailDisplay**

Find where `EmailDisplay` is rendered inside `GameCard` (currently just `<EmailDisplay card={card} onScroll={...} />`). Update to pass the callbacks:

```tsx
<EmailDisplay
  card={card}
  onScroll={(pct) => { maxScrollDepth.current = Math.max(maxScrollDepth.current, pct); }}
  onHeadersOpened={() => { headersEverOpened.current = true; }}
  onUrlInspected={() => { urlEverInspected.current = true; }}
/>
```

**Step 9: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: still errors in Game.tsx (AnswerEvent missing new fields). That is correct — fixed in Task 3.

**Step 10: Commit**

```bash
git add components/GameCard.tsx
git commit -m "feat: track headers panel and URL inspector usage per answer"
```

---

### Task 3: Wire new fields through Game.tsx handleAnswer

**Files:**
- Modify: `components/Game.tsx`

**Context:** `handleAnswer` in Game.tsx receives the `timing` object from `GameCard` and builds the `AnswerEvent`. It needs to extract the two new booleans and compute four card-level signal fields.

**Step 1: Extract tool-usage booleans**

In `handleAnswer`, the `timing` parameter is typed inline. Update the type signature to include the new fields (match what GameCard now passes):

Find the `handleAnswer` function definition (around line 110). The `timing` param currently ends with `answerMethod`. Add:

```tsx
function handleAnswer(
  answer: Answer,
  confidence: Confidence,
  timing?: {
    timeFromRenderMs: number;
    timeFromConfidenceMs: number | null;
    confidenceSelectionTimeMs: number | null;
    scrollDepthPct: number;
    answerMethod: 'swipe' | 'button';
    headersOpened: boolean;
    urlInspected: boolean;
  }
) {
```

**Step 2: Add the 6 new fields to the AnswerEvent build**

Find where the `answerEvent` object is built (around lines 143–172). After `datasetVersion`, add:

```tsx
headersOpened: timing?.headersOpened ?? false,
urlInspected: timing?.urlInspected ?? false,
authStatusSignal: card.authStatus,
hasReplyTo: !!card.replyTo,
hasUrl: /https?:\/\//.test(card.body),
hasAttachment: false,
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. The AnswerEvent is now fully satisfied.

**Step 4: Commit**

```bash
git add components/Game.tsx
git commit -m "feat: include tool-usage and card-signal fields in answer events"
```

---

### Task 4: Persist new fields in /api/answers

**Files:**
- Modify: `app/api/answers/route.ts`

**Context:** The route maps AnswerEvent fields to Supabase column names. Add mappings for the 6 new fields. The columns don't exist in Supabase yet (Task 5 creates them), but Supabase silently ignores unknown columns — and the fire-and-forget pattern means no game breakage.

**Step 1: Add mappings to the answers insert**

Find the `.insert({` block (lines 11–40). After `dataset_version: body.answer.datasetVersion,`, add:

```ts
headers_opened: body.answer.headersOpened,
url_inspected: body.answer.urlInspected,
auth_status: body.answer.authStatusSignal,
has_reply_to: body.answer.hasReplyTo,
has_url: body.answer.hasUrl,
has_attachment: body.answer.hasAttachment,
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/api/answers/route.ts
git commit -m "feat: persist tool-usage and card-signal columns in answers table"
```

---

### Task 5: Write Supabase migration SQL

**Files:**
- Create: `supabase/migrations/add-research-signal-columns.sql`

**Context:** This file is NOT run automatically. Scott runs it manually in the Supabase SQL editor. Once run, the new columns exist and all new answer inserts will populate them.

**Step 1: Create the migration file**

```sql
-- Research signal columns: tool usage tracking + card-level signal metadata
-- Run in Supabase SQL editor. Safe to run once — uses IF NOT EXISTS pattern.

ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS headers_opened BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS url_inspected  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auth_status    TEXT,
  ADD COLUMN IF NOT EXISTS has_reply_to   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_url        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_attachment BOOLEAN DEFAULT FALSE;

-- Indexes for common analytical queries
CREATE INDEX IF NOT EXISTS idx_answers_headers_opened ON answers (headers_opened);
CREATE INDEX IF NOT EXISTS idx_answers_url_inspected  ON answers (url_inspected);
CREATE INDEX IF NOT EXISTS idx_answers_auth_status    ON answers (auth_status);
```

**Step 2: Commit**

```bash
git add supabase/migrations/add-research-signal-columns.sql
git commit -m "chore: add Supabase migration for research signal columns"
```

**⚠️ Scott must now run this SQL in the Supabase dashboard before the next step produces meaningful data.**

---

### Task 6: Update /api/intel with research analytics

**Files:**
- Modify: `app/api/intel/route.ts`

**Context:** The intel route fetches all research-mode answers and computes aggregates. Add: tool usage rates, tool-usage vs accuracy correlation, auth-trap bypass rate (PASS-headers phishing), and median time-to-answer by technique.

**Step 1: Expand the SELECT to include new columns**

The current `.select(...)` string is:
```ts
'correct, technique, is_genai_suspected, genai_confidence, prose_fluency, grammar_quality, confidence, time_from_render_ms, difficulty, type, card_source'
```

Replace with:
```ts
'correct, technique, is_phishing, is_genai_suspected, genai_confidence, prose_fluency, grammar_quality, confidence, time_from_render_ms, difficulty, type, card_source, headers_opened, url_inspected, auth_status, has_reply_to, has_url'
```

**Step 2: Add tool usage analytics**

After the `const total` / `correct` lines, add:

```ts
// Tool usage rates
const withHeaders = answers.filter((a) => a.headers_opened);
const withUrl     = answers.filter((a) => a.url_inspected);
const headersOpenedPct      = Math.round((withHeaders.length / total) * 100);
const urlInspectedPct       = Math.round((withUrl.length / total) * 100);
const headersOpenedAccuracy = withHeaders.length
  ? Math.round((withHeaders.filter((a) => a.correct).length / withHeaders.length) * 100) : null;
const headersNotOpenedAccuracy = (total - withHeaders.length)
  ? Math.round((answers.filter((a) => !a.headers_opened && a.correct).length / (total - withHeaders.length)) * 100) : null;
const urlInspectedAccuracy = withUrl.length
  ? Math.round((withUrl.filter((a) => a.correct).length / withUrl.length) * 100) : null;
const urlNotInspectedAccuracy = (total - withUrl.length)
  ? Math.round((answers.filter((a) => !a.url_inspected && a.correct).length / (total - withUrl.length)) * 100) : null;
```

**Step 3: Add auth-trap bypass rate**

```ts
// Auth-trap cards: phishing with PASS headers (hardest scenario)
const authTrapAnswers = answers.filter((a) => a.is_phishing && a.auth_status === 'verified');
const authTrapBypassRate = authTrapAnswers.length
  ? Math.round((authTrapAnswers.filter((a) => !a.correct).length / authTrapAnswers.length) * 100) : null;
```

**Step 4: Add median time-to-answer by technique**

```ts
// Median time-to-answer by technique
function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const techniqueTimeMap: Record<string, number[]> = {};
for (const a of answers) {
  if (!a.technique || a.time_from_render_ms == null) continue;
  if (!techniqueTimeMap[a.technique]) techniqueTimeMap[a.technique] = [];
  techniqueTimeMap[a.technique].push(a.time_from_render_ms);
}
const medianTimeByTechnique = Object.entries(techniqueTimeMap)
  .filter(([, times]) => times.length >= 10)
  .map(([technique, times]) => ({
    technique,
    medianMs: median(times),
    sample: times.length,
  }))
  .sort((a, b) => a.medianMs - b.medianMs);
```

**Step 5: Add new fields to the return object**

After `byConfidence` in the `return NextResponse.json({...})`, add:

```ts
toolUsage: {
  headersOpenedPct,
  urlInspectedPct,
  headersOpenedAccuracy,
  headersNotOpenedAccuracy,
  urlInspectedAccuracy,
  urlNotInspectedAccuracy,
  headersOpenedSample: withHeaders.length,
  urlInspectedSample: withUrl.length,
},
authTrap: {
  bypassRate: authTrapBypassRate,
  sample: authTrapAnswers.length,
},
medianTimeByTechnique,
```

**Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. (The route returns `NextResponse.json` which is untyped at the return level.)

**Step 7: Commit**

```bash
git add app/api/intel/route.ts
git commit -m "feat: add tool-usage, auth-trap, and median-time analytics to intel API"
```

---

### Task 7: Update /intel page with new analytics sections

**Files:**
- Modify: `app/intel/page.tsx`

**Context:** The page is a Next.js Server Component that renders the IntelData returned by /api/intel. Add an `IntelData` interface extension and three new UI sections: tool usage correlation, auth-trap finding, and median time by technique.

**Step 1: Extend the IntelData interface**

The current `IntelData` interface is at the top of the file (lines 3–21). Add new optional fields:

```ts
interface IntelData {
  totalAnswers: number;
  insufficient?: boolean;
  overallBypassRate: number;
  byTechnique: { technique: string; total: number; bypassRate: number }[];
  fluency: { highFluencyBypassRate: number | null; lowFluencyBypassRate: number | null; highFluencySample: number; lowFluencySample: number };
  genai: { genaiBypassRate: number | null; traditionalBypassRate: number | null; genaiSample: number; traditionalSample: number };
  byConfidence: { confidence: string; total: number; accuracyRate: number }[];
  // New research signal analytics
  toolUsage?: {
    headersOpenedPct: number;
    urlInspectedPct: number;
    headersOpenedAccuracy: number | null;
    headersNotOpenedAccuracy: number | null;
    urlInspectedAccuracy: number | null;
    urlNotInspectedAccuracy: number | null;
    headersOpenedSample: number;
    urlInspectedSample: number;
  };
  authTrap?: {
    bypassRate: number | null;
    sample: number;
  };
  medianTimeByTechnique?: { technique: string; medianMs: number; sample: number }[];
}
```

**Step 2: Add TOOL_USAGE section to the page JSX**

Find the `byConfidence` section (last section before the methodology footer). After it, add the tool usage section. Insert before the methodology `<div>`:

```tsx
{data.toolUsage && data.toolUsage.headersOpenedSample >= 10 && (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
      <span className="text-[#00aa28] text-xs tracking-widest">TOOL_USAGE_CORRELATION</span>
    </div>
    <div className="px-3 py-3 space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="term-border px-2 py-2 text-center">
          <div className="text-[#00ff41] text-lg font-mono font-bold glow">{data.toolUsage.headersOpenedPct}%</div>
          <div className="text-[#00aa28] text-[10px] font-mono mt-0.5">opened [HEADERS]</div>
        </div>
        <div className="term-border px-2 py-2 text-center">
          <div className="text-[#00ff41] text-lg font-mono font-bold glow">{data.toolUsage.urlInspectedPct}%</div>
          <div className="text-[#00aa28] text-[10px] font-mono mt-0.5">inspected URLs</div>
        </div>
      </div>
      {data.toolUsage.headersOpenedAccuracy !== null && data.toolUsage.headersNotOpenedAccuracy !== null && (
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[#00aa28]">accuracy w/ headers open</span>
            <span className="text-[#00ff41] glow">{data.toolUsage.headersOpenedAccuracy}%</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[#00aa28]">accuracy w/o headers open</span>
            <span className="text-[#ffaa00]">{data.toolUsage.headersNotOpenedAccuracy}%</span>
          </div>
          {data.toolUsage.urlInspectedAccuracy !== null && (
            <>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#00aa28]">accuracy w/ URL inspected</span>
                <span className="text-[#00ff41] glow">{data.toolUsage.urlInspectedAccuracy}%</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#00aa28]">accuracy w/o URL inspected</span>
                <span className="text-[#ffaa00]">{data.toolUsage.urlNotInspectedAccuracy}%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  </div>
)}

{data.authTrap && data.authTrap.sample >= 10 && data.authTrap.bypassRate !== null && (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(255,51,51,0.35)] px-3 py-1.5">
      <span className="text-[#ff3333] text-xs tracking-widest glow-red">AUTH_TRAP_FINDING</span>
    </div>
    <div className="px-3 py-3">
      <div className="text-center mb-2">
        <div className="text-[#ff3333] text-2xl font-mono font-bold glow-red">{data.authTrap.bypassRate}%</div>
        <div className="text-[#00aa28] text-[10px] font-mono mt-0.5">bypass rate on PASS-headers phishing</div>
        <div className="text-[#003a0e] text-[10px] font-mono">n={data.authTrap.sample}</div>
      </div>
      <p className="text-[#00aa28] text-[10px] font-mono leading-relaxed">
        Cards where SPF/DKIM/DMARC passed but the email was phishing. Authentication headers alone are insufficient — attackers configure valid auth on lookalike domains.
      </p>
    </div>
  </div>
)}

{data.medianTimeByTechnique && data.medianTimeByTechnique.length > 0 && (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
      <span className="text-[#00aa28] text-xs tracking-widest">MEDIAN_DECISION_TIME</span>
    </div>
    <div className="px-3 py-3 space-y-2">
      {data.medianTimeByTechnique.map(({ technique, medianMs }) => {
        const maxMs = Math.max(...data.medianTimeByTechnique!.map((t) => t.medianMs));
        const pct = Math.round((medianMs / maxMs) * 100);
        const secs = (medianMs / 1000).toFixed(1);
        return (
          <div key={technique} className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-[#00aa28] truncate">{technique}</span>
              <span className="text-[#00ff41] shrink-0 ml-2">{secs}s</span>
            </div>
            <div className="h-1 bg-[#003a0e] w-full">
              <div className="h-full bg-[#00aa28]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="text-[#003a0e] text-[10px] font-mono pt-1">Faster decisions may indicate higher confidence — or less investigation.</p>
    </div>
  </div>
)}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Visual check**

```bash
npm run dev
```

Visit http://localhost:3000/intel. With no research data yet, sections will not render (sample < 10 guard). That is correct.

**Step 5: Commit**

```bash
git add app/intel/page.tsx
git commit -m "feat: add tool-usage, auth-trap, and decision-time sections to intel page"
```
