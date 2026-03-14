# Persistent Navigation Bar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent navigation bar — top bar on desktop, bottom tab bar on mobile — that hides during gameplay.

**Architecture:** A `NavBar` client component in `layout.tsx` reads `usePathname()` for active state and a new `NavVisibilityContext` to hide during gameplay. The `Game` component signals nav visibility based on its phase state. Per-page back links are removed since the nav replaces them.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, `next/navigation`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/NavVisibilityContext.tsx` | Create | Context for hiding nav during gameplay |
| `components/NavBar.tsx` | Create | Persistent nav bar (top desktop, bottom mobile) |
| `app/layout.tsx` | Modify | Add NavVisibilityProvider + NavBar |
| `components/Game.tsx` | Modify | Signal nav hidden when phase !== 'start' |
| `components/StartScreen.tsx` | Modify | Remove desktop SFX toggles, keep mobile-only one |
| `app/stats/page.tsx` | Modify | Remove back links, add nav spacing |
| `app/profile/page.tsx` | Modify | Remove back link, add nav spacing |
| `app/intel/player/page.tsx` | Modify | Remove back links, add nav spacing |
| `app/methodology/page.tsx` | Modify | Remove back link, add nav spacing |
| `e2e/navigation.spec.ts` | Modify | Update selectors for new nav |

---

## Chunk 1: Core Infrastructure

### Task 1: Create NavVisibilityContext

**Files:**
- Create: `lib/NavVisibilityContext.tsx`

- [ ] **Step 1: Create the context file**

```tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface NavVisibilityContextValue {
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
}

const NavVisibilityContext = createContext<NavVisibilityContextValue>({
  navHidden: false,
  setNavHidden: () => {},
});

export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const [navHidden, setNavHiddenState] = useState(false);
  const setNavHidden = useCallback((hidden: boolean) => setNavHiddenState(hidden), []);
  return (
    <NavVisibilityContext.Provider value={{ navHidden, setNavHidden }}>
      {children}
    </NavVisibilityContext.Provider>
  );
}

export function useNavVisibility() {
  return useContext(NavVisibilityContext);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add lib/NavVisibilityContext.tsx
git commit -m "feat: add NavVisibilityContext for hiding nav during gameplay"
```

---

### Task 2: Create NavBar Component

**Files:**
- Create: `components/NavBar.tsx`

- [ ] **Step 1: Create the NavBar component**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlayer } from '@/lib/usePlayer';
import { useNavVisibility } from '@/lib/NavVisibilityContext';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

const NAV_LINKS = [
  { label: 'PLAY', path: '/', match: (p: string) => p === '/' },
  { label: 'STATS', path: '/stats', match: (p: string) => p.startsWith('/stats'), auth: true },
  { label: 'INTEL', path: '/intel/player', match: (p: string) => p.startsWith('/intel'), auth: true },
  { label: 'PROFILE', path: '/profile', match: (p: string) => p.startsWith('/profile'), auth: true },
];

const HIDDEN_PATHS = ['/admin', '/auth', '/intel'];

function shouldHideForPath(pathname: string): boolean {
  if (pathname === '/intel/player') return false;
  return HIDDEN_PATHS.some((p) => pathname.startsWith(p));
}

export function NavBar() {
  const pathname = usePathname();
  const { signedIn } = usePlayer();
  const { navHidden } = useNavVisibility();
  const { soundEnabled, toggleSound } = useSoundEnabled();

  if (navHidden) return null;
  if (shouldHideForPath(pathname)) return null;

  const links = NAV_LINKS.filter((link) => !link.auth || signedIn);

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-[#060c06] border-b border-[rgba(0,255,65,0.35)] px-4 py-2 items-center justify-between font-mono">
        <Link href="/" className="text-[#00ff41] text-sm font-bold tracking-widest">
          THREAT TERMINAL
        </Link>
        <div className="flex items-center gap-6">
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.path}
                href={link.path}
                aria-current={active ? 'page' : undefined}
                className={`text-sm tracking-wider transition-colors ${
                  active ? 'text-[#00ff41]' : 'text-[#1a5c2a] hover:text-[#33bb55]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            className={`text-sm transition-colors ${soundEnabled ? 'text-[#00ff41]' : 'text-[#1a5c2a] hover:text-[#33bb55]'}`}
          >
            {soundEnabled ? '[SFX]' : '[SFX OFF]'}
          </button>
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#060c06] border-t border-[rgba(0,255,65,0.35)] font-mono" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around py-2">
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.path}
                href={link.path}
                aria-current={active ? 'page' : undefined}
                className={`text-xs tracking-wider transition-colors px-2 py-1 ${
                  active ? 'text-[#00ff41]' : 'text-[#1a5c2a]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/NavBar.tsx
git commit -m "feat: add NavBar component — top bar desktop, bottom tabs mobile"
```

---

### Task 3: Wire NavBar into Layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add imports and wrap children**

Add imports at top of `app/layout.tsx`:
```tsx
import { NavVisibilityProvider } from '@/lib/NavVisibilityContext';
import { NavBar } from '@/components/NavBar';
```

Update the body content (lines 53-60) to wrap with NavVisibilityProvider and add NavBar:
```tsx
<body className={`${geistMono.variable} antialiased`}>
  <ServiceWorker />
  <TerminalSounds />
  <div className="scanline-sweep" aria-hidden="true" />
  <PlayerProvider>
    <NavVisibilityProvider>
      <NavBar />
      {children}
    </NavVisibilityProvider>
  </PlayerProvider>
  <Analytics />
</body>
```

Note: `NavVisibilityProvider` must be inside `PlayerProvider` because `NavBar` reads `usePlayer()`.

- [ ] **Step 2: Build and verify**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: wire NavBar and NavVisibilityProvider into layout"
```

---

### Task 4: Signal Nav Hidden from Game Component

**Files:**
- Modify: `components/Game.tsx:63-66`

- [ ] **Step 1: Add nav visibility import and effect**

Add import at top of `components/Game.tsx`:
```tsx
import { useNavVisibility } from '@/lib/NavVisibilityContext';
```

Inside the `Game` function body (after the existing hooks around line 75), add:
```tsx
const { setNavHidden } = useNavVisibility();

useEffect(() => {
  setNavHidden(phase !== 'start');
  return () => setNavHidden(false);
}, [phase, setNavHidden]);
```

- [ ] **Step 2: Build and verify**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/Game.tsx
git commit -m "feat: hide nav bar during active gameplay"
```

---

## Chunk 2: Cleanup & Spacing

### Task 5: Remove Back Links from Stats Page

**Files:**
- Modify: `app/stats/page.tsx:128-131,310-315`

- [ ] **Step 1: Remove header back link**

In `app/stats/page.tsx`, find the header section (around line 128-132). Change the header `div` to remove the back link:

```tsx
{/* Before: */}
<div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
  <span className="text-[#33bb55] text-sm lg:text-base tracking-widest">OPERATOR_STATS</span>
  <Link href="/" className="text-[#33bb55] text-sm font-mono hover:text-[#00ff41]">← TERMINAL</Link>
</div>

{/* After: */}
<div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
  <span className="text-[#33bb55] text-sm lg:text-base tracking-widest">OPERATOR_STATS</span>
</div>
```

- [ ] **Step 2: Remove bottom back button**

Remove the `[ BACK TO TERMINAL ]` Link block near line 310-315 entirely.

- [ ] **Step 3: Add nav spacing**

Update the outer `<main>` tag (line 125) to add spacing for the fixed nav:

```tsx
{/* Before: */}
<main className="min-h-screen bg-[#020902] flex items-start justify-center px-4 py-8">

{/* After: */}
<main className="min-h-screen bg-[#020902] flex items-start justify-center px-4 py-8 lg:pt-16 pb-20 lg:pb-8">
```

Also add the same spacing to the loading/error/empty/locked states — update each `<main>` tag in those return blocks to include `lg:pt-16 pb-20 lg:pb-8`. Remove the `← BACK TO TERMINAL` links from the early-return states (not-authenticated at ~line 69, locked at ~line 81, error at ~line 92, empty at ~line 104) since the nav bar handles navigation now.

- [ ] **Step 4: Check Link import**

The `Link` import is still needed — the locked state has a contextual link. Keep it.

- [ ] **Step 5: Build and verify**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add app/stats/page.tsx
git commit -m "refactor: remove back links from stats page, add nav spacing"
```

---

### Task 6: Remove Back Links from Profile Page

**Files:**
- Modify: `app/profile/page.tsx:186`

- [ ] **Step 1: Remove header back link**

In `app/profile/page.tsx`, find the header (around line 184-188). Remove the back link:

```tsx
{/* Before: */}
<div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
  <span className="text-[#33bb55] text-sm lg:text-base tracking-widest">OPERATOR_PROFILE</span>
  <Link href="/" className="text-[#33bb55] text-sm font-mono hover:text-[#00ff41]">← TERMINAL</Link>
</div>

{/* After: */}
<div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
  <span className="text-[#33bb55] text-sm lg:text-base tracking-widest">OPERATOR_PROFILE</span>
</div>
```

- [ ] **Step 2: Remove back link from not-authenticated state**

The early-return state (~line 111-113) has a `← BACK TO TERMINAL` link. Remove it — the nav bar handles navigation.

- [ ] **Step 3: Add nav spacing**

Update the outer `<main>` tag to add spacing:

```tsx
{/* Before: */}
<main className="min-h-screen bg-[#020902] flex items-start justify-center px-4 py-8">

{/* After: */}
<main className="min-h-screen bg-[#020902] flex items-start justify-center px-4 py-8 lg:pt-16 pb-20 lg:pb-8">
```

Also update loading/error state `<main>` tags.

- [ ] **Step 4: Build and verify**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add app/profile/page.tsx
git commit -m "refactor: remove back link from profile page, add nav spacing"
```

---

### Task 7: Remove Back Links from Intel Player Page

**Files:**
- Modify: `app/intel/player/page.tsx:66,88-91,121,154-159`

- [ ] **Step 1: Remove back links from LockedState**

In `LockedState` component, remove the `← TERMINAL` link (line 66) from the header. Keep the `[ CONTINUE RESEARCH ]` and `[ GO TO TERMINAL ]` buttons — these are contextual actions, not general nav.

- [ ] **Step 2: Remove back links from IntelContent**

In `IntelContent` component:
- Remove the `← TERMINAL` link from header (line 121)
- Remove the `[ BACK TO TERMINAL ]` Link block at the bottom (lines 154-159)

Keep the `ADMIN VIEW` link — it's specific to admin users.

- [ ] **Step 3: Add nav spacing**

Update the `<div>` wrappers in both `LockedState` and `IntelContent` to include nav spacing. Update the `min-h-screen` divs:

```tsx
{/* Add to all min-h-screen containers: */}
className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center lg:pt-16 pb-20 lg:pb-4"
```

Also update loading states.

- [ ] **Step 4: Build and verify**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add app/intel/player/page.tsx
git commit -m "refactor: remove back links from intel player page, add nav spacing"
```

---

### Task 8: Remove Back Links from Methodology Page

**Files:**
- Modify: `app/methodology/page.tsx:91,101-102`

- [ ] **Step 1: Remove back links**

Remove the `← INTEL` link from the header (line 91) and the bottom navigation links (lines 101-102: `← INTEL` and `← TERMINAL`).

- [ ] **Step 2: Add nav spacing**

Update the outer container to include nav spacing (`lg:pt-16 pb-20 lg:pb-8`).

- [ ] **Step 3: Build and verify**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/methodology/page.tsx
git commit -m "refactor: remove back links from methodology page, add nav spacing"
```

---

### Task 9: Clean Up SFX Toggles in StartScreen

**Files:**
- Modify: `components/StartScreen.tsx:178-184,211-218,228-234,296-302`

- [ ] **Step 1: Remove desktop SFX toggles, keep mobile-only**

There are 4 SFX toggle instances in StartScreen. The approach:

- **Instance 1** (Boot header, line 178-184): Keep but add `lg:hidden` — this is only visible during boot which is a special case
- **Instance 2** (Below boot unsigned, line 211-218): Keep but add `lg:hidden` — mobile fallback for unsigned users
- **Instance 3** (Callsign header, line 228-234): Remove entirely — desktop nav bar has it, mobile boot header has it
- **Instance 4** (Profile header signed-in, line 296-302): Remove entirely — desktop nav bar has it, mobile boot header has it

For instances 1 and 2, wrap or add `lg:hidden` to the button className:

```tsx
className={`lg:hidden text-sm font-mono transition-colors ${soundEnabled ? 'text-[#00ff41]' : 'text-[#1a5c2a]'}`}
```

- [ ] **Step 2: Check if `soundEnabled`/`onToggleSound` props are still needed**

The props are still needed because mobile SFX toggles remain. Keep the props.

- [ ] **Step 3: Build and verify**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "refactor: remove desktop SFX toggles from StartScreen, keep mobile-only"
```

---

## Chunk 3: Tests & Polish

### Task 10: Update E2E Navigation Tests

**Files:**
- Modify: `e2e/navigation.spec.ts`

- [ ] **Step 1: Update navigation test selectors**

The existing test at line 29-35 tests back navigation from methodology. Update it to use the nav bar instead of back links:

```typescript
test('nav bar is visible on homepage', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('nav');
  await expect(nav.first()).toBeVisible({ timeout: 10_000 });
  // PLAY link should be active
  await expect(nav.first().locator('a[aria-current="page"]')).toContainText('PLAY');
});

test('can navigate via nav bar', async ({ page }) => {
  await page.goto('/methodology');
  const nav = page.locator('nav');
  await expect(nav.first()).toBeVisible({ timeout: 10_000 });
  // Click PLAY to navigate home
  await nav.first().locator('a', { hasText: 'PLAY' }).click();
  await expect(page).toHaveURL('/');
});

test('methodology page is accessible', async ({ page }) => {
  await page.goto('/methodology');
  await expect(page.locator('body')).not.toContainText('Application error');
});
```

Keep the existing homepage and methodology content tests (lines 8-17) as they are — they test content, not navigation.

- [ ] **Step 2: Commit**

```bash
git add e2e/navigation.spec.ts
git commit -m "test: update e2e navigation tests for new nav bar"
```

---

### Task 11: Manual Testing Checklist

- [ ] **Step 1: Start dev server and verify**

Run: `npm run dev`

Test the following:

**Desktop (resize browser to >1024px):**
- [ ] Top nav bar visible on homepage (start screen)
- [ ] Top nav bar visible on /stats, /profile, /intel/player, /methodology
- [ ] Top nav bar hidden during gameplay (start a round)
- [ ] Top nav bar hidden on /admin pages
- [ ] Active link highlighted in green on each page
- [ ] SFX toggle works in nav bar
- [ ] Only PLAY visible when signed out; all 4 links when signed in
- [ ] No duplicate back links on any page

**Mobile (resize browser to <1024px):**
- [ ] Bottom tab bar visible on homepage
- [ ] Bottom tab bar visible on /stats, /profile, /intel/player
- [ ] Bottom tab bar hidden during gameplay
- [ ] Active link highlighted
- [ ] SFX toggle visible on start screen (mobile only)
- [ ] Safe area spacing on notched devices (if available to test)

- [ ] **Step 2: Final build check**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit any fixes, then push**

```bash
git push
```
