# Inline Auth on Play Tap — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the sign-in and callsign setup flows from the top of the StartScreen to inline below the Play button, so mobile users always see the onboarding forms at the point of action.

**Architecture:** Add a `headless` prop to `AuthFlow` so it renders without its own wrapper. In `StartScreen`, replace the top-of-page sign-in card and callsign form with an inline onboarding block below the Play button that shows sign-in (State 1) or callsign setup (State 2) based on auth state. Add a CSS slide-down animation and scrollIntoView behavior.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-inline-auth-on-play-design.md`

---

## File Map

| File | Changes |
|------|---------|
| `components/AuthFlow.tsx` | Add `headless` prop, conditionally skip wrapper/header/description/cancel button |
| `components/StartScreen.tsx` | Remove top sign-in card + callsign form, replace `showAuthFlow` with `showInlineAuth`, add inline onboarding block below Play, add scrollIntoView ref |
| `app/globals.css` | Add `slideDown` keyframe + `.anim-slide-down` utility class |

---

## Chunk 1: AuthFlow Headless Mode + CSS Animation

### Task 1: Add slideDown CSS animation

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add keyframe and utility class after the existing `anim-fade-in-up` block**

After the `.anim-fade-in-up` rule (~line 157), add:

```css
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.anim-slide-down {
  animation: slideDown 200ms ease-out both;
}
```

Also add `.anim-slide-down` to the existing `prefers-reduced-motion` block (~line 291-295):

```css
  .anim-card-entry,
  .anim-fade-in,
  .anim-fade-in-up,
  .anim-slide-down {
    animation-duration: 0.01ms !important;
  }
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx next build 2>&1 | head -20` or `npx next lint`
Expected: No CSS errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add slideDown animation for inline auth"
```

---

### Task 2: Add `headless` prop to AuthFlow

**Files:**
- Modify: `components/AuthFlow.tsx`

- [ ] **Step 1: Add `headless` to the props interface**

In `components/AuthFlow.tsx`, update the interface at line 5-9:

```tsx
interface AuthFlowProps {
  onSignIn: (email: string) => Promise<{ error: string | null }>;
  onVerifyCode: (email: string, code: string) => Promise<{ error: string | null }>;
  onCancel: () => void;
  headless?: boolean;
}
```

And update the destructuring at line 11:

```tsx
export function AuthFlow({ onSignIn, onVerifyCode, onCancel, headless = false }: AuthFlowProps) {
```

- [ ] **Step 2: Make the OTP verification view (lines 36-78) conditional on `headless`**

Replace the `sent/verifying` return block (lines 36-78). When `headless` is true, render only the form internals without the outer `term-border` div, header bar, or cancel button:

```tsx
if (state === 'sent' || state === 'verifying') {
  const formContent = (
    <form onSubmit={handleVerify} className="space-y-3">
      <div className="text-[#00ff41] text-sm font-mono font-bold">Code sent to {email}</div>
      <div className="text-[#00aa28] text-sm font-mono leading-relaxed">
        Check your email for a 6-digit code and enter it below.
      </div>
      <div className="text-[#00aa28]/60 text-xs font-mono leading-relaxed">
        Don&apos;t see it? Check your Junk/Spam folder.
      </div>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErrorMsg(''); }}
        placeholder="000000"
        autoFocus
        className="w-full bg-transparent border border-[rgba(0,255,65,0.25)] px-3 py-3 text-[#00ff41] font-mono text-xl tracking-[0.4em] placeholder:text-[#003a0e] focus:outline-none focus:border-[rgba(0,255,65,0.6)] text-center"
      />
      {errorMsg && <div className="text-[#ff3333] text-sm font-mono">{errorMsg}</div>}
      <button
        type="submit"
        disabled={state === 'verifying'}
        className="w-full py-3 term-border text-[#00ff41] font-mono font-bold text-sm tracking-widest hover:bg-[rgba(0,255,65,0.05)] disabled:opacity-40"
      >
        {state === 'verifying' ? 'VERIFYING...' : '[ VERIFY ]'}
      </button>
      <button
        type="button"
        onClick={() => { setState('idle'); setCode(''); setErrorMsg(''); }}
        className="w-full text-[#00aa28] text-xs font-mono hover:text-[#00ff41] transition-colors"
      >
        use different email
      </button>
    </form>
  );

  if (headless) return formContent;

  return (
    <div className="term-border bg-[#060c06]">
      <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
        <span className="text-[#00aa28] text-sm tracking-widest">ENTER_CODE</span>
        <button onClick={onCancel} aria-label="Close verification" className="text-[#00aa28] text-sm font-mono hover:text-[#00ff41] p-1">✕</button>
      </div>
      <div className="px-3 py-4">
        {formContent}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Make the email input view (lines 81-110) conditional on `headless`**

Replace the idle/error return block (lines 81-110). Same pattern — headless renders only the form:

```tsx
const formContent = (
  <form onSubmit={handleSubmit} className="space-y-3">
    <input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="operator@terminal.sh"
      autoFocus
      className="w-full bg-transparent border border-[rgba(0,255,65,0.25)] px-3 py-2.5 text-[#00ff41] font-mono text-base placeholder:text-[#003a0e] focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
    />
    {state === 'error' && (
      <div className="text-[#ff3333] text-sm font-mono">{errorMsg}</div>
    )}
    <button
      type="submit"
      disabled={state === 'loading'}
      className="w-full py-3 term-border text-[#00ff41] font-mono font-bold text-sm tracking-widest hover:bg-[rgba(0,255,65,0.05)] disabled:opacity-40"
    >
      {state === 'loading' ? 'SENDING...' : '[ SEND CODE ]'}
    </button>
  </form>
);

if (headless) return formContent;

return (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
      <span className="text-[#00aa28] text-sm tracking-widest">CLAIM_PROFILE</span>
      <button onClick={onCancel} aria-label="Close sign-in" className="text-[#00aa28] text-sm font-mono hover:text-[#00ff41] p-1">✕</button>
    </div>
    <div className="px-3 py-3">
      {formContent}
    </div>
  </div>
);
```

Note: the existing description text ("No password. We'll email you a 6-digit code...") is omitted from `formContent` — the inline wrapper in StartScreen provides its own messaging. The non-headless path wraps `formContent` in the original `px-3 py-3` padding div to preserve the current layout.

- [ ] **Step 4: Verify the build compiles**

Run: `npx next build 2>&1 | head -20`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add components/AuthFlow.tsx
git commit -m "feat: add headless prop to AuthFlow for inline usage"
```

---

## Chunk 2: StartScreen — Inline Onboarding

### Task 3: Rewrite StartScreen — remove top cards + add inline onboarding

**Files:**
- Modify: `components/StartScreen.tsx`

- [ ] **Step 1: Replace `showAuthFlow` state with `showInlineAuth`**

At line 55, change:
```tsx
const [showAuthFlow, setShowAuthFlow] = useState(false);
```
to:
```tsx
const [showInlineAuth, setShowInlineAuth] = useState(false);
```

- [ ] **Step 2: Add a ref for scrollIntoView**

After the existing state declarations (around line 64), add:
```tsx
const inlineAuthRef = useRef<HTMLDivElement>(null);
```

The `useRef` import already exists at line 1.

- [ ] **Step 3: Add a useEffect for scrollIntoView**

After the existing useEffect blocks (around line 121), add:
```tsx
// Scroll inline onboarding block into view when it mounts
useEffect(() => {
  if (inlineAuthRef.current) {
    inlineAuthRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}, [showInlineAuth, signedIn]);
```

This fires when `showInlineAuth` changes (State 1 appears) and when `signedIn` changes (State 1 → State 2 transition).

- [ ] **Step 4: Fix the SFX toggle condition**

At line 224, change:
```tsx
{!signedIn && !showAuthFlow && (
```
to:
```tsx
{!signedIn && (
```

- [ ] **Step 5: Remove the top-of-page profile card branches for unsigned/no-callsign users**

Replace the entire profile card conditional block (lines 236-336). The block currently has 4 branches:
1. `signedIn && !displayName` → SET_CALLSIGN form (remove — moved inline)
2. `signedIn && profile` → XP bar profile card (keep)
3. `showAuthFlow` → AuthFlow (remove — moved inline)
4. else → SIGN IN TO SAVE YOUR SCORE button (remove — replaced by inline)

Replace lines 236-336 with just the signed-in-with-displayName branch:

```tsx
{!playerLoading && signedIn && profile?.displayName && (
  <div className="anim-fade-in-up">
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
          <button onClick={toggleSound} aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'} className={`lg:hidden text-sm font-mono transition-colors ${soundEnabled ? 'text-[#00ff41]' : 'text-[#1a5c2a]'}`}>{soundEnabled ? '[SFX]' : '[SFX OFF]'}</button>
          <button onClick={async () => { await signOut(); }} className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55]">SIGN OUT</button>
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
  </div>
)}
```

Note: `setShowAuthFlow(false)` removed from the sign-out handler (was on old line 306).

- [ ] **Step 6: Update the Play button handler to use `showInlineAuth`**

At line 424 (inside the Play button onClick), change:
```tsx
if (!signedIn) { setShowAuthFlow(true); return; }
```
to:
```tsx
if (!signedIn) { setShowInlineAuth(true); return; }
```

- [ ] **Step 7: Replace the unsigned-in hint text with the inline onboarding block**

Replace lines 436-438:
```tsx
{!signedIn && (
  <p className="text-[#1a5c2a] text-sm text-center font-mono">sign in to contribute to the research study</p>
)}
```

With the inline onboarding block that handles both State 1 (sign-in) and State 2 (callsign):

```tsx
{/* Inline onboarding: sign-in (State 1) or callsign setup (State 2) */}
{!signedIn && showInlineAuth && (
  <div ref={inlineAuthRef} className="anim-slide-down term-border bg-[#060c06] border-[rgba(255,170,0,0.5)]">
    <div className="px-3 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[#ffaa00] text-sm font-mono font-bold tracking-widest">SIGN IN TO START</div>
        <button onClick={() => setShowInlineAuth(false)} aria-label="Close sign-in" className="text-[#ffaa00] text-sm font-mono hover:text-[#cc8800] p-1">✕</button>
      </div>
      <div className="text-[#33bb55] text-sm font-mono">New or returning — enter your email to begin or continue</div>
      <div className="space-y-1 text-sm font-mono">
        <div className="text-[#33bb55]"><span className="text-[#ffaa00]">▸</span> Track your XP + climb the leaderboard</div>
        <div className="text-[#33bb55]"><span className="text-[#ffaa00]">▸</span> Contribute to phishing research</div>
        <div className="text-[#33bb55]"><span className="text-[#ffaa00]">▸</span> Unlock Daily Challenge + Expert Mode</div>
      </div>
      <div className="text-[#cc8800] text-xs font-mono">Magic code · no password · 10 seconds</div>
      <AuthFlow headless onSignIn={signInWithEmail} onVerifyCode={verifyOtp} onCancel={() => setShowInlineAuth(false)} />
    </div>
  </div>
)}
{signedIn && profile && !profile.displayName && (
  <div ref={inlineAuthRef} className="anim-slide-down term-border bg-[#060c06]">
    <div className="px-3 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[#33bb55] text-sm tracking-widest">SET_CALLSIGN</span>
        <button onClick={async () => { await signOut(); setShowInlineAuth(false); }} aria-label="Cancel setup" className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55] p-1">✕</button>
      </div>
      <div className="text-[#1a5c2a] text-sm font-mono">Choose a callsign. Shown on the XP leaderboard. 1–20 characters.</div>
      <form onSubmit={handleSetCallsign} className="flex gap-2">
        <input
          type="text"
          value={callsign}
          onChange={(e) => { setCallsign(e.target.value); setCallsignError(''); }}
          placeholder="ENTER CALLSIGN"
          maxLength={20}
          autoFocus
          className="flex-1 bg-transparent border border-[rgba(0,255,65,0.3)] text-[#00ff41] font-mono text-sm px-2 py-1.5 placeholder:text-[#003a0e] focus:outline-none focus:border-[rgba(0,255,65,0.7)]"
        />
        <button
          type="submit"
          disabled={!callsign.trim() || !background || callsignLoading}
          className="px-3 py-1.5 term-border text-[#00ff41] font-mono text-sm tracking-widest hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {callsignLoading ? '...' : 'SET'}
        </button>
      </form>
      <div className="space-y-1.5 pt-1">
        <div className="text-[#33bb55] text-sm font-mono tracking-wider">BACKGROUND <span className="text-[#ffaa00]">*REQUIRED</span></div>
        <div className="text-[#33bb55] text-sm font-mono leading-relaxed opacity-70">Required for research. Helps us understand how expertise affects detection accuracy. Not stored with any personal information.</div>
        <div className="grid grid-cols-2 gap-1.5">
          {BACKGROUND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBackground(background === opt.value ? null : opt.value)}
              className={`py-1.5 font-mono text-sm tracking-wider transition-all border ${
                background === opt.value
                  ? 'text-[#00ff41] border-[rgba(0,255,65,0.8)] bg-[rgba(0,255,65,0.08)]'
                  : 'text-[#33bb55] border-[rgba(0,255,65,0.35)] hover:text-[#00ff41] hover:border-[rgba(0,255,65,0.5)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {callsignError && <div className="text-[#ff3333] text-sm font-mono">{callsignError}</div>}
    </div>
  </div>
)}
```

- [ ] **Step 8: Verify the build compiles**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "feat: replace top-of-page sign-in with inline onboarding below Play"
```

---

## Chunk 3: Manual Testing + Final Commit

### Task 4: Manual smoke test

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

Run: `npx next dev`

- [ ] **Step 2: Test new player flow (unsigned-in)**

Open the app in a browser. Clear any existing session (open DevTools → Application → Storage → Clear site data).

1. Page loads → no sign-in card at top, just How to Play and Play button
2. Tap `[ PLAY ]` → inline auth block slides down below Play with progression hooks
3. Verify messaging: "SIGN IN TO START", subtitle, bullet points, reassurance line
4. Enter email → tap `[ SEND CODE ]` → verify OTP screen appears inline
5. Enter code → authenticated → inline block transitions to SET_CALLSIGN form
6. Set callsign + background → tap SET → inline block disappears, profile card appears at top
7. Tap `[ PLAY ]` → game starts

- [ ] **Step 3: Test returning player flow**

Sign out. Tap `[ PLAY ]` again. Enter the same email. Verify that after OTP, the callsign step is skipped (displayName already exists) and the game is ready to play.

- [ ] **Step 4: Test cancel flows**

- Tap Play → inline auth appears → tap ✕ → form disappears
- Tap Play again → inline auth reappears
- Sign in → callsign form appears → tap ✕ → signs out, form disappears

- [ ] **Step 5: Test mobile viewport**

Use Chrome DevTools device toolbar (iPhone SE or similar). Verify:
- The inline block scrolls into view after appearing
- No content is cut off
- The animation is smooth

- [ ] **Step 6: Test desktop**

Expand to full desktop width. Verify:
- No sign-in card at top for unsigned-in users
- Inline auth works the same way below Play
- Two-column layout is intact

- [ ] **Step 7: Squash or create final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address smoke test issues"
```

(Only if fixes were needed. Skip if all tests passed cleanly.)

---

### Task 5: Create feature branch and clean up

- [ ] **Step 1: Verify all changes are committed**

Run: `git status`
Expected: Clean working tree.

- [ ] **Step 2: Review the full diff**

Run: `git log --oneline master..HEAD` (if on a branch) or `git log --oneline -5`
Expected: 2-3 commits covering CSS animation, AuthFlow headless, and StartScreen inline onboarding.
