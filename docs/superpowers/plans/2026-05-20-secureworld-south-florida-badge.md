# SecureWorld South Florida Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a code-redeemable `THREAT_BRIEF_ATTENDEE` badge granted by entering the `SOFL2026` promo code, with custom SIGINT success and already-redeemed dialogue specific to this badge.

**Architecture:** Five surgical changes. Four touch source files in this branch: one adds two SIGINT dialogue entries, one adds the badge to the registry, one extends an API response with a field, one branches a React component's dialogue selection on that field. The fifth is a single SQL `INSERT` run against the Supabase dev (and later prod) project via the dashboard SQL editor. No new tables, no schema migrations, no new dependencies.

**Tech Stack:** TypeScript 5.9, Next.js 16 App Router, React 19, Supabase Postgres (with RLS + service-role admin client), Upstash Redis (rate limiting). Tests: Playwright e2e (existing, untouched). Type checks via `next build`. Lint via `eslint`.

**Spec:** [docs/superpowers/specs/2026-05-20-secureworld-south-florida-badge-design.md](../specs/2026-05-20-secureworld-south-florida-badge-design.md) (commit `f2d84aa`).

---

## File Structure

This plan modifies four existing files and inserts one DB row. No files are created.

| File | Change | Responsibility |
|---|---|---|
| `lib/sigint-personality.ts` | Modify | Add `briefing_success` and `briefing_already` to the `PROMO_DIALOGUES` object. Existing `code_success` / `code_already` untouched. |
| `lib/achievements.ts` | Modify | Add `threat_brief_attendee` entry to `ACHIEVEMENTS` under the event-exclusive section. Update the section comment. |
| `app/api/promo/redeem/route.ts` | Modify | Include `badgeId` in both `ALREADY_REDEEMED` response sites so the client can route to a badge-specific dialogue. |
| `app/(game)/inventory/page.tsx` | Modify | In the `CodesTab` component, branch the dialogue selection on `data.badgeId` for both the success and `ALREADY_REDEEMED` branches. |
| `promo_codes` table (Supabase) | Insert row | Seed `SOFL2026 → threat_brief_attendee` with `max_uses = 1000000`, `expires_at = NULL`. Run via Supabase dashboard, not committed. |

## Testing Approach

This project uses Playwright e2e tests (in `e2e/`) and does not have a unit test framework. The inventory/promo flow is currently not covered by e2e tests, and adding one would require setting up Supabase test fixtures (auth + seeded promo code) which is out of scope for this small feature.

**Verification gates per task:** TypeScript compilation (`npx tsc --noEmit`) plus ESLint (`npm run lint`).

**End-to-end verification:** Manual smoke test against the four cases in the spec's verification section (Task 6). Done in local dev against the Supabase dev project.

A future plan can add Playwright coverage for the promo redeem flow as broader test infrastructure work. Explicitly out of scope here.

---

## Task 1: Add SIGINT dialogues for the new badge

**Files:**
- Modify: `lib/sigint-personality.ts` (the `PROMO_DIALOGUES` const, currently at lines 647-691)

- [ ] **Step 1: Read the current `PROMO_DIALOGUES` block**

Verify the current shape of `PROMO_DIALOGUES`. The existing entries (`code_success`, `code_invalid`, `code_expired`, `code_exhausted`, `code_already`) should stay exactly as-is. The two new entries go between `code_exhausted` and `code_already`, alphabetical order is not required (existing entries aren't alphabetical either).

Read: `lib/sigint-personality.ts:647-691`

- [ ] **Step 2: Add the two new dialogue entries**

In `lib/sigint-personality.ts`, inside the `PROMO_DIALOGUES` object, insert these two entries immediately after the `code_already` entry's closing `} as SigintDialogue,` and before the closing `}` of `PROMO_DIALOGUES`:

```ts
  briefing_success: {
    lines: [
      "Code accepted. Briefing logged.",
      "South Florida sector. Industry channel.",
      "You sat through one of these in person. I'm impressed. Or concerned. Depends on the speaker.",
      "Wear it in PvP. Other operatives will know you do this on purpose.",
    ],
    buttonText: "AGREED",
  } as SigintDialogue,

  briefing_already: {
    lines: [
      "You already redeemed this one. I keep the receipts.",
      "You only sat in the briefing once. Same code, same rule.",
      "Check your badges. The clipboard is already on your shelf.",
    ],
    buttonText: "FAIR",
  } as SigintDialogue,
```

Voice rules being followed (per the file's top-of-file comment): short sentences, dry humor, no em dashes, doesn't teach detection techniques.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors. The two new keys are typed `SigintDialogue` and `PROMO_DIALOGUES` is an object literal (not an indexed type), so adding properties is type-safe.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: exit code 0. No new warnings.

- [ ] **Step 5: Commit**

```bash
git add lib/sigint-personality.ts
git commit -m "feat(sigint): add briefing_success/briefing_already dialogues"
```

---

## Task 2: Add the badge to the achievement registry

**Files:**
- Modify: `lib/achievements.ts` (the `ACHIEVEMENTS` array, specifically lines 92-94 covering the event-exclusive section)

- [ ] **Step 1: Read the current event-exclusive section**

Read: `lib/achievements.ts:87-95`

Expected contents (paraphrased. The literal file should be read for the exact form):
- Line 87 (approx): `// ── Admin Exclusive (manually granted only) ──`
- Lines 88-91: `architect`, `buffer_overflow`, `beta_tester`, `handler_approved` entries
- Line 93 (approx): `// ── Event Exclusive (manually granted only) ──`
- Line 94: `briefed_by_architect` entry

- [ ] **Step 2: Rename the section comment**

The comment "manually granted only" becomes inaccurate when this code-redeemable badge is added. Change:

```ts
  // ── Event Exclusive (manually granted only) ──
```

to:

```ts
  // ── Event Exclusive ──
```

- [ ] **Step 3: Add the new badge entry**

Add this entry immediately after the existing `briefed_by_architect` line:

```ts
  { id: 'threat_brief_attendee', name: 'THREAT_BRIEF_ATTENDEE', description: "Attended a field briefing in the South Florida sector, 2026. Some signals only travel through conference rooms.", category: 'season', rarity: 'mythic', icon: '📋' },
```

Match the formatting of the surrounding entries: single line, double-quote the description so the apostrophe-free text reads cleanly. (The `briefed_by_architect` entry uses double quotes for the same reason.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0. The new entry must satisfy the `AchievementDef` interface defined at the top of the file. All required fields are present (`id`, `name`, `description`, `category`, `rarity`, `icon`).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add lib/achievements.ts
git commit -m "feat(achievements): add THREAT_BRIEF_ATTENDEE event badge"
```

---

## Task 3: Include `badgeId` in `ALREADY_REDEEMED` API responses

**Files:**
- Modify: `app/api/promo/redeem/route.ts` (lines 78 and 99, both `ALREADY_REDEEMED` return statements)

There are two `ALREADY_REDEEMED` return sites: one when `existing` is found in the `promo_redemptions` lookup (the normal "you already redeemed this" path), and one when the redemption insert itself fails (the race-condition path where the unique constraint catches a double-redeem). Both need `badgeId`.

- [ ] **Step 1: Read the existing return sites**

Read: `app/api/promo/redeem/route.ts:77-100`

Expected: line 78 returns `{ error: 'ALREADY_REDEEMED', message: 'You already redeemed this code.' }`, line 99 does the same. `promo.badge_id` is already in scope at both sites (loaded from the `promo_codes` SELECT at line 48).

- [ ] **Step 2: Update line 78**

Replace:

```ts
    return NextResponse.json({ error: 'ALREADY_REDEEMED', message: 'You already redeemed this code.' }, { status: 409 });
```

with:

```ts
    return NextResponse.json({ error: 'ALREADY_REDEEMED', message: 'You already redeemed this code.', badgeId: promo.badge_id }, { status: 409 });
```

- [ ] **Step 3: Update line 99**

Replace:

```ts
    return NextResponse.json({ error: 'ALREADY_REDEEMED', message: 'You already redeemed this code.' }, { status: 409 });
```

with:

```ts
    return NextResponse.json({ error: 'ALREADY_REDEEMED', message: 'You already redeemed this code.', badgeId: promo.badge_id }, { status: 409 });
```

(The lines are identical text; using `replace_all: true` in the Edit tool is also acceptable since both should change to the same form.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0. `promo.badge_id` is `string` per the table schema and is already accessed elsewhere in the file (line 104) without explicit typing, so no new type concerns.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add app/api/promo/redeem/route.ts
git commit -m "feat(promo): return badgeId in ALREADY_REDEEMED response"
```

---

## Task 4: Branch dialogue selection on `badgeId` in `CodesTab`

**Files:**
- Modify: `app/(game)/inventory/page.tsx` (the `CodesTab` function component, specifically the `handleRedeem` async function at lines 394-431)

- [ ] **Step 1: Read the current `handleRedeem` function**

Read: `app/(game)/inventory/page.tsx:394-431`

Expected: a `try { const res = await fetch(...) ; const data = await res.json(); if (res.ok) { ... } else if (data.error === 'ALREADY_REDEEMED') { ... } ...` block. The success branch currently sets `PROMO_DIALOGUES.code_success` unconditionally; the `ALREADY_REDEEMED` branch sets `PROMO_DIALOGUES.code_already` unconditionally.

- [ ] **Step 2: Update the success branch**

Replace:

```tsx
      if (res.ok) {
        setUnlockedBadgeId(data.badgeId);
        setResultDialogue(PROMO_DIALOGUES.code_success);
        refreshProfile();
        setCode('');
      } else if (data.error === 'ALREADY_REDEEMED') {
        setResultDialogue(PROMO_DIALOGUES.code_already);
      }
```

with:

```tsx
      if (res.ok) {
        setUnlockedBadgeId(data.badgeId);
        setResultDialogue(
          data.badgeId === 'threat_brief_attendee'
            ? PROMO_DIALOGUES.briefing_success
            : PROMO_DIALOGUES.code_success,
        );
        refreshProfile();
        setCode('');
      } else if (data.error === 'ALREADY_REDEEMED') {
        setResultDialogue(
          data.badgeId === 'threat_brief_attendee'
            ? PROMO_DIALOGUES.briefing_already
            : PROMO_DIALOGUES.code_already,
        );
      }
```

The `EXHAUSTED`, `EXPIRED`, `429`, and generic-invalid branches stay untouched.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0. `data.badgeId` is `any` (the API response isn't typed at the client), so the string comparison is valid. `PROMO_DIALOGUES.briefing_success` and `briefing_already` exist now (added in Task 1) and resolve as `SigintDialogue`, matching the `setResultDialogue` setter's parameter type.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(game)/inventory/page.tsx"
git commit -m "feat(inventory): badge-specific SIGINT dialogue for THREAT_BRIEF_ATTENDEE"
```

---

## Task 5: Seed the promo code in Supabase (dev project)

This step happens outside the source repo. The existing convention (see the comment at the bottom of `supabase/migrations/20260327000000_create-promo-codes.sql`) is that promo code seeds are run via the Supabase dashboard SQL editor and not committed, because the code string is effectively a secret.

**Run against:** Supabase dev project first. After successful smoke test in Task 6, repeat against the Supabase prod project as part of release.

- [ ] **Step 1: Open the Supabase SQL editor for the dev project**

Sign in to https://supabase.com/dashboard, switch to the dev project, open **SQL Editor**.

- [ ] **Step 2: Run the INSERT**

```sql
INSERT INTO promo_codes (code, badge_id, max_uses, expires_at, active)
VALUES ('SOFL2026', 'threat_brief_attendee', 1000000, NULL, true);
```

Expected: 1 row inserted. If a unique-constraint violation appears on `code`, the row already exists. Verify with a SELECT and skip to Step 3.

- [ ] **Step 3: Verify the row**

```sql
SELECT code, badge_id, max_uses, current_uses, expires_at, active
FROM promo_codes
WHERE code = 'SOFL2026';
```

Expected: one row, `current_uses = 0`, `active = true`, `expires_at = NULL`, `max_uses = 1000000`, `badge_id = 'threat_brief_attendee'`.

---

## Task 6: End-to-end manual verification

This task covers the four verification cases enumerated in the spec. Run all four against the local Next.js dev server pointing at the Supabase dev project (which has the seed from Task 5).

**Files:** None modified. This is a verification task.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`, no startup errors. Confirm the `.env.local` (or equivalent) is pointing at the Supabase dev project so the seed from Task 5 is reachable.

- [ ] **Step 2: Verification case 1, cold redeem (success path)**

1. Sign in as a test player who has *not* redeemed `SOFL2026`. If you don't have one, create a new account or use an existing dev account that hasn't touched promo codes.
2. Navigate to `http://localhost:3000/inventory` and click the **CODES** tab.
3. Enter `sofl2026` (lowercase, to confirm the existing `.toUpperCase()` normalization at line 24 of the redeem route still works).
4. Click **[ REDEEM ]**.

Expected:
- HTTP 200 from `/api/promo/redeem`.
- The SIGINT `Handler` overlay shows the four `briefing_success` lines, with button text `AGREED`.
- Below the redeem form, the unlocked badge showcase shows the 📋 icon, name `THREAT_BRIEF_ATTENDEE`, and the flavor text from the spec, with the gold mythic glow (`badge-mythic` CSS class).
- Switching to the **BADGES** tab shows the new badge as earned, with the gold glow and `MYTHIC` label.

- [ ] **Step 3: Verification case 2, re-redeem (already redeemed path)**

Same logged-in player. Without refreshing or signing out:

1. Re-enter `SOFL2026` in the redeem form.
2. Click **[ REDEEM ]**.

Expected:
- HTTP 409 from `/api/promo/redeem`, response body includes `badgeId: 'threat_brief_attendee'`.
- The SIGINT `Handler` overlay shows the three `briefing_already` lines, button text `FAIR`.
- Critically: **not** the THOUGHT_LEADER-themed `code_already` text ("Trying to double-dip? I see you.").

- [ ] **Step 4: Verification case 3, regression: THOUGHT_LEADER untouched**

This requires a THOUGHT_LEADER promo code value to exist in the dev DB and a test player who has not redeemed it. Skip if you don't have that combination handy. Task 4's branch is a strict equality check, so any non-matching `badgeId` falls through to the unchanged code path, but verifying with a real second code is worth the few seconds.

If you have one:
1. Sign in as a player who has not redeemed the THOUGHT_LEADER code.
2. Enter that code at `/inventory/codes`.
3. Click **[ REDEEM ]**.

Expected: SIGINT shows the existing four-line `code_success` text mentioning "Thought Leader" and "humblebrags". This proves the new branch did not regress the old path.

- [ ] **Step 5: Verification case 4, registry sanity**

Open the BADGES tab while signed in as a graduated player (research-complete, so locked-badge descriptions are visible). Filter by rarity `MYTHIC`.

Expected: the new `THREAT_BRIEF_ATTENDEE` badge is visible in the grid. If the player has the badge, the icon (📋), name, and description match what was added in Task 2. If the player does not have it, it appears as locked (🔒 icon, "???" description) but is still in the list under the mythic filter.

- [ ] **Step 6: Commit-free verification close-out**

This task produces no commits. If all four cases pass, the feature is verified end-to-end against the dev DB.

If any case fails, stop and diagnose. The most likely failure modes:
- Case 1 fails to show `briefing_success`: confirm Task 1 committed and the file was reloaded by the dev server (Next.js hot reload usually handles this; if not, restart `npm run dev`).
- Case 2 falls through to `code_already`: confirm Task 3's edit landed on *both* return sites (line 78 *and* line 99).
- Case 4 doesn't show the new badge: confirm Task 2's entry is inside the `ACHIEVEMENTS` array (not after the closing `]`).

---

## Task 7: Seed the promo code in Supabase (prod project)

Once Task 6 passes against dev, mirror the seed to prod. This is a separate task because prod data changes should happen deliberately, not as part of dev iteration.

**Run against:** Supabase prod project.

- [ ] **Step 1: Confirm dev verification fully passed**

All four sub-steps of Task 6 must pass before doing this. If anything is yellow, do not proceed.

- [ ] **Step 2: Open the Supabase SQL editor for the prod project**

Sign in to https://supabase.com/dashboard, switch to the **prod** project (not dev). Open SQL Editor. Double-check the project name in the dashboard header before running anything.

- [ ] **Step 3: Run the INSERT against prod**

```sql
INSERT INTO promo_codes (code, badge_id, max_uses, expires_at, active)
VALUES ('SOFL2026', 'threat_brief_attendee', 1000000, NULL, true);
```

Expected: 1 row inserted.

- [ ] **Step 4: Verify the row in prod**

```sql
SELECT code, badge_id, max_uses, current_uses, expires_at, active
FROM promo_codes
WHERE code = 'SOFL2026';
```

Expected: same as Task 5 step 3, but in prod.

---

## Out of Scope (deferred follow-ups)

The following are explicitly NOT part of this plan. Each is captured here so they're not lost, but each would be its own future plan if revisited.

- **Playwright e2e coverage for promo redeem flow.** Would require seeding a known test promo code, a graduated test user, and asserting on the SIGINT overlay text. Substantial test-infra work; defer until the next promo code lands or this flow breaks.
- **Generic per-badge dialogue lookup table.** Right now each new promo badge needs a branch in `CodesTab`. The third event badge can either branch the same way or motivate a proper `Record<string, { success, already }>` lookup. YAGNI for now.
- **Nullable `max_uses` migration for true unlimited.** The 1M ceiling achieves the same user-visible behavior. A migration would touch the table, the route's exhaustion check, and the `increment_promo_uses` RPC.
- **Refactor of the existing THOUGHT_LEADER dialogue.** Per user direction, left untouched. The hardcoded THOUGHT_LEADER text in `code_success` / `code_already` continues to be the fallback for any code without its own dedicated dialogue.

---

## Versioning note

Per project versioning rules (see user memory `feedback_versioning.md`), any merge to `master` requires a semver bump. This feature is additive (no behavior change for existing users; new content and new code path that branches on a new badge ID). When this work merges to `master`, it's a **patch** bump (e.g., `2.1.2 → 2.1.3`) unless it lands as part of a larger v3.0 release, in which case the v3.0 version controls.
