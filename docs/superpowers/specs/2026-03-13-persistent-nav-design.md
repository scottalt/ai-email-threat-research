# Persistent Navigation Bar Design

## Goal

Add a persistent navigation bar so users can move between pages without returning to the homepage. Desktop gets a top bar, mobile gets a bottom tab bar. Hidden during active gameplay to preserve immersion.

## Architecture

A single `NavBar` client component rendered in `layout.tsx` handles both layouts via responsive CSS (`lg:` breakpoint). It reads the current route via `usePathname()` and highlights the active link. A context signal from the `Game` component hides the nav during gameplay. Since `layout.tsx` is a Server Component, `NavBar` must be a `'use client'` component — this is the same pattern used by `TerminalSounds`.

## NavBar Component (`components/NavBar.tsx`)

### Desktop (lg+)

Fixed top bar:

```
THREAT TERMINAL                    PLAY   STATS   INTEL   PROFILE   [SFX]
──────────────────────────────────────────────────────────────────────────
```

- `position: fixed; top: 0` with `z-50`
- Logo/title on the left, nav links + SFX toggle on the right
- `term-border` bottom edge, `bg-[#060c06]` background
- Active link: `text-[#00ff41]`, inactive: `text-[#1a5c2a]`, hover: `text-[#33bb55]`
- `aria-current="page"` on the active link

### Mobile (<lg)

Fixed bottom tab bar:

```
──────────────────────────────────────────────────────────────────────────
   PLAY        STATS        INTEL        PROFILE
```

- `position: fixed; bottom: 0` with `z-50`
- 4 links evenly spaced, monospace labels, text-only (matches CRT theme)
- `term-border` top edge, `bg-[#060c06]` background
- Active link: `text-[#00ff41]`, inactive: `text-[#1a5c2a]`
- Must account for `env(safe-area-inset-bottom)` on notched iPhones via `pb-safe`
- SFX toggle not in mobile nav (too cramped) — one instance kept on StartScreen for mobile access (hidden on `lg:` since desktop has it in the top bar)

### Nav Links

| Label    | Path           | Visible When            |
|----------|----------------|-------------------------|
| PLAY     | `/`            | Always                  |
| STATS    | `/stats`       | Signed in               |
| INTEL    | `/intel/player`| Signed in               |
| PROFILE  | `/profile`     | Signed in               |

When not signed in, only PLAY is shown (other pages require auth anyway).

### Active State

Use `usePathname()` from `next/navigation` with prefix matching:
- `/` (exact) → PLAY active
- `pathname.startsWith('/stats')` → STATS active
- `pathname.startsWith('/intel')` → INTEL active (covers `/intel/player`)
- `pathname.startsWith('/profile')` → PROFILE active

## Visibility Logic

### When to Show

- `/` (start screen, when game phase is `start`)
- `/stats`
- `/profile`
- `/intel/player`
- `/methodology`
- `/not-found` (404 page)

### When to Hide

- During gameplay — hide when game phase is anything other than `start` (covers `playing`, `checking`, `feedback`, `summary`, `loading`, `daily_complete`, `research_intro`, `research_unavailable`, `tutorial`)
- `/admin/*` pages
- `/auth/*` pages
- `/intel` exact (admin intel page, not `/intel/player`)

### Implementation

Add a `NavVisibilityContext` (or extend the existing `PlayerContext`) with a `setNavHidden(boolean)` function. The `Game` component calls `setNavHidden(true)` when phase !== `start` and `setNavHidden(false)` when returning to the start phase. The `NavBar` reads this context and renders `null` when hidden.

For admin/auth/admin-intel pages, the `NavBar` checks `usePathname()` and self-hides.

## Page Spacing

- Desktop: pages apply `pt-12` (or similar) to clear the fixed top bar
- Mobile: pages apply `pb-16` (or similar) to clear the fixed bottom bar
- Applied via a client wrapper component in `layout.tsx` that reads nav visibility context, or applied unconditionally on each page with the nav hidden pages managing their own padding
- During gameplay: Game component manages its own full-screen layout, no extra padding needed

## Cleanup

### Remove Per-Page Back Links

These pages currently have their own "← TERMINAL" / "[ BACK TO TERMINAL ]" links that become redundant:

- `app/stats/page.tsx` — remove header back link and bottom back button
- `app/profile/page.tsx` — remove header back link
- `app/intel/player/page.tsx` — remove header back link and bottom back button
- `app/methodology/page.tsx` — remove header back link

### Keep

- Admin pages keep their own back links (not in nav)
- Intel admin page keeps its own nav
- In-game buttons: `[ BACK TO TERMINAL ]` in RoundSummary, `daily_complete`, `research_unavailable`, and `SummaryErrorBoundary` are all kept — these are in-game flow controls, not page navigation

### SFX Toggle

- Remove SFX toggle from `StartScreen.tsx` desktop instances (profile header, SET_CALLSIGN header)
- Keep one SFX toggle on StartScreen visible only on mobile (`lg:hidden`) — mobile users need access since the mobile nav bar doesn't include it
- SFX toggle in desktop nav bar replaces the StartScreen desktop instances

### E2E Tests

- Update `e2e/navigation.spec.ts` — tests that look for back links will need to use the new nav bar selectors instead

## Dependencies

- `usePathname` from `next/navigation`
- `useSoundEnabled` hook (for SFX toggle in nav)
- `PlayerContext` (for `signedIn` state to conditionally show links)
- New `NavVisibilityContext` or extension of existing context

## Out of Scope

- Settings page (YAGNI — only one setting exists)
- Icons in nav (text-only matches CRT theme)
- Animated transitions between pages
