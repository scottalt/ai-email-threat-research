# URL Display Text Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support disguised link text in card bodies so phishing cards can show convincing display text while the URL inspector reveals the actual malicious URL.

**Architecture:** `parseBody` in `GameCard.tsx` is extended to parse `[display text](actual url)` markdown-style links in addition to raw URLs. Display text renders in the card body; actual URL is shown only in the inspector. A one-time migration script uses Haiku to rewrite all existing card bodies in Supabase. The generation system prompt is updated for future cards.

**Tech Stack:** React/TypeScript, Supabase (`@supabase/supabase-js`), Anthropic SDK (`@anthropic-ai/sdk`), `ts-node`

---

### Task 1: Update parseBody and link rendering in GameCard.tsx

**Files:**
- Modify: `components/GameCard.tsx`

**Context:**

Current `parseBody` (lines 47-52):
```ts
function parseBody(text: string): Array<{ type: 'text' | 'url'; content: string }> {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part) =>
    /^https?:\/\//.test(part) ? { type: 'url', content: part } : { type: 'text', content: part }
  );
}
```

Used in both `EmailDisplay` (line 62) and `SMSDisplay` (line 198).

Both render URL segments identically (e.g. lines 166-173):
```tsx
<span
  className="text-[#ffaa00] underline cursor-pointer hover:text-[#ffcc44] transition-colors"
  onClick={(e) => { e.stopPropagation(); onUrlInspected?.(); setInspectedUrl(seg.content); }}
>
  {seg.content}
</span>
```

**Step 1: Replace parseBody**

Replace lines 47-52 entirely with:

```ts
type Segment =
  | { type: 'text'; content: string }
  | { type: 'url'; display: string; actual: string };

function parseBody(text: string): Segment[] {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s]+)/g;
  const segments: Segment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: text.slice(last, match.index) });
    }
    if (match[1] && match[2]) {
      segments.push({ type: 'url', display: match[1], actual: match[2] });
    } else {
      segments.push({ type: 'url', display: match[3], actual: match[3] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: 'text', content: text.slice(last) });
  }
  return segments;
}
```

**Step 2: Update URL rendering in EmailDisplay**

Find the URL segment span in EmailDisplay. Replace it with:

```tsx
<span
  className="text-[#ffaa00] underline cursor-pointer hover:text-[#ffcc44] transition-colors"
  onClick={(e) => { e.stopPropagation(); onUrlInspected?.(); setInspectedUrl(seg.actual); }}
>
  {seg.display}<span className="opacity-50 text-[9px] ml-0.5">[↗]</span>
</span>
```

**Step 3: Update URL rendering in SMSDisplay**

Same change in SMSDisplay — find the equivalent span and apply the same replacement.

**Step 4: Build check**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

**Step 5: Commit**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add components/GameCard.tsx && git commit -m "feat: support [display](url) link format with URL inspector reveal and arrow indicator"
```

---

### Task 2: Update generation system prompt

**Files:**
- Modify: `docs/prompts/system.md`

**Step 1: Append link format rules at the end of the file (after line 88)**

Add:

```
For links in card bodies — use the [display text](actual url) format for ALL cards that contain URLs:

Phishing cards:
- easy: display text is the raw suspicious URL or barely dressed (e.g. paypa1-secure.net/login) — the link itself is a tell
- medium: display text is plausible but imperfect (e.g. paypal.com.secure-login.net or "Verify your account now") — slightly off but not obvious
- hard/extreme: display text is completely convincing (e.g. paypal.com/verify or "Click here to confirm your details") — indistinguishable from a real email. The URL inspector is the only reveal.

Legitimate cards:
- display text should reflect what a real email from that sender would show: the real domain path, a descriptive phrase like "View your statement", or a shortened URL. The actual URL must be the same legitimate URL — no mismatch.

Always use [display](url) format. Never leave a raw URL exposed in the body.
```

**Step 2: Commit**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add docs/prompts/system.md && git commit -m "docs: add link display text rules to generation system prompt"
```

---

### Task 3: Write and run migration script

**Files:**
- Create: `scripts/fix-link-display-text.ts`

**Context:**

- Env vars from `.env.local`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
- Same setup pattern as `scripts/generate-cards.ts` (loads dotenv, imports Supabase + Anthropic)
- Run: `npx ts-node --project tsconfig.scripts.json scripts/fix-link-display-text.ts`
- `--dry-run` flag: print old/new body, no DB writes
- Model: `claude-haiku-4-5-20251001`
- Only process cards whose body has a raw `http` URL but NOT already in `[text](url)` format

**Step 1: Write the script**

```ts
/**
 * fix-link-display-text.ts
 *
 * One-time migration: wraps raw URLs in card bodies with [display text](url)
 * using Haiku. Applies to all cards in cards_staging and cards_real.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/fix-link-display-text.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/fix-link-display-text.ts --dry-run
 */

import path from 'path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const isDryRun = process.argv.includes('--dry-run');

function hasRawUrl(body: string): boolean {
  return /https?:\/\/[^\s)]+/.test(body) && !/\[.*?\]\(https?:\/\//.test(body);
}

function buildPrompt(card: {
  body: string;
  is_phishing: boolean;
  difficulty: string | null;
  technique: string | null;
}): string {
  const type = card.is_phishing
    ? `phishing — difficulty: ${card.difficulty ?? 'unknown'}${card.technique ? `, technique: ${card.technique}` : ''}`
    : 'legitimate';

  return `You are updating an email card body for a cybersecurity training game. The card is: ${type}.

Rewrite the body below, wrapping every raw URL in [display text](url) format.

Rules:
${card.is_phishing ? `Phishing — apply based on difficulty:
- easy: display text is the suspicious URL itself or barely cleaned (keep it obviously suspicious)
- medium: display text is plausible but imperfect — a near-miss domain or a generic phrase
- hard/extreme: display text is completely convincing (e.g. "paypal.com/verify" or "Click here to confirm your details") — the URL inspector is the only reveal` : `Legitimate — display text reflects what a real email would show: the real domain path, a short descriptive phrase like "View your statement", or a shortened URL. The actual URL must be unchanged — no mismatch.`}

Return ONLY the rewritten body text. No explanation, no JSON wrapper. Change nothing except wrapping raw URLs.

Body:
${card.body}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY required');

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const [stagingRes, realRes] = await Promise.all([
    supabase.from('cards_staging').select('id, body, is_phishing, difficulty, technique').ilike('body', '%http%'),
    supabase.from('cards_real').select('id, body, is_phishing, difficulty, technique').ilike('body', '%http%'),
  ]);

  if (stagingRes.error) throw stagingRes.error;
  if (realRes.error) throw realRes.error;

  const staging = (stagingRes.data ?? []).filter((c) => hasRawUrl(c.body));
  const real = (realRes.data ?? []).filter((c) => hasRawUrl(c.body));

  console.log(`Found ${staging.length} cards_staging + ${real.length} cards_real to update (dry-run: ${isDryRun})`);

  let updated = 0;
  let failed = 0;

  async function processCard(
    card: { id: string; body: string; is_phishing: boolean; difficulty: string | null; technique: string | null },
    table: 'cards_staging' | 'cards_real',
  ) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt(card) }],
      });

      const newBody = (response.content[0] as { type: string; text: string }).text.trim();

      if (isDryRun) {
        console.log(`\n[DRY RUN] ${table} ${card.id} (${card.is_phishing ? card.difficulty : 'legit'})`);
        console.log('BEFORE:', card.body.slice(0, 150));
        console.log('AFTER: ', newBody.slice(0, 150));
      } else {
        const { error } = await supabase.from(table).update({ body: newBody }).eq('id', card.id);
        if (error) throw error;
        console.log(`✓ ${table} ${card.id}`);
      }
      updated++;
    } catch (err) {
      console.error(`✗ ${table} ${card.id}:`, err);
      failed++;
    }
    await sleep(200);
  }

  for (const card of staging) await processCard(card, 'cards_staging');
  for (const card of real) await processCard(card, 'cards_real');

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 2: Dry run**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npx ts-node --project tsconfig.scripts.json scripts/fix-link-display-text.ts --dry-run 2>&1 | head -80
```

Expected: OLD/NEW previews. Verify:
- Easy phishing: display text still looks suspicious
- Hard/extreme phishing: display text looks completely legit
- Legit: display text is natural, actual URL unchanged

**Step 3: Run live migration**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npx ts-node --project tsconfig.scripts.json scripts/fix-link-display-text.ts 2>&1 | tee migration-url-display.log
```

Expected: `✓` lines for each card, final summary with 0 failures.

**Step 4: Commit**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git add scripts/fix-link-display-text.ts && git commit -m "feat: add Haiku migration script for URL display text rewrite"
```

---

### Task 4: Manual verification

1. Play a hard phishing card with a link — body shows convincing display text + `[↗]`, inspector reveals the malicious URL
2. Play an easy phishing card — display text is the suspicious URL (or close to it)
3. Play a legit card with a link — display text looks natural, inspector shows same domain
4. Play a card without any links — no `[↗]` indicators, no change

**Push:**
```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && git push
```
