# UI Improvements: Desktop Layout, Boot Transition & Readability

## Goal

Improve the Threat Terminal homepage for desktop users by transitioning the boot animation into a loading screen, adding a responsive two-column layout, and improving readability through better font sizing, spacing, and color hierarchy — all while preserving the existing terminal/hacker theme and keeping mobile layout unchanged.

## Scope

- **In scope:** StartScreen component, globals.css, responsive breakpoints
- **Out of scope:** Game flow (GameCard, FeedbackCard, etc.), API routes, other pages (stats, intel, profile), mobile layout changes

## Design

### 1. Boot Animation → Loading Screen

**Current behavior:** The boot terminal (8 lines at 220ms intervals) renders permanently at the top of StartScreen. After boot completes, all other content fades in below it.

**New behavior:**
1. Boot animation plays exactly as today (~1.8s total)
2. After "SYSTEM READY." appears, pause 300ms
3. Boot terminal fades out (300ms CSS opacity transition)
4. Profile header fades in where the boot terminal was
5. Rest of content animates in below (same `anim-fade-in-up` as today)

**Implementation approach:**
- Add a `bootDone` state (boolean) to StartScreen, initially `false`
- Add a `bootHidden` state (boolean), initially `false`
- When all boot lines have rendered + 300ms delay: set `bootDone=true`
- When `bootDone=true`: boot terminal div gets `opacity-0 transition-opacity duration-300`
- Attach `onTransitionEnd={() => setBootHidden(true)}` to the boot terminal div
- When `bootHidden=true`: stop rendering boot terminal entirely (`{!bootHidden && <div>...</div>}`)
- Profile header renders with `anim-fade-in` when `bootDone=true`

**Mobile + desktop:** Same behavior on all screen sizes.

### 2. Desktop Two-Column Layout

**Breakpoint:** `lg:` (1024px+). Below 1024px, layout is identical to current single-column.

**Container change:**
- Current: `max-w-sm` (640px) at all sizes
- New: `max-w-sm lg:max-w-4xl` — expands to 896px on desktop
- Outer wrapper: `lg:flex lg:gap-0` with sidebar `lg:w-80` (320px) + main `lg:flex-1` (~576px)
- `max-w-4xl` chosen because 320px sidebar + 576px main = 896px fits comfortably

**Layout structure at lg+:**

```
┌─────────────── Profile Header (full width) ──────────────┐
│ [ CALLSIGN ]  RANK_TITLE    ████░░ XP/NEXT XP    ⬡      │
├───── lg:w-80 ┬───────────── lg:flex-1 ───────────────────┤
│ HOW_TO_PLAY  │  [ PLAY ] or [ RESEARCH MODE ]             │
│ (expanded)   │  [ DAILY CHALLENGE — DATE ]                 │
│              │  [ EXPERT ]  [ STATS ]  [ INTEL ]           │
│ SIGNAL GUIDE │                                             │
│ (collapsed)  │  LEADERBOARD (XP | DAILY tabs)              │
│              │                                             │
└──────────────┴────────────────────────────────────────────┘
```

**Sidebar (lg:w-80, ~320px):**
- Contains HOW_TO_PLAY (always expanded on desktop) and SIGNAL GUIDE (collapsed by default)
- Right border: `lg:border-r lg:border-[rgba(0,255,65,0.15)]`
- Sticky positioning not needed — content fits viewport height

**Main column (lg:flex-1):**
- Action buttons stacked vertically
- EXPERT, STATS, INTEL in a `lg:grid-cols-3` row (instead of current separate button + 2-col grid)
- Footer text + leaderboard below

**Mobile (<1024px):** No changes. Current single-column, `max-w-sm`, all sections stacked with `gap-6`.

**Profile header (full width on desktop):**
- Horizontal layout: callsign left, XP bar + rank + graduation badge right
- `lg:flex lg:items-center lg:justify-between`
- On mobile: same card layout as today (stacked inside bordered box)

**User state variants on desktop:**

All user states use the same two-column structure. Only the profile header area changes:

| State | Profile Header Shows | Main Column |
|-------|---------------------|-------------|
| Signed in + has callsign | Callsign, XP bar, rank, badges | All action buttons |
| Signed in + no callsign | SET_CALLSIGN form (full-width, spans both columns) | Hidden until callsign set |
| Not signed in | "SIGN IN TO SAVE YOUR SCORE" button (full-width) | PLAY button + sign-in prompt |
| `playerLoading=true` | Empty/skeleton (same height as profile header to prevent layout shift) | Content hidden until loaded |
| Research-capped (30/30) | Normal profile header | PLAY button (not RESEARCH), "RESEARCH COMPLETE" message |

**Callsign setup special case:** When the user is signed in but hasn't set a callsign, the SET_CALLSIGN form renders full-width in the header area (spanning both columns). The two-column layout and action buttons appear only after the callsign is set. This matches current behavior where the callsign form is the primary focus.

### 3. Readability Improvements

#### Font sizes (desktop only, mobile unchanged)

| Element | Current | Desktop (lg:) |
|---------|---------|---------------|
| Body text, instructions | `text-sm` (14px) | `lg:text-base` (16px) |
| Section headers | `text-sm` | `lg:text-base` |
| Leaderboard rows | `text-sm` | `lg:text-base` |
| Boot terminal lines | `text-sm` | `text-sm` (unchanged — intentionally dense) |
| Action buttons | `text-sm` | `text-sm` (unchanged — tracking-widest handles readability) |

#### Line spacing (desktop only)

| Element | Current | Desktop (lg:) |
|---------|---------|---------------|
| HOW_TO_PLAY instructions | `leading-relaxed` | `lg:leading-loose` |
| Leaderboard rows | `py-1.5` | `lg:py-2.5` |
| Section gaps | `gap-6` (24px) | `lg:gap-8` (32px) |

#### Color hierarchy (all screen sizes)

Three-tier system replacing the current two-shade green:

| Role | Current | New | Usage |
|------|---------|-----|-------|
| Primary | `#00ff41` | `#00ff41` (no change) | Active actions, bright separators, selected states |
| Secondary | `#00aa28` | `#33bb55` | Body text, instructions, labels, leaderboard names |
| Muted | `#003a0e` | `#1a5c2a` | Footer text, locked items, disabled states |
| Accent | `#ffaa00` | `#ffaa00` (no change) | Expert mode, warnings, signal guide, graduation badge |

**Rationale:** The current muted green (`#003a0e`) is nearly invisible on the `#0a0a0a` background. The secondary green (`#00aa28`) is fine for labels but slightly dull for body text that needs to be read. The new values maintain the green terminal aesthetic but improve contrast ratios.

**Color migration strategy:** All existing `text-[#00aa28]` → `text-[#33bb55]` and `text-[#003a0e]` → `text-[#1a5c2a]` as a global find-and-replace within `StartScreen.tsx` only. Other components (GameCard, FeedbackCard, etc.) are out of scope and keep current colors. The CSS variable `--phosphor-muted` in globals.css should also be updated from `#003a0e` to `#1a5c2a`.

#### Button hierarchy (desktop)

- DAILY CHALLENGE: slightly more padding (`lg:py-5`) — primary CTA for graduated users
- PLAY/RESEARCH: current padding — secondary CTA
- EXPERT, STATS, INTEL: smaller in the 3-col row — tertiary actions

## Files to Modify

- `components/StartScreen.tsx` — boot transition logic, responsive layout classes, color updates
- `app/globals.css` — update `--phosphor-muted` CSS variable value

## Testing

- E2E tests should continue to pass — they use role-based selectors and API assertions, not pixel checks
- Manual verification on mobile (should be identical to current) and desktop (new layout)
- Check at breakpoint boundary (1024px) for smooth transition between layouts

## Non-Goals

- No changes to the game flow (GameCard, FeedbackCard, TutorialCard, etc.)
- No changes to API routes or data layer
- No new pages or routing changes
- No animation changes beyond the boot→profile transition
- No mobile layout changes
