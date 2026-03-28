# Inventory System — Cosmetics & Equip

**Date:** 2026-03-22
**Status:** Design approved
**Branch:** `feature/inventory-shop` (off `v2.0`)

---

## Overview

Player-facing inventory page for managing cosmetic items. Tabbed UI with Themes and Badges tabs. Players can equip themes and feature one badge for display in H2H matches. Designed for extensibility — new item categories (titles, card skins, etc.) slot in as additional tabs.

No shop or coin system in this iteration. The data model supports purchasable items for a future update.

---

## Inventory Page

### Route & Navigation

- Route: `/inventory`
- New nav item between Profile and Stats
- Accessible to all signed-in players (no graduation gate)

### Layout

- Tabbed interface: **THEMES** | **BADGES** (more tabs added later)
- 2-column grid on mobile, 3-column on desktop (`grid-cols-2 lg:grid-cols-3`)
- Each item rendered as a card with: icon/color swatch, name, subtitle, status

### Theme Tab

- Shows all 6 themes from `lib/themes.ts`
- Unlocked themes: tappable, shows name + color swatch + subtitle
- Locked themes: dimmed (opacity-40), shows unlock requirement ("LVL 16")
- Currently equipped theme: highlighted border + "EQUIPPED" badge
- Tap an unlocked theme to equip it (calls existing `setThemeId` from ThemeContext)
- Tap currently equipped theme: no-op (can't unequip — always need a theme)

### Badge Tab

- Shows all earned achievements from `player_achievements` table
- Unearned badges: dimmed with lock icon + earn requirement
- Currently featured badge: highlighted border + "FEATURED" badge
- Tap an earned badge to feature it (sets as the one displayed in H2H)
- Tap currently featured badge to unfeature (no featured badge)
- Featured badge persisted server-side on the player record

---

## Data Model

### Player record changes

Add `featured_badge` column to `players` table:

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS featured_badge TEXT;
-- References an achievement_id from player_achievements
```

No new table needed for themes — themes stay in localStorage with the existing ThemeContext system. The equipped theme is client-side only (cosmetic, no competitive advantage). When/if the shop arrives, themes will migrate to a `player_inventory` table.

### Future extensibility

When the shop is added:

```sql
CREATE TABLE player_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  item_type TEXT NOT NULL, -- 'theme', 'badge', 'title', 'card_skin', etc.
  item_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'earned', -- 'earned', 'purchased', 'gifted'
  equipped BOOLEAN DEFAULT FALSE,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, item_type, item_id)
);
```

This table is NOT created now — only when the shop feature is built. For now, themes use localStorage and badges use `player_achievements` + the new `featured_badge` column.

---

## API Endpoints

### `PATCH /api/player/featured-badge`

Set or clear the featured badge.

- Body: `{ badgeId: string | null }`
- Validates `badgeId` exists in `player_achievements` for this player
- Updates `players.featured_badge`
- Returns `{ ok: true }`

### `GET /api/player` (existing — extend response)

Add `featuredBadge: string | null` to the player profile response.

---

## H2H Opponent Display

### Match Lobby (VS Panel)

Both players see each other's:
- Callsign (existing)
- Rank tier + color (existing)
- Featured badge icon + name (new — from opponent's `featured_badge`)
- Theme accent color as subtle border tint on their side of the VS panel (new)

### During Match (Opponent HUD)

- Opponent's featured badge icon shown next to their callsign in the progress bar

### Result Screen

- Both players' featured badges visible in the scoreboard section

### Data Flow

When a match is created, the queue endpoint already fetches both players' info. Extend to include `featured_badge` and `theme_id` (from a new column or from the queue entry metadata). The match state endpoint returns this data for the lobby.

To support this, extend the queue entry to include cosmetic data:

```typescript
// Queue entry stored in Redis
{
  playerId: string;
  displayName: string;
  rankPoints: number;
  featuredBadge: string | null;  // new
  joinedAt: number;
}
```

The match state endpoint (`GET /api/h2h/match/[id]`) extends the player data to include `featuredBadge`.

---

## Profile Page Changes

- **Remove** the TERMINAL_THEMES section from `/profile`
- **Keep** the achievements display on profile (read-only showcase)
- **Add** a link to `/inventory` for managing cosmetics: "Manage themes and badges in your Inventory"
- The featured badge appears on the profile page next to the callsign

---

## UI Components

### `app/(game)/inventory/page.tsx`

Client component with:
- Tab state (`'themes' | 'badges'`)
- Fetches player profile (for level, achievements, featured badge)
- Renders grid of items based on active tab
- Handles equip/feature actions

### No new shared components needed

The inventory page is self-contained. The badge icon rendering can use the existing `ACHIEVEMENTS` registry from `lib/achievements.ts`.

---

## Migration

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS featured_badge TEXT;
```

Single column addition — no data migration needed.

---

## What's NOT in scope

- Shop page
- Coin currency
- Purchasable items
- player_inventory table
- Title cosmetics
- Card skin cosmetics
- Animated badges
- Badge trading
