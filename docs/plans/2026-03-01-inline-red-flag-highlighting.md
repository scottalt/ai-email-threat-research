# Inline Red Flag Highlighting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After a user answers a phishing card, re-display the email/SMS body on the FeedbackCard with exact phishing phrases highlighted in amber.

**Architecture:** Add `highlights?: string[]` to the Card type, author exact substrings on all phishing cards, create a pure `highlightBody()` utility that splits text into plain/highlighted segments, and render those segments in a new MESSAGE_BODY section on FeedbackCard above ANALYST_NOTES.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind v4 (inline styles for dynamic amber highlight color)

---

### Task 1: Add `highlights` to Card type

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add optional field to Card interface**

In `lib/types.ts`, change the `Card` interface from:
```typescript
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
}
```
To:
```typescript
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
}
```

**Step 2: Commit**
```bash
git add lib/types.ts
git commit -m "feat: add highlights field to Card type"
```

---

### Task 2: Create highlightBody utility

**Files:**
- Create: `lib/highlightBody.ts`

**Step 1: Write the utility**

Create `lib/highlightBody.ts`:
```typescript
export interface Segment {
  text: string;
  highlighted: boolean;
}

export function highlightBody(body: string, highlights: string[]): Segment[] {
  if (!highlights.length) return [{ text: body, highlighted: false }];

  // Build a regex that matches any highlight phrase (case-insensitive)
  const escaped = highlights.map((h) =>
    h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = body.split(pattern);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlighted: pattern.test(part),
    }));
}
```

> Note: `RegExp.test()` is stateful with the `g` flag — reset lastIndex after use or use a fresh regex for the `.map()` check. Alternative: check by testing each part against a non-global version.

Corrected version to avoid stateful regex issues:
```typescript
export interface Segment {
  text: string;
  highlighted: boolean;
}

export function highlightBody(body: string, highlights: string[]): Segment[] {
  if (!highlights.length) return [{ text: body, highlighted: false }];

  const escaped = highlights.map((h) =>
    h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const splitPattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const matchPattern = new RegExp(`^(${escaped.join('|')})$`, 'i');

  return body
    .split(splitPattern)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlighted: matchPattern.test(part),
    }));
}
```

**Step 2: Commit**
```bash
git add lib/highlightBody.ts
git commit -m "feat: add highlightBody utility for inline red flag rendering"
```

---

### Task 3: Update FeedbackCard to render highlighted body

**Files:**
- Modify: `components/FeedbackCard.tsx`

**Step 1: Import the utility and types**

Add to the top of `FeedbackCard.tsx`:
```typescript
import { highlightBody } from '@/lib/highlightBody';
```

**Step 2: Add MESSAGE_BODY section**

Insert this block **above** the `{/* Explanation */}` section (before line 92), only rendering when `wasPhishing && card.highlights?.length`:

```tsx
{/* Message body with highlights */}
{wasPhishing && card.highlights && card.highlights.length > 0 && (
  <div className="term-border bg-[#060c06] border-[rgba(255,51,51,0.3)]">
    <div className="border-b border-[rgba(255,51,51,0.3)] px-3 py-1.5">
      <span className="text-[#aa2222] text-xs tracking-widest">MESSAGE_BODY</span>
    </div>
    <pre className="px-3 py-3 text-xs text-[#00aa28] font-mono leading-relaxed whitespace-pre-wrap break-words">
      {highlightBody(card.body, card.highlights).map((seg, i) =>
        seg.highlighted ? (
          <mark
            key={i}
            style={{
              backgroundColor: '#ffaa00',
              color: '#060c06',
              borderRadius: '2px',
              padding: '0 2px',
            }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </pre>
  </div>
)}
```

**Step 3: Commit**
```bash
git add components/FeedbackCard.tsx
git commit -m "feat: render highlighted message body on FeedbackCard"
```

---

### Task 4: Author highlights on all phishing cards + replace real names

**Files:**
- Modify: `data/cards.ts`

This is the bulk data task. Make all changes in one pass, then commit.

#### Name replacements (all 40 cards)

Search for and replace all instances of Scott's real name/details:

| Card | Field | Old | New |
|------|-------|-----|-----|
| `p-med-004` | body | `scott@example.com` | `alex@example.com` |
| `p-hard-002` | subject | `Scott, your talk at SFISSA...` | `Alex, your talk at SFISSA...` |
| `p-hard-002` | body | `Hi Scott,` | `Hi Alex,` |
| `p-hard-002` | body | `sfissa-scott-a` | `sfissa-alex-c` |
| `p-hard-003` | body | `Hey scottalt,` | `Hey jrivera,` |
| `l-easy-001` | body | `Hello Scott,` | `Hello Alex,` |
| `l-easy-003` | body | `scott@example.com` | `alex@example.com` |
| `l-easy-004` | body | `Scott A.` | `Alex C.` |
| `l-easy-004` | body | `scott@example.com` | `alex@example.com` |
| `l-med-001` | body | `Hey scottalt,` | `Hey jrivera,` |
| `l-med-002` | body | `Apple ID: scott@example.com` | `Apple ID: alex@example.com` |
| `l-med-003` | subject | `Scott Altiparmak, please DocuSign...` | `Alex Chen, please DocuSign...` |
| `l-med-003` | body | `Hello Scott Altiparmak,` | `Hello Alex Chen,` |
| `l-med-003` | body | `ISP / S. Altiparmak` | `ISP / A. Chen` |
| `l-med-004` | subject | `Scott, 3 new jobs match...` | `Alex, 3 new jobs match...` |
| `l-med-004` | body | `Hi Scott,` | `Hi Alex,` |
| `l-med-005` | subject | `Scott, you have unread messages...` | `Alex, you have unread messages...` |
| `l-med-005` | body | `Hi Scott,` | `Hi Alex,` |
| `l-hard-005` | body | `Hello Scott Altiparmak,` | `Hello Alex Chen,` |
| `l-hard-006` | subject | `scottaltiparmak.com's SSL certificate` | `alexchen.io's SSL certificate` |
| `l-hard-006` | body | `scottaltiparmak.com` (all instances) | `alexchen.io` |

#### Highlights to add to each phishing card

**p-easy-001:**
```typescript
highlights: [
  'Dear Valued Customer',
  'temporarily suspended',
  'http://paypal-account-restore.net/verify?token=8x2mK9pL',
  'permanent account closure',
],
```

**p-easy-002:**
```typescript
highlights: [
  'CONGRATULATIONS!',
  'amzn-giftwinner.com/claim/GC847291',
  'expires in 2 hours',
],
```

**p-easy-003:**
```typescript
highlights: [
  'verify your banking information',
  'https://irs-gov-refund.com/claim?ref=TX-2025-84721',
  'Failure to claim within 5 days will result in forfeiture of funds',
],
```

**p-easy-004:**
```typescript
highlights: [
  '[Bank]',
  'call us at 1-800-555-0192',
],
```

**p-med-001:**
```typescript
highlights: [
  'expire in 24 hours',
  'https://m365-password-update.microsoft-support-center.net/renew',
],
```

**p-med-002:**
```typescript
highlights: [
  'usps-redelivery.net/update/940011',
  '$0.30 address validation fee required',
],
```

**p-med-003:**
```typescript
highlights: [
  'suspicious charge of $284.99',
  'verify your identity immediately',
  'secure-chasealert.com/verify',
],
```

**p-med-004:**
```typescript
highlights: [
  'violation of our Terms of Service',
  'zoom-security-update.com/restore',
  'restore access within 24 hours',
  'support@zoom-security-update.com',
],
```

**p-hard-001:**
```typescript
highlights: [
  "please don't call",
  'wire transfer of $47,500',
  'can you get this done in the next hour?',
],
```

**p-hard-002:**
```typescript
highlights: [
  'linkedin-notifications.net/slides/sfissa-alex-c',
  'See who viewed your content',
  'The link expires in 48 hours',
],
```

**p-easy-005:**
```typescript
highlights: [
  'Dear Netflix Member',
  'suspended within 24 hours',
  'http://netflix-billing-update.com/payment?id=NF8472910',
],
```

**p-easy-006:**
```typescript
highlights: [
  'goog-account-verify.com/secure',
],
```

**p-med-005:**
```typescript
highlights: [
  'by end of business Friday',
  'https://acmecorp-hr.net/payroll/update',
  'delay in their next paycheck',
],
```

**p-med-006:**
```typescript
highlights: [
  'Hello,',
  'Legal Department',
  'docusign-secure.net/sign/doc?id=AB7291C',
],
```

**p-hard-003:**
```typescript
highlights: [
  'https://github-email-verify.com/verify?token=3k9mXpL2qR8',
],
```

**p-hard-004:**
```typescript
highlights: [
  'Our banking details have recently changed',
  'Please disregard previous banking details',
  'Account Number: 7749302841',
],
```

**p-hard-005:**
```typescript
highlights: [
  'https://yourdomain-support.com/patch/remote-agent.exe',
  'download the remote access tool',
  '1-800-555-0284',
],
```

**Step 2: Verify the app builds**
```bash
npm run build
```
Expected: No TypeScript errors. Build succeeds.

**Step 3: Commit**
```bash
git add data/cards.ts
git commit -m "feat: add highlights to phishing cards, replace real names with placeholders"
```

---

### Task 5: Manual verification

**Step 1: Run dev server**
```bash
npm run dev
```

**Step 2: Play through at least 3 phishing cards in freeplay mode**
- Answer a card
- On FeedbackCard, verify MESSAGE_BODY section appears above ANALYST_NOTES
- Verify amber highlights appear on the exact phrases from the `highlights` array
- Verify legit cards show NO MESSAGE_BODY section

**Step 3: Check edge cases**
- A card where a highlight phrase appears multiple times in the body (should highlight all occurrences)
- An SMS card (no subject line, body-only) — should still highlight correctly

**Step 4: Final commit if any tweaks needed**
```bash
git add -p
git commit -m "fix: [describe any visual tweaks]"
```

---

### Task 6: Push to production

```bash
git push origin master
```

Vercel auto-deploys from master. Verify on production that highlights render correctly on mobile (check that `whitespace-pre-wrap` handles line breaks correctly on small screens).
