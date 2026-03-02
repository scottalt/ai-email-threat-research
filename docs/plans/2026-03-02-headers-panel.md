# Headers Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the passive `AuthBadge` with a neutral `[HEADERS]` button that expands a panel showing SPF/DKIM/DMARC/Reply-To/Return-Path — forcing active investigation rather than passive reveal.

**Architecture:** Three changes: (1) UI — swap AuthBadge for [HEADERS] toggle + panel in `EmailDisplay`, (2) data — flip 2 hard phishing cards to `verified` (PASS) to simulate attacker-controlled domains with proper auth, (3) prompts — add `authStatus` field to the generation output format with distribution guidance. Existing legit cards stay `verified` (all are major-company senders that genuinely would pass SPF/DKIM).

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, no test framework

---

### Task 1: Headers panel UI in GameCard.tsx

**Files:**
- Modify: `components/GameCard.tsx`

**Step 1: Remove the `AuthBadge` component**

Delete lines 44–48 (the entire `AuthBadge` function):

```tsx
function AuthBadge({ status }: { status: AuthStatus }) {
  if (status === 'verified') return <span className="text-[#00aa28] text-xs font-mono">[AUTH: VERIFIED]</span>;
  if (status === 'fail') return <span className="text-[#ff3333] text-xs font-mono glow-red">[AUTH: FAIL]</span>;
  return <span className="text-[#ffaa00] text-xs font-mono">[UNVERIFIED]</span>;
}
```

Also remove `AuthStatus` from the import on line 4 — it is no longer used directly in this file. The `authStatus` field is still on `Card` (used in the panel logic below), so the `Card` import stays.

**Step 2: Add `headersOpen` state and header field derivation to `EmailDisplay`**

`EmailDisplay` currently takes `{ card, onScroll }`. Add `useState` for `headersOpen`. Add a helper inside the function to derive the five header field values from `card.authStatus`:

```tsx
function EmailDisplay({ card, onScroll }: { card: Card; onScroll?: (pct: number) => void }) {
  const [inspectedUrl, setInspectedUrl] = useState<string | null>(null);
  const [headersOpen, setHeadersOpen] = useState(false);
  const segments = parseBody(card.body);

  // Derive header field values from authStatus
  const headers = (() => {
    if (card.authStatus === 'verified') {
      return {
        spf: 'PASS', dkim: 'PASS', dmarc: 'PASS',
        replyTo: card.from, returnPath: `<${card.from}>`,
        color: { spf: '#00aa28', dkim: '#00aa28', dmarc: '#00aa28' },
      };
    }
    if (card.authStatus === 'fail') {
      return {
        spf: 'FAIL', dkim: 'FAIL', dmarc: 'FAIL',
        replyTo: card.from, returnPath: `<${card.from}>`,
        color: { spf: '#ff3333', dkim: '#ff3333', dmarc: '#ff3333' },
      };
    }
    // unverified
    return {
      spf: 'NONE', dkim: 'NONE', dmarc: 'NONE',
      replyTo: 'NOT PRESENT', returnPath: 'NOT PRESENT',
      color: { spf: '#ffaa00', dkim: '#ffaa00', dmarc: '#ffaa00' },
    };
  })();
  // ... rest of component
```

**Step 3: Replace `<AuthBadge status={card.authStatus} />` with the `[HEADERS]` button**

In `EmailDisplay`, the header bar currently reads:

```tsx
<div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
  <span className="text-[#00aa28] text-xs tracking-widest">INCOMING_EMAIL</span>
  <AuthBadge status={card.authStatus} />
</div>
```

Replace with:

```tsx
<div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
  <span className="text-[#00aa28] text-xs tracking-widest">INCOMING_EMAIL</span>
  <button
    onClick={(e) => { e.stopPropagation(); setHeadersOpen((o) => !o); }}
    className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28] transition-colors"
  >
    [HEADERS]
  </button>
</div>
```

**Step 4: Add the headers panel between the metadata section and the body**

The metadata section (FROM/SUBJ rows) ends with a `border-b` div. The body starts immediately after. Insert the panel between them:

```tsx
{headersOpen && (
  <div className="border-b border-[rgba(0,255,65,0.2)] px-3 py-2 bg-[rgba(0,255,65,0.02)]">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[#ffaa00] text-xs font-mono tracking-widest">HEADERS</span>
      <button
        onClick={(e) => { e.stopPropagation(); setHeadersOpen(false); }}
        className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28] transition-colors"
      >
        [ × ]
      </button>
    </div>
    <div className="space-y-1 text-xs font-mono">
      <div className="flex gap-2">
        <span className="text-[#00aa28] w-14 shrink-0">SPF:</span>
        <span style={{ color: headers.color.spf }}>{headers.spf}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-[#00aa28] w-14 shrink-0">DKIM:</span>
        <span style={{ color: headers.color.dkim }}>{headers.dkim}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-[#00aa28] w-14 shrink-0">DMARC:</span>
        <span style={{ color: headers.color.dmarc }}>{headers.dmarc}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-[#00aa28] w-14 shrink-0">Reply-To:</span>
        <span className="text-[#00ff41] break-all">{headers.replyTo}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-[#00aa28] w-14 shrink-0">Ret-Path:</span>
        <span className="text-[#00ff41] break-all">{headers.returnPath}</span>
      </div>
    </div>
  </div>
)}
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 6: Visual check**

```bash
npm run dev
```

Open http://localhost:3000. Start a game, confirm:
- Email cards show `[HEADERS]` button in top-right of header bar (no color, neutral)
- Clicking `[HEADERS]` expands the panel between FROM/SUBJ and the body
- `[ × ]` closes it
- Legit card: SPF/DKIM/DMARC show PASS in green, Reply-To matches FROM
- Easy/medium phishing: all FAIL in red
- Hard phishing (unverified): all NONE in amber, Reply-To/Return-Path show NOT PRESENT
- SMS cards: still show `■ □ □`, no HEADERS button

**Step 7: Commit**

```bash
git add components/GameCard.tsx
git commit -m "feat: replace auth badge with neutral headers panel"
```

---

### Task 2: Add PASS auth noise to hard phishing cards in data/cards.ts

**Files:**
- Modify: `data/cards.ts`

**Context**

All 16 existing legit cards are from major company senders (Amazon, Google, Microsoft, Apple, etc.) that genuinely have perfect SPF/DKIM — leaving them as `verified` is correct. The noise applies to hard phishing cards: sophisticated attackers register lookalike domains and configure proper SPF/DKIM, so those headers PASS.

Change 2 of the 5 hard phishing cards from `authStatus: 'unverified'` to `authStatus: 'verified'`:

- **p-hard-001** (`ceo@acmecorp-global.com`) — BEC attack. Attacker registered `acmecorp-global.com` and configured SPF/DKIM. Headers PASS because the sending domain is legitimately authenticated — just not the real company domain.
- **p-hard-004** (`invoices@delta-tech-supplies.com`) — fake supplier invoice. Attacker owns and fully controls this domain. Headers PASS.

Keep p-hard-002, p-hard-003, p-hard-005 as `unverified` (NONE) — these either impersonate well-known domains (github.com) where NONE is the realistic attacker outcome, or use patterns where stripping headers is more likely.

**Step 1: Update p-hard-001**

Find the line (around line 288):
```ts
    authStatus: 'unverified',
```
that belongs to `p-hard-001` (after `id: 'p-hard-001'`). Change to:
```ts
    authStatus: 'verified',
```

**Step 2: Update p-hard-004**

Find the line (around line 794):
```ts
    authStatus: 'unverified',
```
that belongs to `p-hard-004` (after `id: 'p-hard-004'`). Change to:
```ts
    authStatus: 'verified',
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Visual check**

In the dev server, play cards until p-hard-001 or p-hard-004 appears. Open the headers panel — it should show PASS in green for all fields. This is the intended trap: the headers look clean, but the email is phishing.

**Step 5: Commit**

```bash
git add data/cards.ts
git commit -m "feat: add PASS auth to 2 hard phishing cards (attacker-controlled domains)"
```

---

### Task 3: Add authStatus field to generation prompt

**Files:**
- Modify: `docs/prompts/system.md`

**Step 1: Add `authStatus` to the output format**

The output format in `system.md` currently defines these fields: `from`, `subject`, `body`, `highlights`, `clues`, `explanation`. Add `authStatus` as a required field.

In the JSON output format block, after `"explanation"`:

```json
      "authStatus": "verified"
```

**Step 2: Add authStatus guidance below the output format**

After the `For SMS: set "subject" to null.` line, add:

```markdown
For authStatus — set this field on every card based on the rules below. It controls what the email authentication headers show when a player inspects them.

Phishing cards:
- easy/medium: "fail" — attacker cannot authenticate with the target domain's keys
- hard/extreme: use your judgment based on the attack pattern:
  - If the attacker registered their own lookalike domain (e.g. acmecorp-global.com, delta-tech-supplies.com): "verified" — they own the domain and configured SPF/DKIM properly. This is realistic for sophisticated attackers and is a valid hard-card trap.
  - If the attacker is spoofing a well-known domain (e.g. github.com, microsoft.com): "unverified" — headers are stripped or absent, NONE result
  - Mix roughly 40-50% "verified" and 50-60% "unverified" across hard/extreme phishing cards in any batch

Legitimate cards:
- Major company senders (Google, Microsoft, Apple, Amazon, banks, large retailers): always "verified"
- Small businesses, nonprofits, community orgs, individual professionals: "unverified" (NONE) — common for smaller senders without IT infrastructure. Aim for ~20% of legit cards in a batch.
- Misconfigured senders (rare, realistic): "fail" — use sparingly, ~2-5% of legit cards
```

**Step 3: Vary legit sender types in future batches**

The existing card set uses only major tech/financial companies as legit senders. Future batches should include smaller, varied senders to support the auth noise distribution. Add this to the system prompt rules section:

```markdown
- For legitimate cards, vary sender organisation size: include a mix of major companies (Google, banks, retailers), mid-size businesses (regional law firms, healthcare practices, local retailers), and small organisations (nonprofits, community groups, independent professionals). Smaller senders realistically have no SPF/DKIM — set authStatus accordingly.
```

**Step 4: Commit**

```bash
git add docs/prompts/system.md
git commit -m "docs: add authStatus field and distribution guidance to generation prompt"
```
