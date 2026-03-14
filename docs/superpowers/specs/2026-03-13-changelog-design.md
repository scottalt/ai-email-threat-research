# Changelog Page Design

## Goal

Add a `/changelog` page with two sections: a permanent research timeline showing study milestones, and a platform updates log showing UI/feature changes. Serves as both a transparency tool for the research and an engagement signal showing the platform is actively maintained.

## Data Model (`lib/changelog.ts`)

Hardcoded TypeScript array — no database. Entries deploy with the app.

```ts
type ChangelogCategory = 'milestone' | 'update';

interface ChangelogEntry {
  date: string;        // ISO date string, e.g. '2026-03-11'
  category: ChangelogCategory;
  title: string;
  body?: string;       // optional detail text
}
```

- `milestone` — research timeline events (dataset locked, participation thresholds, phases)
- `update` — platform changes (UI improvements, new features, bug fixes)

Entries are stored in a single `CHANGELOG_ENTRIES` array, sorted by date ascending. The page filters by category and handles display order per section (milestones stay ascending, updates get reversed to newest-first).

## Page (`app/changelog/page.tsx`)

`'use client'` component — needs interactive state for the archive toggle and `usePlayer()` for auth check.

Export `metadata` with `title: 'Changelog | Threat Terminal'`.

### Section 1: Research Timeline

- Vertical timeline of `milestone` entries in chronological order (oldest first)
- Permanent — all milestones always visible, nothing archived
- Amber accent (`#ffaa00`) for milestone markers to distinguish from updates
- **Only visible to signed-in users** — use `usePlayer()` hook (same pattern as NavBar) to check `signedIn` and conditionally render this section
- Each entry shows date and title; body text below if present

### Section 2: Platform Updates

- Reverse-chronological list of `update` entries (newest first)
- **Visible to everyone** (signed in or not)
- Show the 5 most recent entries by default
- Older entries collapse behind a `[ SHOW ARCHIVE ]` / `[ HIDE ARCHIVE ]` toggle button (local `useState`)
- Each entry shows date, title, and optional body
- If no entries exist, show "No updates yet." in muted text

### Layout

- Matches existing page patterns: `min-h-screen bg-[#060c06]`, max-width container, `term-border` cards
- Nav spacing: `lg:pt-16 pb-20 lg:pb-8` (same as stats/profile/intel)
- Each section in its own `term-border` card with a header label (`RESEARCH_TIMELINE`, `PLATFORM_UPDATES`)
- Responsive: single column, readable on mobile and desktop

### Visibility

- Page accessible to everyone at `/changelog` (no auth gate on the route)
- Research timeline section conditionally rendered based on `signedIn` from `usePlayer()`
- Platform updates section always rendered

## Start Screen Link

Add a `[ CHANGELOG ]` link on the StartScreen, visible to all users. Place it after the game mode buttons / leaderboard section, as a subtle terminal-styled link. Same styling as other text links on the page (`text-[#1a5c2a] hover:text-[#33bb55]`).

## Nav Bar

No nav bar entry for now. Can be added later if the page proves useful enough to warrant primary navigation.

## Styling Details

- `term-border bg-[#060c06]` cards with `border-b border-[rgba(0,255,65,0.35)]` headers
- Milestone dates: `text-[#ffaa00]` (amber)
- Update dates: `text-[#33bb55]`
- Titles: `text-[#00ff41]`
- Body text: `text-[#00aa28]`
- Archive toggle: `text-[#33bb55] hover:text-[#00ff41]`

## Initial Entries

Seed with a few entries to ship with:

Milestones:
- 2026-02-28: Platform launched
- 2026-03-11: Final research dataset locked (1000 cards)

Updates:
- 2026-03-13: Persistent navigation bar, desktop layouts, boot animation
- 2026-03-11: Server-side answer verification
- 2026-03-09: Daily challenge mode and streak XP

(Exact entries to be refined during implementation)

## Out of Scope

- Database storage for entries
- Admin UI for adding entries
- RSS feed
- Nav bar link (deferred)
- Notification badge for new entries
