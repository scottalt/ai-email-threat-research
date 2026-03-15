# Desktop Layouts: Stats, Profile & Intel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply responsive desktop two-column layouts and color contrast improvements to Stats, Profile, and Intel player pages.

**Architecture:** Each page gets per-page responsive Tailwind classes (lg: breakpoint at 1024px). Color migration replaces `#00aa28` → `#33bb55` and `#003a0e` → `#1a5c2a` across all target files. Intel API fix ensures byBackground rows sum to total answers.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, Supabase

---

## File Map

| File | Changes |
|------|---------|
| `app/stats/page.tsx` | Desktop two-column layout, color contrast, font sizes, early-return state widths |
| `app/profile/page.tsx` | Desktop two-column layout, color contrast, font sizes, stat row grid, early-return state widths |
| `app/intel/player/page.tsx` | Wider container, color contrast, font sizes, bar width, add UNSET label |
| `app/api/intel/route.ts` | Include NULL backgrounds as 'unset', remove threshold filter |
| `app/intel/page.tsx` | Add UNSET to BACKGROUND_LABELS |

---

## Chunk 1: Color + Layout

### Task 1: Stats Page — Color Contrast

**Files:**
- Modify: `app/stats/page.tsx`

- [ ] **Step 1: Replace `text-[#00aa28]` with `text-[#33bb55]`**

In `app/stats/page.tsx`, find-and-replace all occurrences of `text-[#00aa28]` with `text-[#33bb55]`. This covers section headers (OPERATOR_STATS, ACCURACY_BY_DIFFICULTY, etc.), row labels, and the nav link.

Occurrences to change (lines 59, 68, 80, 103, 113, 130, 131, 155, 159, 166, 177, 193, 202, 225, 230, 235, 248, 257):
```
text-[#00aa28] → text-[#33bb55]
```

Also change `hover:text-[#00aa28]` → `hover:text-[#33bb55]` (caught by the same replacement since hover variant contains the substring).

- [ ] **Step 2: Replace `text-[#003a0e]` with `text-[#1a5c2a]`**

Find-and-replace all `text-[#003a0e]` with `text-[#1a5c2a]`. This covers muted labels (ACCURACY, ANALYZED, AVG TIME under hero stats), count labels, calibration note, activity date labels.

Do NOT replace `placeholder:text-[#003a0e]` if any exist (there are none in stats).

- [ ] **Step 3: Replace inline color strings**

Find these inline color references and update:

1. AccuracyBar `color` prop for tool usage (2 occurrences around lines 233, 240):
   ```
   color="#00aa28"  →  color="#33bb55"
   ```

2. Confidence calibration conditional (around line 202):
   ```
   : '#00aa28';  →  : '#33bb55';
   ```

- [ ] **Step 4: Verify build**

```bash
npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add app/stats/page.tsx
git commit -m "style: update color contrast on stats page — secondary and muted green tiers"
```

---

### Task 2: Stats Page — Desktop Layout

**Files:**
- Modify: `app/stats/page.tsx`

- [ ] **Step 1: Update main container width**

Change the main content container (around line 126):
```tsx
// From:
<div className="w-full max-w-sm space-y-4">
// To:
<div className="w-full max-w-sm lg:max-w-4xl space-y-4 lg:space-y-6">
```

- [ ] **Step 2: Update early-return state containers**

Update all early-return `max-w-sm` containers to include `lg:max-w-4xl`. There are 5 early-return blocks (loading at ~line 58, not signed in at ~line 67, locked at ~line 78, error at ~line 90, empty at ~line 101, second loading at ~line 112):

```tsx
// From:
<div className="w-full max-w-sm term-border ...
// To:
<div className="w-full max-w-sm lg:max-w-md term-border ...
```

Note: Early-return states use `lg:max-w-md` (not `4xl`) since they're short messages that look odd stretched too wide.

- [ ] **Step 3: Add desktop font sizes to section headers and rows**

For all section header `<span>` elements with `text-sm tracking-widest`, add `lg:text-base`:
```tsx
// From:
<span className="text-[#33bb55] text-sm tracking-widest">OPERATOR_STATS</span>
// To:
<span className="text-[#33bb55] text-sm lg:text-base tracking-widest">OPERATOR_STATS</span>
```

Apply to: OPERATOR_STATS, ACCURACY_BY_DIFFICULTY, CONFIDENCE_CALIBRATION, TOOL_USAGE, BY_GAME_MODE, ACTIVITY_14D headers.

For row labels (`text-sm font-mono tracking-wider`), add `lg:text-base`:
```tsx
// From:
<span className="text-[#33bb55] text-sm font-mono tracking-wider">{d.toUpperCase()}</span>
// To:
<span className="text-[#33bb55] text-sm lg:text-base font-mono tracking-wider">{d.toUpperCase()}</span>
```

Apply to all row labels in: byDifficulty, byConfidence, tool usage, byMode sections.

- [ ] **Step 4: Wrap middle sections in two-column grid**

Reorder the JSX so the four middle sections are wrapped in a two-column grid. The current order is: byDifficulty, byConfidence, toolUsage, byMode. Reorder to:

```tsx
{/* Two-column layout on desktop */}
<div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
  {/* Left column */}
  <div className="space-y-4">
    {/* BY_GAME_MODE section — move here from below */}
    {/* TOOL_USAGE section — move here from below */}
  </div>
  {/* Right column */}
  <div className="space-y-4">
    {/* ACCURACY_BY_DIFFICULTY section — stays */}
    {/* CONFIDENCE_CALIBRATION section — stays */}
  </div>
</div>
```

On mobile, `lg:grid` doesn't apply so the sections stack in the wrapper div's `space-y-4`. The order on mobile will be: game mode, tool usage, difficulty, confidence — which is fine.

- [ ] **Step 5: Increase activity heatmap height on desktop**

```tsx
// From:
<div className="flex gap-1 items-end h-12">
// To:
<div className="flex gap-1 items-end h-12 lg:h-16">
```

- [ ] **Step 6: Verify build**

```bash
npx next build
```
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/stats/page.tsx
git commit -m "feat: responsive desktop two-column layout for stats page"
```

---

### Task 3: Profile Page — Color Contrast

**Files:**
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: Replace `text-[#00aa28]` with `text-[#33bb55]`**

Find-and-replace all `text-[#00aa28]` with `text-[#33bb55]` in `app/profile/page.tsx`. Covers: OPERATOR_PROFILE header, nav link, CALLSIGN label, BACKGROUND label, all stat row labels, RANK_PROGRESSION header, rank level labels, ACHIEVEMENTS header, edit/cancel buttons.

Also catches `hover:text-[#00aa28]` → `hover:text-[#33bb55]`.

- [ ] **Step 2: Replace `text-[#003a0e]` with `text-[#1a5c2a]`**

Find-and-replace all `text-[#003a0e]` with `text-[#1a5c2a]`. Covers: category labels, locked achievement text/colors.

Do NOT replace `placeholder:text-[#003a0e]` (line ~224 in callsign input).

- [ ] **Step 3: Replace inline color strings**

Update inline `color:` style references:
```tsx
// Locked achievement color (around line 353):
const color = unlocked ? RARITY_COLORS[a.rarity] : '#003a0e';
// Change to:
const color = unlocked ? RARITY_COLORS[a.rarity] : '#1a5c2a';

// Locked achievement description (around line 365):
style={{ color: unlocked ? '#00aa28' : '#003a0e' }}
// Change to:
style={{ color: unlocked ? '#33bb55' : '#1a5c2a' }}
```

- [ ] **Step 4: Verify build**

```bash
npx next build
```

- [ ] **Step 5: Commit**

```bash
git add app/profile/page.tsx
git commit -m "style: update color contrast on profile page — secondary and muted green tiers"
```

---

### Task 4: Profile Page — Desktop Layout

**Files:**
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: Update main container width**

```tsx
// From (around line 182):
<div className="w-full max-w-sm space-y-4">
// To:
<div className="w-full max-w-sm lg:max-w-4xl space-y-4 lg:space-y-6">
```

- [ ] **Step 2: Update early-return state containers**

Update the not-authenticated early-return (around line 107):
```tsx
// From:
<div className="w-full max-w-sm space-y-4">
// To:
<div className="w-full max-w-sm lg:max-w-md space-y-4">
```

- [ ] **Step 3: Reorganize stat rows into desktop grid**

Replace the `bottomRows.map()` block (around lines 288-299) with a responsive grid:

```tsx
{/* Stat rows — grid on desktop, stacked on mobile */}
<div className="divide-y divide-[rgba(0,255,65,0.08)] lg:divide-y-0 lg:grid lg:grid-cols-4 lg:gap-px lg:bg-[rgba(0,255,65,0.08)]">
  {bottomRows.map(({ label, value }) => (
    <div key={label} className="flex items-center justify-between lg:flex-col lg:items-center lg:text-center px-3 py-2 lg:py-3 bg-[#060c06]">
      <span className="text-[#33bb55] text-sm lg:text-xs font-mono tracking-wider">{label}</span>
      <span className={`text-sm font-mono font-bold ${
        label === 'GRADUATION' && profile.researchGraduated
          ? 'text-[#ffaa00]'
          : 'text-[#00ff41]'
      }`}>
        {value}
      </span>
    </div>
  ))}
</div>
```

On mobile: `divide-y` stacks vertically as before. On desktop: `lg:grid-cols-4` shows 2 rows of 4 stat cells with `gap-px` creating thin divider lines using the background color trick.

- [ ] **Step 4: Wrap rank ladder and achievements in two-column grid**

After the profile card closing `</div>`, wrap the rank ladder and achievements sections:

```tsx
{/* Two-column on desktop: rank ladder + achievements */}
<div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
  {/* Rank ladder */}
  <div className="term-border bg-[#060c06]">
    {/* ... existing rank ladder content ... */}
  </div>

  {/* Achievements */}
  <div className="term-border bg-[#060c06]">
    {/* ... existing achievements content ... */}
  </div>
</div>
```

On mobile: `space-y-4` stacks them. On desktop: side-by-side.

- [ ] **Step 5: Add desktop font sizes**

Add `lg:text-base` to:
- Section headers: RANK_PROGRESSION, ACHIEVEMENTS
- Rank labels and level ranges
- Achievement names

Add `lg:py-2.5` to rank ladder rows.

- [ ] **Step 6: Verify build**

```bash
npx next build
```

- [ ] **Step 7: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: responsive desktop two-column layout for profile page"
```

---

## Chunk 2: Intel + Verification

### Task 5: Intel API — byBackground Fix

**Files:**
- Modify: `app/api/intel/route.ts`
- Modify: `app/intel/player/page.tsx`
- Modify: `app/intel/page.tsx`

- [ ] **Step 1: Include NULL backgrounds in API**

In `app/api/intel/route.ts`, around line 159-160, change:
```tsx
// From:
const bg = player?.background ?? null;
if (!bg) continue;
if (!bgMap[bg]) bgMap[bg] = { total: 0, correct: 0 };
// To:
const bg = player?.background ?? 'unset';
if (!bgMap[bg]) bgMap[bg] = { total: 0, correct: 0 };
```

- [ ] **Step 2: Remove the threshold filter**

Around line 165-166, change:
```tsx
// From:
const byBackground = Object.entries(bgMap)
  .filter(([, v]) => v.total >= 5)
// To:
const byBackground = Object.entries(bgMap)
```

- [ ] **Step 3: Add UNSET label to player intel page**

In `app/intel/player/page.tsx`, around line 49-54, add to BACKGROUND_LABELS:
```tsx
const BACKGROUND_LABELS: Record<string, string> = {
  infosec: 'INFOSEC',
  technical: 'TECHNICAL',
  other: 'NON-TECHNICAL',
  prefer_not_to_say: 'UNDISCLOSED',
  unset: 'UNSET',
};
```

- [ ] **Step 4: Add UNSET label to admin intel page**

In `app/intel/page.tsx`, find the same BACKGROUND_LABELS map and add `unset: 'UNSET'`.

- [ ] **Step 5: Verify build**

```bash
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add app/api/intel/route.ts app/intel/player/page.tsx app/intel/page.tsx
git commit -m "fix: include all backgrounds in intel breakdown so totals match"
```

---

### Task 6: Intel Player Page — Color Contrast + Desktop Layout

**Files:**
- Modify: `app/intel/player/page.tsx`

- [ ] **Step 1: Replace `text-[#00aa28]` with `text-[#33bb55]`**

Find-and-replace all `text-[#00aa28]` in `app/intel/player/page.tsx`. Covers: SectionHeader component, BarRow labels, locked state text, loading text, nav links.

Also catches `hover:text-[#00aa28]` → `hover:text-[#33bb55]`.

- [ ] **Step 2: Replace `text-[#003a0e]` with `text-[#1a5c2a]`**

Find-and-replace all `text-[#003a0e]`. Covers: StatBlock labels/subs, BarRow sub text, locked state muted text, bar background.

Also update inline references:
```tsx
// BarRow bar background (around line 41):
<div className="w-24 h-1 bg-[#003a0e] shrink-0">
// Change to:
<div className="w-24 lg:w-40 h-1 bg-[#1a5c2a] shrink-0">
```

Note: this also applies the wider bar width (`lg:w-40`) from the spec.

- [ ] **Step 3: Update container width for IntelContent**

In the `IntelContent` component (around line 113):
```tsx
// From:
<div className="w-full max-w-2xl space-y-4 mt-8">
// To:
<div className="w-full max-w-2xl lg:max-w-3xl space-y-4 mt-8">
```

- [ ] **Step 4: Add desktop font sizes**

Add `lg:text-base` to SectionHeader title span and BarRow labels.

For StatBlock, add `lg:text-base` to the label:
```tsx
<div className="text-[#1a5c2a] text-sm lg:text-base font-mono tracking-widest">{label}</div>
```

- [ ] **Step 5: Verify build**

```bash
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add app/intel/player/page.tsx
git commit -m "style: color contrast and responsive desktop layout for intel player page"
```

---

### Task 7: Final Verification + Push

- [ ] **Step 1: Full build verification**

```bash
npx next build
```

- [ ] **Step 2: Review full diff**

```bash
git diff master...HEAD --stat
```

Verify only the expected files were modified.

- [ ] **Step 3: Push and update PR**

```bash
git push
```

The branch `ui/desktop-readability` already has PR #43 open. The new commits will be added to it.
