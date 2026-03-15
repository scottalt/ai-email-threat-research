# Social Sharing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a share button to the round summary that lets players share their results via native share sheet or clipboard.

**Architecture:** Single-file change to `components/RoundSummary.tsx`. A pure `buildShareText()` function constructs the share message, and a `handleShare()` handler invokes `navigator.share` or falls back to clipboard. No new files, routes, or API endpoints.

**Tech Stack:** React, Web Share API, Clipboard API

**Spec:** `docs/superpowers/specs/2026-03-15-social-sharing-design.md`

---

## Task 1: Add `buildShareText()` function

**Files:**
- Modify: `components/RoundSummary.tsx` (add function above the component, after `CONFIDENCE_LABEL`)

- [ ] **Step 1: Add the `buildShareText` function**

Add this after the `CONFIDENCE_LABEL` constant (line 32) and before the `RoundSummary` component:

```ts
const SHARE_URL = 'https://threatterminal.ai/?ref=share';

function buildShareText(opts: {
  label: string;
  score: number;
  total: number;
  totalScore: number;
  mode: GameMode;
}): { text: string; url: string } {
  let headline = `🎣 ${opts.label} · ${opts.score}/${opts.total} · ${opts.totalScore.toLocaleString()} pts`;

  if (opts.mode === 'daily') {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    headline += ` · ${dateStr} Daily`;
  } else if (opts.mode === 'expert') {
    headline += ' · Expert';
  }

  const text = `${headline}\nCan you spot the phish? Most people can't.`;
  return { text, url: SHARE_URL };
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx next build 2>&1 | head -20` (or `npm run build`)
Expected: No type errors related to `buildShareText`

- [ ] **Step 3: Commit**

```bash
git add components/RoundSummary.tsx
git commit -m "feat: add buildShareText function for social sharing"
```

---

## Task 2: Add share button UI and handler

**Files:**
- Modify: `components/RoundSummary.tsx` (add state + handler + button JSX)

- [ ] **Step 1: Add state for clipboard feedback**

Inside the `RoundSummary` component, add after the existing state declarations (around line 57):

```ts
const [copied, setCopied] = useState(false);
```

- [ ] **Step 2: Add the `handleShare` function**

Add inside the component, after the `xpEarned` calculation (after line 70):

```ts
async function handleShare() {
  const label = rank ? rank.label : tier.label;
  const { text, url } = buildShareText({ label, score, total, totalScore, mode });

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'Threat Terminal', text, url });
    } catch {
      // User dismissed share sheet or error — silently ignore
    }
  } else {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed — silently ignore
    }
  }
}
```

- [ ] **Step 3: Add the share button JSX**

Place this between the weakness tracker section (research mode `</div>`) and the sign-in prompt (`{!signedIn && (`). That's after line 257 (the closing `</div>` of `COGNITIVE_BLIND_SPOTS`) and before line 259 (`{!signedIn && (`):

```tsx
{/* Share results */}
<button
  onClick={handleShare}
  className="w-full py-4 term-border text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] active:scale-95 transition-all"
>
  {copied ? '[ COPIED ✓ ]' : '[ SHARE RESULTS ]'}
</button>
```

- [ ] **Step 4: Verify build compiles**

Run: `npx next build 2>&1 | head -20`
Expected: Clean build, no errors

- [ ] **Step 5: Commit**

```bash
git add components/RoundSummary.tsx
git commit -m "feat: add share results button to round summary"
```

---

## Task 3: Manual testing

- [ ] **Step 1: Test clipboard fallback (desktop)**

1. Run `npm run dev`
2. Play a freeplay round to completion
3. Click `[ SHARE RESULTS ]`
4. Verify button text changes to `[ COPIED ✓ ]` for 2 seconds
5. Paste clipboard contents — should match expected format:
   ```
   🎣 CLICK_HAPPY · 7/10 · 1,200 pts
   Can you spot the phish? Most people can't.
   https://threatterminal.ai/?ref=share
   ```

- [ ] **Step 2: Test daily mode tag**

1. Play a daily challenge round
2. Share and verify the date tag appears: `· Mar 15 Daily`

- [ ] **Step 3: Test guest vs signed-in label**

1. Share as guest → should show tier label (e.g., `SHARP_ANALYST`)
2. Sign in, share → should show rank label (e.g., `CLICK_HAPPY`)

- [ ] **Step 4: Test on mobile (if available)**

1. Open on phone or use DevTools mobile emulation
2. Click share → native share sheet should appear
3. Dismiss share sheet → no errors, button stays as `[ SHARE RESULTS ]`

- [ ] **Step 5: Final commit with version bump**

Update `package.json` version to next minor, add changelog entry, commit:

```bash
git add -A
git commit -m "feat: social sharing from round summary"
```
