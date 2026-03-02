# replyTo Field Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional `replyTo` field to the `Card` type and wire it through the headers panel so hard phishing cards show a mismatched Reply-To address as a forensic signal.

**Architecture:** Three sequential changes — type first, then data, then UI. The field is optional (`replyTo?: string`); the headers panel falls back to `card.from` when absent, preserving existing behaviour for all non-hard cards. No new components, no new files.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, no test framework

---

### Task 1: Add `replyTo?: string` to the Card interface

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add the field**

In `lib/types.ts`, the `Card` interface currently ends at `authStatus: AuthStatus;` (line 19). Add `replyTo` as the next optional field:

```ts
export interface Card {
  id: string;
  type: CardType;
  difficulty: Difficulty;
  isPhishing: boolean;
  from: string;
  subject?: string;
  body: string;
  clues: string[];
  explanation: string;
  highlights?: string[];
  technique?: string | null;
  authStatus: AuthStatus;
  replyTo?: string;
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. (No existing code references `replyTo` yet, so this is a purely additive change.)

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add optional replyTo field to Card interface"
```

---

### Task 2: Populate replyTo on the 5 hard phishing cards in data/cards.ts

**Files:**
- Modify: `data/cards.ts`

Add `replyTo` to each of the 5 hard phishing cards. The field goes directly after `authStatus` on each card. Exact values:

**p-hard-001** (`ceo@acmecorp-global.com`, verified):
```ts
authStatus: 'verified',
replyTo: 'j.hartwell.ceo@gmail.com',
```

**p-hard-002** (`events@linkedin-notifications.net`, unverified):
```ts
authStatus: 'unverified',
replyTo: 'linkedinsupport.help@outlook.com',
```

**p-hard-003** (`noreply@github.com`, unverified):
```ts
authStatus: 'unverified',
replyTo: 'github-security@protonmail.com',
```

**p-hard-004** (`invoices@delta-tech-supplies.com`, verified):
```ts
authStatus: 'verified',
replyTo: 'd.chen88@hotmail.com',
```

**p-hard-005** (`it-helpdesk@yourdomain-support.com`, unverified):
```ts
authStatus: 'unverified',
replyTo: 'ithelpdesk.admin@gmail.com',
```

To locate each card: search for the `id: 'p-hard-00X'` string, then find the `authStatus:` line within that card object and add `replyTo:` on the line immediately after.

**Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 2: Commit**

```bash
git add data/cards.ts
git commit -m "feat: add mismatched replyTo addresses to hard phishing cards"
```

---

### Task 3: Use card.replyTo in the headers panel

**Files:**
- Modify: `components/GameCard.tsx`

**Context**

The `headers` IIFE inside `EmailDisplay` currently sets `replyTo: card.from` in all three branches (verified, fail, unverified). It needs to use `card.replyTo ?? card.from` instead — so when a card has an explicit Reply-To, the panel shows it; otherwise it falls back to the FROM address. `returnPath` is the envelope sender and is unaffected by Reply-To, so it stays as `card.from`.

**Step 1: Update the verified branch**

Current:
```ts
if (card.authStatus === 'verified') {
  return {
    spf: 'PASS', dkim: 'PASS', dmarc: 'PASS',
    replyTo: card.from, returnPath: `<${card.from}>`,
    color: { spf: '#00aa28', dkim: '#00aa28', dmarc: '#00aa28' },
  };
}
```

Change to:
```ts
if (card.authStatus === 'verified') {
  return {
    spf: 'PASS', dkim: 'PASS', dmarc: 'PASS',
    replyTo: card.replyTo ?? card.from, returnPath: `<${card.from}>`,
    color: { spf: '#00aa28', dkim: '#00aa28', dmarc: '#00aa28' },
  };
}
```

**Step 2: Update the fail branch**

Current:
```ts
if (card.authStatus === 'fail') {
  return {
    spf: 'FAIL', dkim: 'FAIL', dmarc: 'FAIL',
    replyTo: card.from, returnPath: `<${card.from}>`,
    color: { spf: '#ff3333', dkim: '#ff3333', dmarc: '#ff3333' },
  };
}
```

Change to:
```ts
if (card.authStatus === 'fail') {
  return {
    spf: 'FAIL', dkim: 'FAIL', dmarc: 'FAIL',
    replyTo: card.replyTo ?? card.from, returnPath: `<${card.from}>`,
    color: { spf: '#ff3333', dkim: '#ff3333', dmarc: '#ff3333' },
  };
}
```

**Step 3: Update the unverified branch**

Current:
```ts
// unverified
return {
  spf: 'NONE', dkim: 'NONE', dmarc: 'NONE',
  replyTo: card.from, returnPath: `<${card.from}>`,
  color: { spf: '#ffaa00', dkim: '#ffaa00', dmarc: '#ffaa00' },
};
```

Change to:
```ts
// unverified
return {
  spf: 'NONE', dkim: 'NONE', dmarc: 'NONE',
  replyTo: card.replyTo ?? card.from, returnPath: `<${card.from}>`,
  color: { spf: '#ffaa00', dkim: '#ffaa00', dmarc: '#ffaa00' },
};
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. `card.replyTo` is `string | undefined`, and `?? card.from` narrows it to `string`.

**Step 5: Visual check**

```bash
npm run dev
```

Play until a hard phishing card appears. Open `[HEADERS]`. Confirm:
- p-hard-001: Reply-To shows `j.hartwell.ceo@gmail.com` (not `ceo@acmecorp-global.com`)
- p-hard-004: Reply-To shows `d.chen88@hotmail.com` (not `invoices@delta-tech-supplies.com`)
- Legit cards and easy/medium phishing: Reply-To still shows `card.from` (unchanged)

**Step 6: Commit**

```bash
git add components/GameCard.tsx
git commit -m "feat: show mismatched replyTo in headers panel when present"
```
