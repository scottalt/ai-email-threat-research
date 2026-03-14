# Inline Auth on Play Tap

## Problem

On mobile, the sign-in card sits at the top of the StartScreen page. Users scroll past it through the How-to-Play guide and Signal Guide, reach the Play button, and tap it. The current code calls `setShowAuthFlow(true)`, which renders the `<AuthFlow>` component inside the profile card area — far above the viewport. The player sees nothing happen, gets confused, and bounces.

The same problem applies to the callsign + background setup form: after a new player signs in, the SET_CALLSIGN form renders at the top of the page in the profile card area — again above the viewport if the player has scrolled down to Play.

This is a player retention issue. The onboarding gates are invisible at the moment they matter.

## Solution

When an unsigned-in user taps Play, expand an inline onboarding flow **directly below the Play button**. This flow handles both sign-in and callsign/background setup in one anchored location. Remove the top-of-page sign-in card and the top-of-page callsign form for unsigned-in/new players — the entire first-time experience lives below the Play button.

### Inline onboarding sequence (all below Play button):

1. **Step 1 — Sign In:** Progression hooks + email input + OTP verification
2. **Step 2 — Set Callsign + Background:** Callsign input + background selection grid + SET button
3. **Done:** Inline block disappears, Play button works normally

## Design Decisions

### Why inline auth (not sticky banner, layout restructure, or ungated play)

- **Inline auth (chosen):** Meets the player where they are. Zero layout disruption. The auth form appears at the exact moment of highest motivation (they just tapped Play). Minimal code change.
- **Sticky banner:** Adds persistent UI chrome that competes for attention on small screens.
- **Move sign-in next to Play:** Requires restructuring the mobile layout, risks breaking desktop.
- **Ungated play:** Loses research sign-ups from players who would have signed in if prompted. Requires building a post-game sign-in flow.

### Why remove the top sign-in card (not keep both)

One clear path is better than two. The top card created the original confusion. Returning players will tap Play, see the email field, and sign in from there — same number of steps. Keeping two CTAs splits attention and reintroduces the original problem in a weaker form.

### Why inline callsign setup too

Same scroll problem, one step deeper. After signing in below Play, the callsign form would appear at the top of the page — invisible to the player. Keeping the entire first-time flow anchored below Play means no scroll surprises at any step.

### Messaging: Progression Hook

The inline auth block uses value-prop messaging that frames sign-in as gaining access, not a gate:

```
SIGN IN TO START
New or returning — enter your email to begin or continue

▸ Track your XP + climb the leaderboard
▸ Contribute to phishing research
▸ Unlock Daily Challenge + Expert Mode

Magic code · no password · 10 seconds

[email input]
[ SEND CODE ]
```

### Animation

Slide-down + fade-in, ~200ms ease-out. Confirms the tap registered and draws the eye to the form. A new `anim-slide-down` keyframe (translateY(-8px) → translateY(0)), inspired by but distinct from the existing `anim-fade-in-up` which animates upward. Used for both the initial auth block and the transition to callsign setup.

## Changes

### AuthFlow.tsx

**Add optional `headless` prop:**

`AuthFlow` currently renders its own `term-border` wrapper with a "CLAIM_PROFILE" header bar and description text. When used inline below the Play button, this creates double borders and double headers since we wrap it in our own progression-hook block.

Update `AuthFlowProps` interface to add `headless?: boolean`. When `headless` is true:
- Skip the outer `term-border` wrapper div and header bar ("CLAIM_PROFILE" / "ENTER_CODE")
- Skip the description text ("No password. We'll email you a 6-digit code...")
- Render only the form elements: email input, error message, submit button (and for OTP: code sent message, code input, verify button, "use different email" link)
- Omit the cancel (✕) button — the parent wrapper provides its own cancel via `onCancel`
- The `onCancel` prop is still accepted but unused internally in headless mode (the parent wrapper handles cancel). It remains in the interface for consistency — no need for a separate headless-only type.

Default `headless` to `false` so existing usage is unaffected.

### StartScreen.tsx

**Remove from the profile card area (top of page):**
- The `[ SIGN IN TO SAVE YOUR SCORE ]` button (unsigned-in state, ~lines 327-333)
- The `showAuthFlow` conditional that renders `<AuthFlow>` inside the profile card (~line 324-325)
- The `showAuthFlow` state variable (replaced by `showInlineAuth`)
- The SET_CALLSIGN + BACKGROUND form for new players (~lines 238-289) — moved inline below Play

**What remains in the profile card area:**
- Signed-in player WITH displayName: profile card with XP bar, graduation badge, sign out (unchanged)
- Signed-in player WITHOUT displayName: nothing renders here (callsign setup is inline below Play now)
- Unsigned-in player: nothing renders here (sign-in is inline below Play now)

**Remove below the Play button:**
- The "sign in to contribute to the research study" hint text (~line 437) — replaced by the progression hooks in the inline auth block

**Update references to `showAuthFlow`:**
- SFX toggle visibility condition (~line 224): change `!showAuthFlow` to `true` (SFX toggle should always show for unsigned-in users, the inline auth is below the fold)
- Sign Out button handlers (~lines 244, 306): remove `setShowAuthFlow(false)` calls (these are inside signed-in state branches where `showInlineAuth` is irrelevant)

**Add inline onboarding block below the Play button:**

New state: `showInlineAuth` (boolean, default false)

When `!signedIn` and user taps Play → `setShowInlineAuth(true)` (existing handler at ~line 424, just targeting new state)

The inline block renders directly below the Play button and shows different content based on auth state:

**State 1 — Not signed in (`!signedIn && showInlineAuth`):**
- Outer wrapper div with `anim-slide-down` class, `term-border`, amber border
- Cancel button (✕) in top-right corner → `setShowInlineAuth(false)`
- Header: "SIGN IN TO START" (`text-[#ffaa00]`, bold, tracking-widest)
- Subtitle: "New or returning — enter your email to begin or continue" (`text-[#33bb55]`, small)
- Three bullet points with amber arrows: Track XP + leaderboard / Contribute to research / Unlock Daily Challenge + Expert
- Reassurance: "Magic code · no password · 10 seconds" (`text-[#cc8800]`, small)
- `<AuthFlow headless onSignIn={signInWithEmail} onVerifyCode={verifyOtp} onCancel={() => setShowInlineAuth(false)} />`

**State 2 — Signed in, no callsign (`signedIn && !profile.displayName`):**
- Same outer wrapper position, with `anim-slide-down` class for the transition
- Cancel button (✕) → sign out + `setShowInlineAuth(false)`
- Header: "SET_CALLSIGN" (`text-[#33bb55]`, tracking-widest)
- Callsign text input + SET button (reuse form markup from ~lines 248-266, without the outer `term-border` wrapper — the inline block wrapper provides that)
- Background selection label + grid (reuse markup from ~lines 267-286)
- Error display
- SET button (disabled until callsign + background are filled)

**Neither state applies (signed in with displayName, or `!signedIn && !showInlineAuth`):**
- Nothing renders. Play button works normally.

**`showInlineAuth` lifecycle:** Set to `true` when unsigned-in user taps Play. Remains `true` through the sign-in → callsign two-step flow (State 1 transitions to State 2 reactively when `signedIn` becomes true and `!profile.displayName`). The inline block stops rendering when `profile.displayName` becomes truthy (the "neither state" condition), making `showInlineAuth` inert — no explicit reset needed. If the player signs out, `signedIn` goes false and `showInlineAuth` is still true, which correctly shows the auth form again (State 1).

**Scroll into view:** After the inline block mounts (both State 1 and State 2 transitions), call `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the wrapper element via a ref. On mobile, if the Play button is near the bottom of the viewport, the inline block would otherwise appear below the fold. The smooth scroll ensures the player sees the form.

**Keep unchanged:**
- Signed-in player rendering in profile card (XP bar, graduation badge, etc.) — only for players who already have a displayName
- Play button behavior when signed in with displayName (starts game normally)

**Desktop behavior:** The top sign-in card and top callsign form are removed on all screen sizes. Desktop users use the same inline flow below Play. On desktop's two-column layout the Play button is already visible without scrolling, so the original problem doesn't occur — but having one consistent path is simpler than maintaining two.

### globals.css

**Add:**
- `@keyframes slideDown` — from `{ opacity: 0; transform: translateY(-8px) }` to `{ opacity: 1; transform: translateY(0) }`
- `.anim-slide-down { animation: slideDown 200ms ease-out both; }`

### Files NOT modified

- `lib/PlayerContext.tsx` — no auth logic changes
- `components/Game.tsx` — no state machine changes
- `components/NavBar.tsx` — unaffected

## Behavior Flow

### New player (first time):
1. Arrives at StartScreen, scrolls down
2. Sees: How to Play → Signal Guide → `[ PLAY ]` button
3. Taps `[ PLAY ]`
4. Inline auth slides down below Play with progression hooks
5. Enters email → receives magic code → enters code → authenticated
6. Inline block transitions to SET_CALLSIGN + BACKGROUND form (same position below Play)
7. Sets callsign, selects background, taps SET
8. Inline block disappears, profile card appears at top with XP bar
9. Play button now shows `[ PLAY ]` or `[ RESEARCH MODE ]` — tapping starts the game

### Returning player (already has callsign):
1. Arrives at StartScreen, scrolls down
2. Taps `[ PLAY ]`
3. Inline auth slides down below Play
4. Enters email → verifies code → authenticated
5. Profile card appears at top with XP bar (displayName already set)
6. Inline block disappears, Play button works — tapping starts the game

### Already signed in:
1. Profile card shows at top with XP bar
2. Taps `[ PLAY ]` → game starts immediately

## Edge Cases

- **Player dismisses inline auth:** Cancel button (✕) hides the form via `setShowInlineAuth(false)`. Play button still shows, they can tap again.
- **Player dismisses callsign setup:** Cancel button (✕) signs them out and hides the form. They're back to unsigned-in state. Tapping Play restarts the flow.
- **Returning player on new device:** Taps Play, enters their email, picks up where they left off. Callsign step is skipped (displayName already exists).
- **Desktop:** Same inline flow. The two-column layout keeps Play visible without scrolling, so the problem is less acute, but one consistent path is simpler.
- **Player is already signed in with callsign:** None of this renders. Play button starts the game directly.
