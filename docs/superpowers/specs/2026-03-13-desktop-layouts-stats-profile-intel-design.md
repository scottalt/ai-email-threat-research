# Desktop Layouts: Stats, Profile & Intel Pages

## Goal

Apply responsive desktop layouts and color contrast improvements to the Stats, Profile, and Intel player pages — matching the pattern established in StartScreen. Mobile layout remains unchanged on all pages.

## Scope

- **In scope:** Stats page, Profile page, Intel player page, Intel API route (byBackground threshold)
- **Out of scope:** Admin intel page, game components (GameCard, FeedbackCard, RoundSummary), StartScreen (already done), methodology page

## Design

### Color Contrast (all three pages)

Same migration as StartScreen, applied to stats, profile, and intel player pages:

| Find | Replace | Notes |
|------|---------|-------|
| `text-[#00aa28]` | `text-[#33bb55]` | All occurrences in target files |
| `text-[#003a0e]` | `text-[#1a5c2a]` | All except `placeholder:text-[#003a0e]` |
| `hover:text-[#00aa28]` | `hover:text-[#33bb55]` | Caught by first replacement |
| `border-[rgba(0,255,65,0.35)]` | No change | Borders stay as-is |

Also update the AccuracyBar color in stats (`color="#00aa28"` → `color="#33bb55"`) and any inline `color:` styles referencing `#00aa28` or `#003a0e` — including conditional expressions like `'#00aa28'` in the confidence calibration logic on the stats page (line ~202). These are easy to miss with class-only find-and-replace.

### 1. Stats Page (`app/stats/page.tsx`)

**Container:** `max-w-sm` → `max-w-sm lg:max-w-4xl`

**Layout structure at lg+:**

```
┌──────────── OPERATOR_STATS header (full width) ──────┐
│  [ ACCURACY ] [ ANALYZED ] [ AVG TIME ]  grid-cols-3 │
├──────────────────────────────────────────────────────┤
│  [ THREATS CAUGHT ] [ LEGIT CLEARED ]    grid-cols-2 │
├───── lg:left column ─┬──── lg:right column ──────────┤
│  BY_GAME_MODE        │  ACCURACY_BY_DIFFICULTY       │
│  TOOL_USAGE          │  CONFIDENCE_CALIBRATION       │
├──────────────────────┴───────────────────────────────┤
│  ACTIVITY_14D  (full width)                          │
│  [ BACK TO TERMINAL ]                                │
└──────────────────────────────────────────────────────┘
```

**Full-width sections (above two-column):**
- Header with core stats (accuracy, analyzed, avg time) — already `grid-cols-3`, stays the same
- Detection split (threats caught, legit cleared) — already `grid-cols-2`, stays the same

**Two-column section:**
- Wrapper: `lg:grid lg:grid-cols-2 lg:gap-4`
- Left column: BY_GAME_MODE, TOOL_USAGE
- Right column: ACCURACY_BY_DIFFICULTY, CONFIDENCE_CALIBRATION
- On mobile: all sections stack vertically as today (use `contents` trick or just reorder the JSX)

**Full-width sections (below two-column):**
- Activity heatmap — benefits from the wider space
- Back to terminal button

**Desktop readability:**
- Section labels: `lg:text-base`
- Row labels and values: `lg:text-base`
- Row padding: `py-2.5 lg:py-3`
- Activity heatmap height: `h-12 lg:h-16`

**Early-return states** (loading, not authenticated, locked, error, empty): Update their containers from `max-w-sm` to `max-w-sm lg:max-w-4xl` so they don't look narrow on a wide desktop. Content stays centered within the wider container.

**Mobile (<1024px):** Identical to current — `max-w-sm`, all sections stacked.

### 2. Profile Page (`app/profile/page.tsx`)

**Container:** `max-w-sm` → `max-w-sm lg:max-w-4xl`

**Layout structure at lg+:**

```
┌──────────── OPERATOR_PROFILE header (full width) ────┐
│  CALLSIGN: SCOUT_7 [EDIT]  BACKGROUND: INFOSEC [EDIT]│
│──────────────────────────────────────────────────────│
│  LEVEL │ XP │ STREAK │ LONGEST │ SESSIONS │ BEST    │
│──────────────────────────────────────────────────────│
│  ████████████████░░░░ 4,280 / 5,000 XP              │
├───── lg:left column ─┬──── lg:right column ──────────┤
│  RANK_PROGRESSION    │  ACHIEVEMENTS  12/20          │
│  (10-row ladder)     │  (categorized grid)           │
│                      │  grid-cols-2 within column    │
├──────────────────────┴───────────────────────────────┤
│  [⚙] DEV_OVERRIDE  (admin only, full width)         │
└──────────────────────────────────────────────────────┘
```

**Full-width header section:**
- Profile card stays full-width with callsign/background editing
- Stat rows reorganize on desktop: instead of stacked key-value pairs, use a horizontal `lg:grid lg:grid-cols-4` layout for the 8 stat values (LEVEL, XP, STREAK, LONGEST, SESSIONS, RESEARCH SESSIONS, GRADUATION, PERSONAL BEST) — 2 rows of 4 on desktop, stacked on mobile
- LevelMeter stays full-width below stats

**Two-column section:**
- Wrapper: `lg:grid lg:grid-cols-2 lg:gap-4`
- Left column: RANK_PROGRESSION ladder
- Right column: ACHIEVEMENTS grid (keeps `grid-cols-2` within the column)

**Full-width footer:**
- Admin override panel (if admin) — full width below both columns

**Desktop readability:**
- Stat labels: `lg:text-base`
- Rank labels: `lg:text-base`
- Achievement names/descriptions: `lg:text-base`
- Row padding: `lg:py-2.5`

**Early-return states** (loading, not authenticated): Update containers from `max-w-sm` to `max-w-sm lg:max-w-4xl` for desktop consistency.

**Mobile (<1024px):** Identical to current.

### 3. Intel Player Page (`app/intel/player/page.tsx`)

**Container:** `max-w-2xl` → `max-w-2xl lg:max-w-3xl`

This page has less content, so a modest width increase is sufficient. The single-column layout works well for its data.

**Changes:**
- Container width increase
- Hero stats `grid-cols-3` — already good, no change
- Accuracy bar width: `w-24` → `w-24 lg:w-40` for wider bars on desktop
- Row padding: `lg:py-2.5`
- Font sizes: section headers and labels `lg:text-base`

**Locked state:** Same color updates, keeps `max-w-2xl` (it's just a progress bar + CTA).

**Mobile (<1024px):** Identical to current.

### 4. Intel API: byBackground Fix

**File:** `app/api/intel/route.ts`

Two issues:

**Issue 1 — threshold too high:** Line 166 filters out backgrounds with `total < 5`, hiding `prefer_not_to_say` and small groups. The sum of displayed groups doesn't match total answers.

**Fix:** Lower threshold to `total >= 1` — show all groups with any data. The `n=X` label already communicates sample size.

**Issue 2 — NULL backgrounds excluded:** Line 160 (`if (!bg) continue`) silently drops answers from players who never set a background. These answers are counted in the hero "ANSWERS" stat but missing from the breakdown.

**Fix:** Change `if (!bg) continue` to `const bgKey = bg ?? 'unset'` and use `bgKey` as the map key. This ensures every answer appears in exactly one background group and the row totals sum to the hero total.

**Frontend label:** Add `unset: 'UNSET'` to the `BACKGROUND_LABELS` map in `app/intel/player/page.tsx` (and `app/intel/page.tsx` if it has the same map).

## Files to Modify

- `app/stats/page.tsx` — desktop layout, color contrast, font sizes
- `app/profile/page.tsx` — desktop layout, color contrast, font sizes
- `app/intel/player/page.tsx` — wider container, color contrast, font sizes
- `app/api/intel/route.ts` — include NULL backgrounds as 'unset', remove threshold filter
- `app/intel/page.tsx` — add 'UNSET' to BACKGROUND_LABELS map

## Testing

- Build must pass (`npx next build`)
- Manual verification at desktop (1024px+) and mobile (<1024px)
- Check breakpoint boundary (1024px) for smooth transition
- Verify intel page shows all background categories including UNDISCLOSED when data exists
- E2E tests should pass (role-based selectors, not pixel checks)

## Non-Goals

- No changes to StartScreen (already done in previous PR)
- No changes to game components (GameCard, FeedbackCard, RoundSummary)
- No new pages or routing changes
- No navigation changes (that's a separate batch)
- No mobile layout changes
