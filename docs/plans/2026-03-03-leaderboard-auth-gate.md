# Leaderboard Auth Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restrict leaderboard submission to signed-in users; guests see an inline sign-in prompt instead of a name input form.

**Architecture:** Single file change in `RoundSummary.tsx`. Signed-in users auto-submit on mount using their callsign (same pattern as XP submission). Guests see the existing `AuthFlow` component embedded inline with a short prompt. No pending score logic — the sign-up round is not submitted.

**Tech Stack:** Next.js App Router, React, `usePlayer` context (`lib/PlayerContext.tsx`), `AuthFlow` component (`components/AuthFlow.tsx`)

---

### Task 1: Replace leaderboard submission section in RoundSummary.tsx

**Files:**
- Modify: `components/RoundSummary.tsx`

**Context:**

The leaderboard submission section lives at lines ~258–291. Currently it renders a name input form for everyone.

`usePlayer()` already returns `signedIn`, `profile`, and `signInWithEmail` — all used in this component.

The auto-submit pattern already exists in this file for XP (see `xpFired` ref + `useEffect` on `signedIn`). Follow the same pattern.

`AuthFlow` accepts `onSignIn: (email: string) => Promise<{ error: string | null }>` and `onCancel: () => void`. `signInWithEmail` from `usePlayer()` matches the `onSignIn` signature exactly.

**Step 1: Add a leaderboard submission ref (prevents double-submit)**

Below the existing `xpFired` ref declaration (line 47), add:

```tsx
const leaderboardFired = useRef(false);
```

**Step 2: Add auto-submit useEffect for signed-in users**

Add this `useEffect` after the existing XP `useEffect` block (after line 85):

```tsx
useEffect(() => {
  if (!signedIn || !profile?.display_name || leaderboardFired.current) return;
  leaderboardFired.current = true;
  fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: profile.display_name,
      score: totalScore,
      ...(mode === 'daily' ? { date } : {}),
    }),
  })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data) {
        setSubmitState('done');
        Promise.all([
          fetch('/api/leaderboard').then(r => r.ok ? r.json() : []),
          fetch(`/api/leaderboard?date=${date}`).then(r => r.ok ? r.json() : []),
        ]).then(([global, daily]) => {
          setGlobalLeaderboard(global);
          setDailyLeaderboard(daily);
        }).catch(() => {});
      }
    })
    .catch(() => {});
}, [signedIn, profile?.display_name]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Step 3: Replace the leaderboard submission JSX section**

Find the entire `{/* Leaderboard submission */}` block (lines ~258–291):

```tsx
{/* Leaderboard submission */}
<div className="term-border bg-[#060c06]">
  <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
    <span className="text-[#00aa28] text-xs tracking-widest">SUBMIT_TO_LEADERBOARD</span>
  </div>
  <div className="px-3 py-3">
    {submitState === 'done' ? (
      <div className="text-[#00ff41] text-xs font-mono text-center glow py-1">
        SCORE LOGGED. GL HF.
      </div>
    ) : (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input ... />
        <button ...>LOG</button>
      </form>
    )}
    {submitState === 'error' && (
      <div className="text-[#ff3333] text-[10px] font-mono mt-1.5">{errorMsg}</div>
    )}
  </div>
</div>
```

Replace it with:

```tsx
{/* Leaderboard submission */}
{signedIn ? (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
      <span className="text-[#00aa28] text-xs tracking-widest">SUBMIT_TO_LEADERBOARD</span>
    </div>
    <div className="px-3 py-3">
      {submitState === 'done' ? (
        <div className="text-[#00ff41] text-xs font-mono text-center glow py-1">
          SCORE LOGGED. GL HF.
        </div>
      ) : (
        <div className="text-[#003a0e] text-[10px] font-mono text-center py-1">
          SUBMITTING...
        </div>
      )}
    </div>
  </div>
) : (
  <div className="term-border bg-[#060c06]">
    <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
      <span className="text-[#00aa28] text-xs tracking-widest">LEADERBOARD_ACCESS</span>
    </div>
    <div className="px-3 py-3 space-y-3">
      <div className="text-[#003a0e] text-[10px] font-mono">
        SIGN IN TO APPEAR ON FUTURE LEADERBOARDS
      </div>
      <AuthFlow onSignIn={signInWithEmail} onCancel={() => {}} />
    </div>
  </div>
)}
```

**Step 4: Remove dead code**

The `handleSubmit` function, `name` state, and `errorMsg` state are no longer used. Remove them:

- Remove `const [name, setName] = useState('');` (line 36)
- Remove `const [errorMsg, setErrorMsg] = useState('');` (line 38)
- Remove the entire `async function handleSubmit(e: React.FormEvent) { ... }` block (lines 87–120)

**Step 5: Verify AuthFlow import is present**

`AuthFlow` is already imported at line 8. Confirm `signInWithEmail` is destructured from `usePlayer()` at line 43. It currently reads:

```tsx
const { profile, signedIn, refreshProfile } = usePlayer();
```

Update to include `signInWithEmail`:

```tsx
const { profile, signedIn, refreshProfile, signInWithEmail } = usePlayer();
```

**Step 6: Build check**

```bash
cd "/c/Users/scott/Github Projects/phish-or-not" && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, build succeeds.

**Step 7: Commit**

```bash
git add components/RoundSummary.tsx
git commit -m "feat: restrict leaderboard to signed-in users, show auth prompt for guests"
```

---

### Task 2: Manual verification

**Signed-in flow:**
1. Sign in via magic link on StartScreen
2. Play a round
3. On RoundSummary, confirm "SCORE LOGGED. GL HF." appears automatically (no form)
4. Check leaderboard section below — confirm the submitted score appears

**Guest flow:**
1. Sign out (or open incognito)
2. Play a round
3. On RoundSummary, confirm the name input form is gone
4. Confirm "SIGN IN TO APPEAR ON FUTURE LEADERBOARDS" message + AuthFlow email input appears
5. Confirm the leaderboard section still renders below (showing existing scores)

**Edge case — no callsign:**
If a signed-in player somehow has no `display_name`, the `useEffect` guard `profile?.display_name` prevents auto-submit. The "SUBMITTING..." text stays visible. This is acceptable — the callsign form on StartScreen is mandatory, so this shouldn't occur in practice.
