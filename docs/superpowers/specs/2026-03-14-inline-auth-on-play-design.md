# Inline Auth on Play Tap

## Problem

On mobile, the sign-in card sits at the top of the StartScreen page. Users scroll past it through the How-to-Play guide and Signal Guide, reach the Play button, and tap it. The current code calls `setShowAuthFlow(true)`, which renders the `<AuthFlow>` component inside the profile card area — far above the viewport. The player sees nothing happen, gets confused, and bounces.

This is a player retention issue. The sign-in gate is invisible at the moment it matters.

## Solution

When an unsigned-in user taps Play, expand an inline auth form **directly below the Play button** with progression-hook messaging. Remove the top-of-page sign-in card entirely — one sign-in path, at the point of action.

## Design Decisions

### Why inline auth (not sticky banner, layout restructure, or ungated play)

- **Inline auth (chosen):** Meets the player where they are. Zero layout disruption. The auth form appears at the exact moment of highest motivation (they just tapped Play). Minimal code change.
- **Sticky banner:** Adds persistent UI chrome that competes for attention on small screens.
- **Move sign-in next to Play:** Requires restructuring the mobile layout, risks breaking desktop.
- **Ungated play:** Loses research sign-ups from players who would have signed in if prompted. Requires building a post-game sign-in flow.

### Why remove the top sign-in card (not keep both)

One clear path is better than two. The top card created the original confusion. Returning players will tap Play, see the email field, and sign in from there — same number of steps. Keeping two CTAs splits attention and reintroduces the original problem in a weaker form.

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

Slide-down + fade-in, ~200ms ease-out. Confirms the tap registered and draws the eye to the form. A new `anim-slide-down` keyframe (translateY(-8px) → translateY(0)), inspired by but distinct from the existing `anim-fade-in-up` which animates upward.

## Changes

### AuthFlow.tsx

**Add optional `headless` prop:**

`AuthFlow` currently renders its own `term-border` wrapper with a "CLAIM_PROFILE" header bar and description text. When used inline below the Play button, this creates double borders and double headers since we wrap it in our own progression-hook block.

Add an optional `headless?: boolean` prop. When `headless` is true:
- Skip the outer `term-border` wrapper div and header bar ("CLAIM_PROFILE" / "ENTER_CODE")
- Skip the description text ("No password. We'll email you a 6-digit code...")
- Render only the form elements: email input, error message, submit button (and for OTP: code sent message, code input, verify button, "use different email" link)
- Keep the cancel (✕) button accessible — move it into the form area or omit it (the parent wrapper provides its own cancel via `onCancel`)

Default `headless` to `false` so existing usage is unaffected.

### StartScreen.tsx

**Remove:**
- The `[ SIGN IN TO SAVE YOUR SCORE ]` button in the profile card area (unsigned-in state, ~lines 327-333)
- The `showAuthFlow` conditional that renders `<AuthFlow>` inside the profile card (~line 324-325)
- The `showAuthFlow` state variable (replaced by `showInlineAuth`)
- The "sign in to contribute to the research study" hint text below the Play button (~line 437) — replaced by the progression hooks in the inline auth block

**Update references to `showAuthFlow`:**
- SFX toggle visibility condition (~line 224): change `!showAuthFlow` to `true` (SFX toggle should always show for unsigned-in users, the inline auth is below the fold)
- Sign Out button handlers (~lines 244, 306): remove `setShowAuthFlow(false)` calls (these are inside signed-in state branches; `showInlineAuth` is only relevant when unsigned-in and resets naturally when `signedIn` becomes true)

**Add:**
- New state: `showInlineAuth` (boolean, default false)
- When `!signedIn` and user taps Play button → `setShowInlineAuth(true)` (existing handler at ~line 424, just targeting new state)
- Render inline auth block directly below the Play button, replacing the old hint text. Structure:
  - Outer wrapper div with `anim-slide-down` class, `term-border`, amber border
  - Header: "SIGN IN TO START" (`text-[#ffaa00]`, bold, tracking-widest)
  - Subtitle: "New or returning — enter your email to begin or continue" (`text-[#33bb55]`, small)
  - Three bullet points with amber arrows: Track XP + leaderboard / Contribute to research / Unlock Daily Challenge + Expert
  - Reassurance: "Magic code · no password · 10 seconds" (`text-[#cc8800]`, small)
  - `<AuthFlow headless onSignIn={signInWithEmail} onVerifyCode={verifyOtp} onCancel={() => setShowInlineAuth(false)} />`

**Keep unchanged:**
- Signed-in player rendering (profile card with XP bar, graduation badge, etc.)
- Play button behavior when signed in (starts game normally)

**Desktop behavior:** The top sign-in card is removed on all screen sizes. Desktop users who are unsigned-in will use the same inline auth below Play. On desktop's two-column layout the Play button is already visible without scrolling, so the original problem doesn't occur — but having one consistent auth path is simpler than maintaining two.

### globals.css

**Add:**
- `@keyframes slideDown` — from `{ opacity: 0; transform: translateY(-8px) }` to `{ opacity: 1; transform: translateY(0) }`
- `.anim-slide-down { animation: slideDown 200ms ease-out both; }`

### Files NOT modified

- `lib/PlayerContext.tsx` — no auth logic changes
- `components/Game.tsx` — no state machine changes
- `components/NavBar.tsx` — unaffected

## Behavior Flow

1. Unsigned-in player arrives at StartScreen
2. Sees: How to Play → Signal Guide → `[ PLAY ]` button
3. Taps `[ PLAY ]`
4. Inline auth slides down below Play button with progression hooks
5. Player enters email → receives magic code → enters code
6. On successful auth, `signedIn` becomes true, `showInlineAuth` resets
7. Play button now shows `[ PLAY ]` or `[ RESEARCH MODE ]` — tapping starts the game

## Edge Cases

- **Player dismisses inline auth:** Cancel button (✕ in top corner of wrapper) hides the form via `onCancel`. Play button still shows, they can tap again.
- **Returning player on new device:** Taps Play, enters their email, picks up where they left off. No different from new player flow.
- **Post-auth callsign setup:** After signing in, if the player has no display name, the profile card area at the top renders the callsign form. This is existing behavior and works fine — the player sets their name, then taps Play to start.
- **Desktop:** Same inline auth path. The two-column layout keeps Play visible without scrolling, so the problem is less acute, but one consistent path is simpler.
- **Player is already signed in:** None of this renders. Play button starts the game directly.
