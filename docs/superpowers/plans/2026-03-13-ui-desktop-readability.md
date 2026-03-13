# UI Desktop Layout, Boot Transition & Readability — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Threat Terminal homepage with a boot→profile transition, responsive two-column desktop layout, and better readability through improved colors and spacing.

**Architecture:** All changes are confined to `components/StartScreen.tsx` and `app/globals.css`. The StartScreen component gets new state for the boot transition, responsive Tailwind classes for the two-column desktop layout at `lg:` breakpoint, and updated color hex values. Mobile layout is unchanged.

**Tech Stack:** React, Tailwind CSS v4, Next.js 16

**Spec:** `docs/superpowers/specs/2026-03-13-ui-desktop-readability-design.md`

---

## Chunk 1: Boot Transition & Color Updates

### Task 1: Update color values in globals.css

**Files:**
- Modify: `app/globals.css:7` — update `--phosphor-muted`

- [ ] **Step 1: Update the CSS variable**

In `app/globals.css`, change line 7:

```css
/* Old */
--phosphor-muted: #003a0e;

/* New */
--phosphor-muted: #1a5c2a;
```

- [ ] **Step 2: Verify the app still builds**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: update phosphor-muted CSS variable for better contrast"
```

---

### Task 2: Update color values in StartScreen.tsx

**Files:**
- Modify: `components/StartScreen.tsx` — find-and-replace colors

This task updates the two color tiers across StartScreen only. No other files.

- [ ] **Step 1: Replace secondary green (#00aa28 → #33bb55)**

In `components/StartScreen.tsx`, use your editor's find-and-replace to change all instances. Only replace `text-[#00aa28]` and `hover:text-[#00aa28]` patterns — do NOT change `border-[...]`, `bg-[...]`, or `rgba(...)` values containing these colors.

- `text-[#00aa28]` → `text-[#33bb55]`
- `hover:text-[#00aa28]` → `hover:text-[#33bb55]`

**Reference table** (approximate line numbers for context, use find-replace not line targeting):

| Line | Context | Old | New |
|------|---------|-----|-----|
| 155 | ANALYST_TERMINAL label | `text-[#00aa28]` | `text-[#33bb55]` |
| 164 | ■ □ □ dots | `text-[#00aa28]` | `text-[#33bb55]` |
| 172 | Boot line (non-bright) | `text-[#00aa28]` | `text-[#33bb55]` |
| 192 | SET_CALLSIGN label | `text-[#00aa28]` | `text-[#33bb55]` |
| 193 | SIGN OUT hover | `hover:text-[#00aa28]` | `hover:text-[#33bb55]` |
| 216 | BACKGROUND label | `text-[#00aa28]` | `text-[#33bb55]` |
| 217 | Background description | `text-[#00aa28]` | `text-[#33bb55]` |
| 227 | Background option unselected | `text-[#00aa28]` | `text-[#33bb55]` |
| 242 | SIGN OUT hover (profile) | `hover:text-[#00aa28]` | `hover:text-[#33bb55]` |
| 251 | Achievements link | `text-[#00aa28]` | `text-[#33bb55]` |
| 274 | HOW_TO_PLAY label | `text-[#00aa28]` | `text-[#33bb55]` |
| 289 | Instruction text | `text-[#00aa28]` | `text-[#33bb55]` |
| 334 | Signal guide body | `text-[#00aa28]` | `text-[#33bb55]` |
| 356 | PLAY button text | `text-[#00aa28]` | `text-[#33bb55]` |
| 407 | MY STATS link | `text-[#00aa28]` | `text-[#33bb55]` |
| 413 | INTEL link | `text-[#00aa28]` | `text-[#33bb55]` |
| 442 | XP tab inactive hover | `hover:text-[#00aa28]` | `hover:text-[#33bb55]` |
| 451 | DAILY tab inactive hover | `hover:text-[#00aa28]` | `hover:text-[#33bb55]` |
| 463 | Leaderboard names (XP) | `text-[#00aa28]` | `text-[#33bb55]` |
| 480 | Leaderboard names (daily) | `text-[#00aa28]` | `text-[#33bb55]` |

- [ ] **Step 2: Replace muted green (#003a0e → #1a5c2a)**

In `components/StartScreen.tsx`, use find-and-replace for `text-[#003a0e]` → `text-[#1a5c2a]`. Only change `text-[...]` patterns — do NOT change `placeholder:text-[#003a0e]` (line 205), `bg-[#003a0e]`, or `border-[rgba(...)]` values.

**Reference table** (approximate line numbers for context):

| Line | Context | Old | New |
|------|---------|-----|-----|
| 160 | SFX OFF button | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 193 | SIGN OUT button | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 196 | Callsign instructions | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 242 | SIGN OUT button (profile) | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 362 | Sign-in prompt | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 387-389 | Daily locked text | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 421 | Stats+Intel locked | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 428 | Footer text | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 442 | XP tab inactive | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 448 | Pipe separator | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 451 | DAILY tab inactive | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 462 | Leaderboard rank number | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 479 | Daily LB rank (non-first) | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 490 | No scores message | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 493 | No players message | `text-[#003a0e]` | `text-[#1a5c2a]` |
| 499 | Show more button | `text-[#003a0e]` | `text-[#1a5c2a]` |

**Do NOT change:** `placeholder:text-[#003a0e]` (line 205), `bg-[#003a0e]` in LevelMeter, or any `border-[rgba(...)]` values. Only change `text-[#003a0e]`.

- [ ] **Step 3: Verify the app builds and colors render**

Run: `npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "style: improve color contrast — secondary and muted green tiers"
```

---

### Task 3: Boot animation fade-out transition

**Files:**
- Modify: `components/StartScreen.tsx:44-95` — add bootDone/bootHidden state and transition logic

- [ ] **Step 1: Add new state variables**

In `components/StartScreen.tsx`, after line 46 (`const [showButton, setShowButton] = useState(false);`), add:

```typescript
const [bootDone, setBootDone] = useState(false);
const [bootHidden, setBootHidden] = useState(false);
```

- [ ] **Step 2: Update the existing showButton effect to also trigger bootDone, with fallback**

Replace the existing effect (lines 90-95):

```typescript
// OLD
useEffect(() => {
  if (visibleCount === BOOT_LINES.length) {
    const t = setTimeout(() => setShowButton(true), 300);
    return () => clearTimeout(t);
  }
}, [visibleCount]);
```

With:

```typescript
// NEW — sets bootDone + showButton, with fallback timeout for bootHidden
useEffect(() => {
  if (visibleCount === BOOT_LINES.length) {
    const t = setTimeout(() => {
      setBootDone(true);
      setShowButton(true);
    }, 300);
    return () => clearTimeout(t);
  }
}, [visibleCount]);

// Fallback: if onTransitionEnd doesn't fire (e.g. browser skip), hide boot after 600ms
useEffect(() => {
  if (bootDone && !bootHidden) {
    const fallback = setTimeout(() => setBootHidden(true), 600);
    return () => clearTimeout(fallback);
  }
}, [bootDone, bootHidden]);
```

- [ ] **Step 3: Update the boot terminal div to fade out**

Replace the boot terminal div (lines 153-182). Change the outer wrapper from:

```tsx
<div className="term-border bg-[#060c06]">
```

To:

```tsx
{!bootHidden && (
<div
  className={`term-border bg-[#060c06] transition-opacity duration-300 ${bootDone ? 'opacity-0' : 'opacity-100'}`}
  onTransitionEnd={() => { if (bootDone) setBootHidden(true); }}
>
```

And add the closing `)}` after the closing `</div>` of the boot terminal (after line 182).

The full boot terminal block becomes:

```tsx
{!bootHidden && (
  <div
    className={`term-border bg-[#060c06] transition-opacity duration-300 ${bootDone ? 'opacity-0' : 'opacity-100'}`}
    onTransitionEnd={() => { if (bootDone) setBootHidden(true); }}
  >
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
      <span className="text-[#33bb55] text-sm tracking-widest">ANALYST_TERMINAL</span>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          className={`text-sm font-mono transition-colors p-2 -m-2 ${soundEnabled ? 'text-[#00ff41]' : 'text-[#1a5c2a]'}`}
        >
          {soundEnabled ? '[SFX]' : '[SFX OFF]'}
        </button>
        <span className="text-[#33bb55] text-sm">■ □ □</span>
      </div>
    </div>
    <div className="px-3 py-4 min-h-48 space-y-1 overflow-hidden">
      {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
        <div
          key={i}
          className={`anim-fade-in text-sm font-mono leading-relaxed ${
            line.bright ? 'text-[#00ff41]' : 'text-[#33bb55]'
          }`}
        >
          {line.text}
        </div>
      ))}
      {!showButton && visibleCount < BOOT_LINES.length && (
        <span className="cursor" />
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify boot transition works**

Run: `npm run dev`
Manual check:
1. Page loads → boot lines appear sequentially
2. After "SYSTEM READY." → 300ms pause → boot terminal fades out over 300ms
3. Profile card and content fade in
4. Boot terminal is removed from DOM after fade completes (check DevTools Elements)

- [ ] **Step 5: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "feat: boot animation fades out after loading, transitions to profile"
```

---

## Chunk 2: Desktop Two-Column Layout

### Task 4: Responsive container and profile header

**Files:**
- Modify: `components/StartScreen.tsx:150-151` — outer container
- Modify: `components/StartScreen.tsx:186-270` — profile section

- [ ] **Step 1: Update the outer container**

Change line 151 from:

```tsx
<div className="w-full max-w-sm px-4 pb-safe flex flex-col gap-6">
```

To:

```tsx
<div className="w-full max-w-sm lg:max-w-4xl px-4 pb-safe flex flex-col gap-6 lg:gap-8">
```

- [ ] **Step 2: Update the profile header for desktop horizontal layout**

The signed-in profile card (lines 238-257) currently renders as a bordered box. On desktop, make it horizontal.

Replace:

```tsx
) : signedIn && profile ? (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
      <Link href="/profile" className="text-[#00ff41] text-sm tracking-widest font-bold hover:text-[#00ff41] border border-[rgba(0,255,65,0.3)] px-2 py-0.5 hover:bg-[rgba(0,255,65,0.06)] transition-colors">[ {profile.displayName} ]</Link>
      <button onClick={async () => { await signOut(); setShowAuthFlow(false); }} className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55]">SIGN OUT</button>
    </div>
    <div className="px-3 py-2 space-y-2">
      <LevelMeter xp={profile.xp} level={profile.level} />
      <div className="flex items-center justify-between">
        {profile.researchGraduated && (
          <div className="text-[#ffaa00] text-sm font-mono">⬡ RESEARCH GRADUATED</div>
        )}
        {(profile.achievements?.length ?? 0) > 0 && (
          <Link href="/profile#achievements" className="text-[#33bb55] text-sm font-mono hover:text-[#00ff41]">
            ★ {profile.achievements?.length ?? 0}/20
          </Link>
        )}
      </div>
    </div>
  </div>
```

With:

```tsx
) : signedIn && profile ? (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="text-[#00ff41] text-sm tracking-widest font-bold hover:text-[#00ff41] border border-[rgba(0,255,65,0.3)] px-2 py-0.5 hover:bg-[rgba(0,255,65,0.06)] transition-colors">[ {profile.displayName} ]</Link>
        {profile.researchGraduated && (
          <span className="text-[#ffaa00] text-sm font-mono hidden lg:inline">⬡ GRADUATED</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {(profile.achievements?.length ?? 0) > 0 && (
          <Link href="/profile#achievements" className="text-[#33bb55] text-sm font-mono hover:text-[#00ff41] hidden lg:inline">
            ★ {profile.achievements?.length ?? 0}/20
          </Link>
        )}
        <button onClick={async () => { await signOut(); setShowAuthFlow(false); }} className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55]">SIGN OUT</button>
      </div>
    </div>
    <div className="px-3 py-2 space-y-2">
      <LevelMeter xp={profile.xp} level={profile.level} />
      {/* Mobile-only: show graduation + achievements below XP bar */}
      <div className="flex items-center justify-between lg:hidden">
        {profile.researchGraduated && (
          <div className="text-[#ffaa00] text-sm font-mono">⬡ RESEARCH GRADUATED</div>
        )}
        {(profile.achievements?.length ?? 0) > 0 && (
          <Link href="/profile#achievements" className="text-[#33bb55] text-sm font-mono hover:text-[#00ff41]">
            ★ {profile.achievements?.length ?? 0}/20
          </Link>
        )}
      </div>
    </div>
  </div>
```

**What changed:** On desktop (`lg:`), graduation badge and achievements count move into the header bar next to the callsign. On mobile, they stay below the XP bar as before.

- [ ] **Step 3: Verify profile header renders correctly**

Run: `npm run dev`
Manual check:
- Mobile: profile card looks identical to before
- Desktop (>1024px): callsign + graduation badge in header row, XP bar below

- [ ] **Step 4: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "feat: responsive container and desktop profile header layout"
```

---

### Task 5: Two-column layout — sidebar + main

**Files:**
- Modify: `components/StartScreen.tsx:184-508` — wrap content sections in sidebar/main divs

This is the main layout restructure. The `{showButton && (...)}` block needs to be reorganized into two columns on desktop.

- [ ] **Step 1: Restructure the showButton content into two-column layout**

The current structure inside `{showButton && (...)}` is:
1. Profile card
2. HOW_TO_PLAY
3. Signal guide
4. Play/Research button
5. Daily challenge button
6. Expert mode button
7. Stats/Intel links
8. Footer text
9. Leaderboard

The new structure wraps items 2-3 in a sidebar div, and items 4-9 in a main div, with the profile card (item 1) above both.

Replace the opening of the `showButton` block (line 184-185):

```tsx
{showButton && (
  <div className="anim-fade-in-up space-y-4">
```

With:

```tsx
{showButton && (
  <div className="anim-fade-in-up space-y-4 lg:space-y-6">
```

Then, after the profile card section (after line 270 — the `{!playerLoading && (...)}` closing), add a wrapper div that creates the two-column layout:

```tsx
    {/* Two-column layout wrapper: sidebar + main on desktop */}
    <div className="flex flex-col lg:flex-row lg:gap-0">
      {/* Sidebar: reference content (desktop only shows side-by-side) */}
      <div className="contents lg:block lg:w-80 lg:shrink-0 lg:border-r lg:border-[rgba(0,255,65,0.15)] lg:pr-6">
```

Move the HOW_TO_PLAY section and SIGNAL GUIDE section inside this sidebar div.

After the signal guide, close the sidebar and open the main column:

```tsx
      </div>
      {/* Main column: actions + leaderboard */}
      <div className="contents lg:block lg:flex-1 lg:pl-6 lg:space-y-4">
```

Move the remaining sections (play button, daily challenge, expert mode, stats/intel, footer text, leaderboard) inside this main div.

Close the main div and the wrapper:

```tsx
      </div>
    </div>
```

**Key CSS trick:** `contents` on mobile means the sidebar and main divs don't create new layout contexts — their children flow naturally into the parent's `space-y-4` flex column. On desktop (`lg:`), `block` kicks in and they become real layout containers side by side.

- [ ] **Step 2: Add desktop font size and spacing improvements to sidebar**

In the HOW_TO_PLAY section, update the instruction text:

Change:
```tsx
<div key={tag} className="flex gap-3 text-sm">
```
To:
```tsx
<div key={tag} className="flex gap-3 text-sm lg:text-base">
```

Change the instruction description:
```tsx
<span className="text-[#33bb55]">{desc}</span>
```
To:
```tsx
<span className="text-[#33bb55] lg:leading-relaxed">{desc}</span>
```

In the Signal Guide body text:
```tsx
<p className="text-[#33bb55] text-sm font-mono leading-relaxed">{body}</p>
```
To:
```tsx
<p className="text-[#33bb55] text-sm lg:text-base font-mono leading-relaxed">{body}</p>
```

- [ ] **Step 3: Add desktop font size improvements to main column**

Update leaderboard rows for XP tab:
```tsx
<div key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm font-mono anim-fade-in-up"
```
To:
```tsx
<div key={i} className="flex items-center gap-2 px-3 py-1.5 lg:py-2.5 text-sm lg:text-base font-mono anim-fade-in-up"
```

Update leaderboard rows for Daily tab:
```tsx
<div key={i} className="flex items-center gap-3 px-3 py-1.5 anim-fade-in-up"
```
To:
```tsx
<div key={i} className="flex items-center gap-3 px-3 py-1.5 lg:py-2.5 anim-fade-in-up"
```

Update Daily Challenge button padding:
```tsx
className="w-full py-4 term-border-bright text-[#00ff41]
```
To:
```tsx
className="w-full py-4 lg:py-5 term-border-bright text-[#00ff41]
```

- [ ] **Step 4: Restructure Expert/Stats/Intel into a 3-column grid on desktop**

Currently Expert Mode is its own button, and Stats + Intel are in a `grid-cols-2`. On desktop, combine all three into one row.

Replace the Expert Mode button and Stats/Intel section (lines 393-426) with:

```tsx
{/* Expert + Stats + Intel — 3-col on desktop */}
{signedIn && profile?.researchGraduated ? (
  <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-3">
    <button
      onClick={() => handleStart('expert')}
      className="w-full py-4 term-border border-[rgba(255,170,0,0.4)] text-center text-[#ffaa00] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,170,0,0.05)]"
    >
      [ EXPERT MODE ]
    </button>
    <Link
      href="/stats"
      className="block w-full py-3 lg:py-4 term-border text-center text-[#33bb55] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] transition-all"
    >
      [ MY STATS ]
    </Link>
    <Link
      href="/intel/player"
      className="block w-full py-3 lg:py-4 term-border text-center text-[#33bb55] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] transition-all"
    >
      [ INTEL ]
    </Link>
  </div>
) : (
  <Link
    href="/intel/player"
    className="block w-full py-3 term-border border-[rgba(0,255,65,0.15)] text-center font-mono text-sm tracking-widest text-[#1a5c2a] select-none hover:bg-[rgba(0,255,65,0.02)] transition-all"
  >
    [ STATS + INTEL — LOCKED ]
    <span className="block text-xs mt-1 tracking-wide">Complete research to unlock</span>
  </Link>
)}
```

On mobile: `space-y-3` stacks them vertically (Expert, Stats, Intel).
On desktop: `lg:grid-cols-3` puts them side by side.

- [ ] **Step 5: Verify two-column layout**

Run: `npm run dev`
Manual checks:
- **Mobile (<1024px):** Layout identical to before (single column, all sections stacked)
- **Desktop (≥1024px):**
  - Profile header spans full width
  - HOW_TO_PLAY + Signal Guide in left sidebar (~320px)
  - Action buttons + leaderboard in right main column
  - Expert/Stats/Intel in a 3-column row
  - No horizontal scrollbar
- **At 1024px exactly:** Layout switches cleanly, no overlap

- [ ] **Step 6: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "feat: two-column desktop layout with sidebar and responsive grid"
```

---

### Task 6: Run E2E tests to verify nothing broke

**Files:**
- None modified — verification only

- [ ] **Step 1: Run the full E2E test suite**

Run: `npx playwright test`
Expected: All 12 tests pass. The tests use role-based selectors (`getByRole('button', { name: /play/i })`) and API response assertions, not pixel/text checks, so layout changes should not affect them.

- [ ] **Step 2: If any tests fail, investigate**

The most likely cause of failure would be if `contents` CSS class causes the button to not be found by Playwright. If so, switch from `contents` to just using `flex flex-col` on mobile (which is the current behavior anyway).

- [ ] **Step 3: Commit any test fixes if needed**

```bash
git add -A
git commit -m "fix: adjust layout classes for E2E test compatibility"
```

---

### Task 7: Final cleanup and push

- [ ] **Step 1: Review the full diff**

Run: `git diff master --stat`
Verify only these files changed:
- `app/globals.css` (1 line: CSS variable)
- `components/StartScreen.tsx` (color updates, boot transition, desktop layout)

- [ ] **Step 2: Push the branch**

```bash
git push -u origin ui/desktop-readability
```

- [ ] **Step 3: Wait for E2E CI to pass, then create PR**

```bash
gh pr create --title "UI: desktop two-column layout, boot transition, readability" --body "$(cat <<'EOF'
## Summary
- Boot animation now fades out after loading, transitioning to the profile header
- Desktop (≥1024px) gets a two-column layout: reference sidebar + action/leaderboard main
- Improved color contrast: three-tier green hierarchy for better readability
- Larger fonts and spacing on desktop
- Mobile layout unchanged

## Spec
docs/superpowers/specs/2026-03-13-ui-desktop-readability-design.md

## Test plan
- [ ] E2E tests pass (CI)
- [ ] Manual: mobile layout unchanged
- [ ] Manual: desktop shows two-column layout
- [ ] Manual: boot animation fades to profile
- [ ] Manual: colors more readable (muted green visible, secondary green warmer)
- [ ] Manual: 1024px breakpoint transitions cleanly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
