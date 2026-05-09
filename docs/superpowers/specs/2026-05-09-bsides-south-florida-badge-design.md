# BSides South Florida 2026 Attendance Badge — Design

Date: 2026-05-09
Status: Draft (awaiting user review)
Target branch: `v3.0` (current branch)

## Purpose

Award a unique, manually-granted achievement to attendees of Scott's talk at BSides South Florida (May 2026). The talk was about THREAT TERMINAL itself, so the badge encodes a small worldbuilding pairing: `ARCHITECT` (built the system) and `BRIEFED_BY_ARCHITECT` (heard him explain it). Attendees who already play the game will see the connection.

## Constraints

1. No use of trademarked terms ("BSides" is a registered mark of Security BSides). The badge evokes the event without naming it.
2. No new infrastructure. The existing `lib/achievements.ts` registry plus the existing admin grant endpoint at `app/api/admin/players/[id]/achievements/route.ts` are sufficient.
3. Granted manually. Scott has the attendee handles already; no claim flow, redemption codes, or QR pages are needed.

## Badge definition

To be added to `lib/achievements.ts` under the existing "Promo Exclusive" or "Admin Exclusive" group:

```ts
{
  id: 'briefed_by_architect',
  name: 'BRIEFED_BY_ARCHITECT',
  description: "Heard the architect explain the system, in person. Boca Raton sector, May 2026. The briefing came before the deployment.",
  category: 'season',
  rarity: 'mythic',
  icon: '🌴',
}
```

Field rationale:

- **id**: `briefed_by_architect` follows the snake_case convention used throughout the registry.
- **name**: `BRIEFED_BY_ARCHITECT` matches the SCREAMING_SNAKE_CASE display convention.
- **description**: Lore-tied flavor. The phrase "the briefing came before the deployment" only fully lands for an attendee who is now playing the game. No em dashes per user preference.
- **category**: `'season'` matches the existing precedent for promo and admin-granted badges (`THOUGHT_LEADER`, `ARCHITECT`, `HANDLER_APPROVED` all use `'season'`).
- **rarity**: `'mythic'`. Reasoning: `unique` is reserved for one-of-one badges (`ARCHITECT`); `secret` implies the player discovered the badge through hidden play; `mythic` is the established tier for "rare prestige granted to a defined cohort" (per `FOUNDER`, `THOUGHT_LEADER`). Renders gold (`#ffd700`) per `RARITY_COLORS`.
- **icon**: `🌴` (palm tree emoji). Direct geographic nod to South Florida, no trademark concern. Matches the emoji-icon pattern already used by the roguelike achievements and `🧠 THOUGHT_LEADER`. Earlier candidates `⟐` (icon collision with `beta_tester`) and `⎇` (clever-but-abstract) rejected in favor of immediate visual recognition.
- **season**: Omitted. The badge is not tied to a game season.

## Placement in registry

In `lib/achievements.ts`, add a new section header just below the existing `// ── Admin Exclusive (manually granted only) ──` group, with the new badge as its sole entry:

```ts
// ── Event Exclusive (manually granted only) ──
{ id: 'briefed_by_architect', name: 'BRIEFED_BY_ARCHITECT', description: "Heard the architect explain the system, in person. Boca Raton sector, May 2026. The briefing came before the deployment.", category: 'season', rarity: 'mythic', icon: '🌴' },
```

Reasoning for a new section rather than merging into Admin Exclusive: future event badges (other talks, conferences, partner promotions) will accumulate here. Giving real-world-event badges their own group keeps the registry navigable as it grows.

## Granting flow

No code changes beyond the registry entry. Scott uses the existing admin player achievements UI/endpoint to grant `briefed_by_architect` to each attendee handle on his list. The existing endpoint at `app/api/admin/players/[id]/achievements/route.ts` already supports manual grants.

## Out of scope

- Redemption codes, QR pages, or self-claim flows. Discussed and ruled out in favor of manual grants.
- A dedicated event-badge schema. The existing registry is sufficient for this single badge.
- Visual treatment beyond the existing `mythic` rarity glow (gold, with `badge-mythic` CSS class). No custom animations.

## Verification

After merging, verify:

1. Badge appears in the achievement registry shown on the profile page when granted.
2. Granting through the admin dashboard succeeds and the badge appears on the target player's profile with the gold mythic glow.
3. `getAchievementById('briefed_by_architect')` returns the definition (sanity check via `ACHIEVEMENT_MAP`).

## Open questions

None. The user has confirmed: Option A (`BRIEFED_BY_ARCHITECT`), manual grant via admin dashboard, no em dashes in flavor text.
