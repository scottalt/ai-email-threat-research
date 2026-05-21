# SecureWorld South Florida Attendance Badge (Code-Redeemable) Design

Date: 2026-05-20
Status: Draft (awaiting user review)
Target branch: `v3.0` (current branch)

## Purpose

Award a unique badge to attendees of Scott's talk at the SecureWorld South Florida 2026 cybersecurity industry conference. Distribution is by promo code rather than admin grant: a `SOFL2026` code is displayed at the end of the talk, and attendees who already play the game (or sign up afterwards) can self-redeem it on the existing `/inventory/codes` tab. This complements, rather than duplicates, the BSides-attendance badge (`briefed_by_architect`) shipped on 2026-05-09: BSides was manually granted to a small known cohort; this one assumes a larger, less-known audience.

## Constraints

1. **No trademark use.** "SecureWorld" is a registered service mark of SecureWorld Expo. Neither the badge name, flavor text, nor the redemption code may include it. The badge evokes the event through generic industry-conference vocabulary.
2. **No new schema.** The existing `promo_codes` / `promo_redemptions` tables and the existing `/api/promo/redeem` route already provide the full redemption flow (rate-limit, atomic increment, one-per-player). No new migrations required.
3. **No max-uses ceiling, no expiry.** The user wants the code redeemable indefinitely by any operative who has it.
4. **Custom SIGINT dialogue.** Both the success and already-redeemed responses must be SIGINT-flavored and specific to this badge. They must not reuse the existing THOUGHT_LEADER-flavored text (which the existing `PROMO_DIALOGUES.code_success` hardcodes).

## Pre-existing limitation surfaced by this work

The current `PROMO_DIALOGUES.code_success` in `lib/sigint-personality.ts` is hardcoded with THOUGHT_LEADER-specific text ("You're officially a Thought Leader now…"). Today, redeeming any future code shows the wrong message. This spec does **not** refactor that to a generic fallback. Per user direction, the existing dialogue is left untouched, and the new badge gets its own dedicated dialogues. Future codes will need similar per-badge entries.

## Badge definition

Appended to `lib/achievements.ts` in the existing `// ── Event Exclusive ──` section, immediately after `briefed_by_architect`:

```ts
{
  id: 'threat_brief_attendee',
  name: 'THREAT_BRIEF_ATTENDEE',
  description: "Attended a field briefing in the South Florida sector, 2026. Some signals only travel through conference rooms.",
  category: 'season',
  rarity: 'mythic',
  icon: '📋',
}
```

Field rationale:

- **id**: `threat_brief_attendee` follows the snake_case convention used throughout the registry.
- **name**: `THREAT_BRIEF_ATTENDEE` matches the SCREAMING_SNAKE_CASE display convention. Uses in-game vocabulary ("threat brief") rather than naming the conference.
- **description**: Geographic reference only ("South Florida sector"), industry-channel framing. No em dashes per user preference. The closing line "Some signals only travel through conference rooms" plants the in-person-attendance angle.
- **category**: `'season'` matches precedent for promo and event badges (`THOUGHT_LEADER`, `BRIEFED_BY_ARCHITECT`, `ARCHITECT`, `HANDLER_APPROVED`).
- **rarity**: `'mythic'`. Matches the `BRIEFED_BY_ARCHITECT` BSides badge precedent. Renders gold (`#ffd700`) per `RARITY_COLORS`. Reasoning: `unique` is reserved for one-of-one badges; `secret` implies hidden discovery; `mythic` is the established tier for rare prestige granted to a defined cohort.
- **icon**: `📋` (clipboard). Direct visual map to "briefing." Unused elsewhere in the registry. Differentiates visually from the `🌴` BSides badge so attendees who hold both see two distinct items in their collection.
- **season**: omitted. Not tied to a game season.

### Section comment update

The current header `// ── Event Exclusive (manually granted only) ──` becomes inaccurate when this code-redeemable event badge is added. Rename to `// ── Event Exclusive ──` to cover both manual-grant and code-redeemed event badges.

## SIGINT dialogue additions

Two new entries added to the `PROMO_DIALOGUES` object in `lib/sigint-personality.ts`. The existing `code_success` and `code_already` entries are not modified.

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

Voice rationale: short sentences, dry, software-aware, no em dashes, never teaches detection techniques. Matches the voice rules documented at the top of `lib/sigint-personality.ts`.

## API change

In `app/api/promo/redeem/route.ts`, the existing `ALREADY_REDEEMED` response includes `error` and `message` only. Add `badgeId` so the client can route to the correct dialogue:

```ts
return NextResponse.json({
  error: 'ALREADY_REDEEMED',
  message: 'You already redeemed this code.',
  badgeId: promo.badge_id,
}, { status: 409 });
```

No other API changes. The atomic increment RPC, the rate limiter, the auth check, and all other branches remain untouched.

## Client change

In `CodesTab` inside `app/(game)/inventory/page.tsx`, branch the dialogue selection on `data.badgeId` for both the success and already-redeemed cases:

```ts
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

All other branches (`EXPIRED`, `EXHAUSTED`, rate-limit, network error, invalid) remain unchanged.

## Database seed

A single row inserted into `promo_codes` via the Supabase dashboard (per the existing convention: seed data is not committed to the public repo, since the code value is the secret).

```sql
INSERT INTO promo_codes (code, badge_id, max_uses, expires_at, active)
VALUES ('SOFL2026', 'threat_brief_attendee', 1000000, NULL, true);
```

`max_uses = 1000000` is the practical "no max." The schema has `max_uses integer NOT NULL`, so a literal NULL is not allowed without a migration. One million is far beyond any realistic redemption volume. `expires_at = NULL` is supported natively and means the code never expires.

## Out of scope

- **No schema migration for nullable `max_uses`.** Deferred. The high-ceiling approach achieves the same user-visible behavior with zero migration risk.
- **No refactor of the existing THOUGHT_LEADER dialogue.** Per user direction, leave `code_success` and `code_already` exactly as they are.
- **No generic per-badge dialogue lookup table.** The third event badge can either branch in the same way or motivate a proper lookup at that point. YAGNI for now.
- **No QR code, distribution UI, or social-share artifact.** Scott displays `SOFL2026` on the talk's final slide / printed handouts as he sees fit.

## Verification

After implementation, verify all four cases:

1. **Cold redeem.** A signed-in player on `/inventory/codes` types `sofl2026` (lowercase, to confirm the case-insensitive upcase still works) → 200 → SIGINT shows `briefing_success` → the clipboard badge appears in the BADGES tab with the gold mythic glow.
2. **Re-redeem.** Same player enters `SOFL2026` again → 409 with `ALREADY_REDEEMED` and `badgeId` populated → SIGINT shows `briefing_already` (not the THOUGHT_LEADER text).
3. **Regression: THOUGHT_LEADER unchanged.** A separate player who has not redeemed THOUGHT_LEADER enters its code → 200 → SIGINT shows the existing `code_success` text → that flow is untouched.
4. **Registry sanity.** `ACHIEVEMENT_MAP.get('threat_brief_attendee')` returns the new definition; the badge appears in the `/inventory/badges` grid under the `mythic` rarity filter.

## Open questions

None. All clarifying questions confirmed in the brainstorming session:

- Badge name: `THREAT_BRIEF_ATTENDEE` (option "Threat brief")
- Icon: 📋 (clipboard)
- Flavor text: "Attended a field briefing in the South Florida sector, 2026. Some signals only travel through conference rooms." (option "Industry channel")
- Code: `SOFL2026` (option "Region")
- Max uses: none (implemented as `1000000` ceiling)
- Expiry: none (`expires_at = NULL`)
- SIGINT success dialogue: option A ("Briefing logged")
- SIGINT already-redeemed dialogue: option A ("Receipts")
- THOUGHT_LEADER dialogue: leave untouched, new badge gets its own dedicated text
