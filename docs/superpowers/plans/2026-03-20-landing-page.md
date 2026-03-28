# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated landing page at `/` that converts strangers into research participants, moving the game to `/play`.

**Architecture:** Restructure routes using Next.js route groups — `(landing)` for the landing page with clean modern styling, `(game)` for all game pages with terminal CRT effects. Root layout becomes a bare shell (keeping only GeistMono font, Analytics, ServiceWorker). Middleware redirects signed-in users from `/` to `/play`.

**Tech Stack:** Next.js App Router, Tailwind CSS, Inter + JetBrains Mono via next/font/google, Supabase (existing), Redis (existing)

**Spec:** `docs/superpowers/specs/2026-03-20-landing-page-design.md`

---

## File Structure

### New files
- `app/(landing)/page.tsx` — landing page
- `app/(landing)/layout.tsx` — clean layout (Inter font, no CRT)
- `app/(game)/layout.tsx` — game layout (all providers, NavBar, CRT)
- `app/(game)/play/page.tsx` — game entry (moved from `app/page.tsx`)
- `app/api/public-stats/route.ts` — public research stats API

### Moved files (into `(game)` route group)
- `app/page.tsx` → `app/(game)/play/page.tsx`
- `app/stats/page.tsx` → `app/(game)/stats/page.tsx`
- `app/profile/page.tsx` → `app/(game)/profile/page.tsx`
- `app/changelog/page.tsx` → `app/(game)/changelog/page.tsx`
- `app/methodology/page.tsx` → `app/(game)/methodology/page.tsx`
- `app/intel/` → `app/(game)/intel/`
- `app/admin/` → `app/(game)/admin/`

### NOT moved (stays at root)
- `app/not-found.tsx` — stays at root (global 404 must be at app root in Next.js). Update its link from `/` to `/play`.
- `app/auth/` — stays at root (OAuth callback, transient redirect page, doesn't need game providers)
- `app/opengraph-image.tsx` — stays at root (applies to landing page which is the primary share target)

### Modified files
- `app/layout.tsx` — strip to bare shell (html, body, GeistMono font, Analytics, ServiceWorker)
- `app/globals.css` — scope CRT styles (pseudo-elements + body terminal colors) to `.crt-active` class
- `app/not-found.tsx` — update link from `/` to `/play`
- `middleware.ts` — add `/` → `/play` redirect for authenticated users (after line 26 getUser call, before line 42 admin check)
- `components/NavBar.tsx` — HOME link from `/` to `/play`
- `app/sitemap.ts` — add `/play` route

---

## Task 1: Create feature branch

- [ ] **Step 1: Create branch from master**

```bash
git checkout master && git pull
git checkout -b feat/landing-page
```

- [ ] **Step 2: Verify clean state**

```bash
git status
```

Expected: clean working tree

---

## Task 2: Scope CRT and terminal styles to a class

The `globals.css` has CRT pseudo-elements and terminal body styles applied unconditionally. These must be scoped so the landing page doesn't inherit them.

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Scope CRT pseudo-elements**

Change:
- `body::before` → `.crt-active::before`
- `body::after` → `.crt-active::after`

- [ ] **Step 2: Scope terminal body styles**

The `body` styles that set terminal-specific colors/font (background `var(--c-bg)`, color `var(--c-primary)`, font-family GeistMono) must also be scoped to `.crt-active`. Leave only truly universal body styles (margin: 0, etc.) on `body` itself.

This ensures the landing page gets a clean slate — it will set its own background (`#09090b`), color, and font via its layout wrapper.

- [ ] **Step 3: Verify build passes**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "refactor: scope CRT and terminal styles to .crt-active class"
```

---

## Task 3: Restructure layouts (root + game) — atomic task

**IMPORTANT:** Tasks 3 and 4 must be done together in a single commit. Between stripping the root layout and creating the game layout, all pages will be broken.

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/(game)/layout.tsx`

- [ ] **Step 1: Rewrite root layout**

The root layout should contain ONLY:
- `<html>` with lang, GeistMono font className
- `<body>` with minimal styles (no terminal-specific classes)
- `<Analytics />` (Vercel)
- `<ServiceWorker />`
- `{children}`

Remove from root layout (will go into game layout):
- `PlayerProvider`, `ThemeProvider`, `NavVisibilityProvider`
- `NavBar`
- `TerminalSounds`
- Scanline sweep overlay div

Keep the GeistMono font definition — the game layout inherits it.
Keep the existing `metadata` export for now — we'll update it later.

- [ ] **Step 2: Create game layout**

Create `app/(game)/layout.tsx` containing all the providers, NavBar, CRT effects, and terminal sounds removed from root layout. Wrap children in a div with `className="crt-active"` so the scoped CSS applies.

Import and wrap in this order (same as original root layout):
1. `TerminalSounds`
2. Scanline sweep overlay div
3. `PlayerProvider`
4. `ThemeProvider`
5. `NavVisibilityProvider`
6. `NavBar`
7. `{children}`

The outer wrapper div gets `className="crt-active"`.

- [ ] **Step 3: Verify build passes**

```bash
npx next build
```

Expected: Root page may be empty but build should pass. Game pages won't exist under `(game)` yet.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/\(game\)/layout.tsx
git commit -m "refactor: split root layout into bare shell + game layout"
```

---

## Task 4: Move game pages to (game) route group

**Files:**
- Move: all game pages (see file structure above)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p app/\(game\)/play
mkdir -p app/\(game\)/stats
mkdir -p app/\(game\)/profile
mkdir -p app/\(game\)/changelog
mkdir -p app/\(game\)/methodology
```

- [ ] **Step 2: Move game page**

```bash
mv app/page.tsx app/\(game\)/play/page.tsx
```

- [ ] **Step 3: Move single-file page directories**

```bash
mv app/stats/page.tsx app/\(game\)/stats/ && rm -rf app/stats
mv app/profile/page.tsx app/\(game\)/profile/ && rm -rf app/profile
mv app/changelog/page.tsx app/\(game\)/changelog/ && rm -rf app/changelog
mv app/methodology/page.tsx app/\(game\)/methodology/ && rm -rf app/methodology
```

- [ ] **Step 4: Move intel directory**

```bash
cp -r app/intel app/\(game\)/intel && rm -rf app/intel
```

- [ ] **Step 5: Move admin directory**

```bash
cp -r app/admin app/\(game\)/admin && rm -rf app/admin
```

- [ ] **Step 6: Verify build passes**

```bash
npx next build
```

Expected: All routes work. `/play` serves the game, `/stats`, `/profile`, etc. all work with terminal styling.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move game pages to (game) route group"
```

---

## Task 5: Update NavBar and not-found links

**Files:**
- Modify: `components/NavBar.tsx`
- Modify: `app/not-found.tsx`

- [ ] **Step 1: Change NavBar HOME path from `/` to `/play`**

Find the NAV_LINKS array entry for HOME and change `path: '/'` to `path: '/play'` and update the `match` function accordingly.

- [ ] **Step 2: Update not-found.tsx link**

Change the "BACK TO TERMINAL" link from `href="/"` to `href="/play"`.

- [ ] **Step 3: Verify build passes**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add components/NavBar.tsx app/not-found.tsx
git commit -m "fix: update HOME and 404 links to /play"
```

---

## Task 6: Add middleware redirect for authenticated users

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add redirect logic**

Place this AFTER the existing `supabase.auth.getUser()` call (line 26) and BEFORE the admin route check (line 42):

```typescript
// Signed-in users on landing page → redirect to game
if (pathname === '/' && user) {
  const url = req.nextUrl.clone();
  url.pathname = '/play';
  return NextResponse.redirect(url);
}
```

This uses the `user` variable already computed by the existing auth check.

- [ ] **Step 2: Verify build passes**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: redirect authenticated users from / to /play"
```

---

## Task 7: Create public stats API

**Files:**
- Create: `app/api/public-stats/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `GET /api/public-stats` that returns:
```json
{
  "participants": 523,
  "totalAnswers": 4891,
  "overallAccuracy": 62,
  "byTechnique": []
}
```

Implementation:
- Use `getSupabaseAdminClient()` for DB access
- Use aggregate queries (NOT `fetchAllRows`):
  - `supabase.from('players').select('id', { count: 'exact', head: true }).gte('research_sessions_completed', 1)` for participants
  - `supabase.from('answers').select('id', { count: 'exact', head: true }).eq('game_mode', 'research')` for totalAnswers
  - `supabase.from('answers').select('id', { count: 'exact', head: true }).eq('game_mode', 'research').eq('correct', true)` for correct count
- Compute accuracy: `Math.round((correct / total) * 100)`
- Use Next.js route segment config: `export const revalidate = 300` (5-minute ISR cache)
- Add IP rate limiting: 20 requests per minute via Redis (same pattern as other endpoints)
- Return empty `byTechnique: []` (intentionally withheld to avoid priming participants)

- [ ] **Step 2: Verify build passes**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/public-stats/route.ts
git commit -m "feat: add public stats API for landing page"
```

---

## Task 8: Create landing page layout

**Files:**
- Create: `app/(landing)/layout.tsx`

- [ ] **Step 1: Create the landing layout**

Create `app/(landing)/layout.tsx` with:
- Inter font via `next/font/google` (weights 400, 500, 600, 700, 800)
- JetBrains Mono via `next/font/google` (weights 400, 500)
- CSS variables for both fonts on the wrapper div
- Own metadata: title "Threat Terminal — Can You Spot AI-Generated Phishing?", description, OG tags
- Wrapper div with `background: #09090b`, `color: #fafafa`, Inter font family
- No providers, no NavBar, no CRT effects

- [ ] **Step 2: Verify build passes**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add app/\(landing\)/layout.tsx
git commit -m "feat: add landing page layout with clean modern styling"
```

---

## Task 9: Build the landing page

This is the largest task. Reference the mockup at `.superpowers/brainstorm/1546-1774034086/landing-mockup.html` for visual design.

**Files:**
- Create: `app/(landing)/page.tsx`

- [ ] **Step 1: Build the landing page component**

Create `app/(landing)/page.tsx`. Use Tailwind CSS for all styling. Sections:

1. **Nav bar** — fixed top, `backdrop-blur`, logo (green square icon + "Threat Terminal" text), "How It Works" / "Research" anchor links, "Start Playing" CTA button → `/play`. Hidden links on mobile, CTA always visible.

2. **Hero** — badge "Live research study — [N] participants" with green pulse dot (N from public-stats API), headline "Can you spot AI‑generated phishing?", subtitle text, primary CTA "Take the Challenge" → `/play`, secondary "Learn About the Research" → `#research`, static terminal preview mockup below.

3. **Terminal preview** — styled div (not image, not interactive). Dark green background, fake window chrome (3 dots), monospace font. Shows: FROM header, SUBJ header, AUTH status (SPF/DKIM/DMARC: NONE in amber), body text with a suspicious URL, PHISHING/LEGIT buttons with `pointer-events-none`. Use JetBrains Mono CSS variable for monospace text.

4. **Stats** — 3 cards in a row: participants, accuracy %, total answers. Numbers styled large with green gradient text. Fetched server-side from the public-stats API using `fetch` with `next: { revalidate: 300 }`.

5. **How it works** — 3-step grid with numbered icons (1, 2, 3), heading, description.

6. **About the research** — centered text, 2 paragraphs, author link.

7. **Final CTA** — "Think you'd do better?", subtitle, CTA button.

Mobile: all grids collapse to single column. Terminal preview scales down.

- [ ] **Step 2: Verify the page renders locally**

```bash
npx next dev
```

Visit `http://localhost:3000` — should see the landing page.

- [ ] **Step 3: Verify build passes**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add app/\(landing\)/page.tsx
git commit -m "feat: build landing page with hero, stats, and research sections"
```

---

## Task 10: Update sitemap

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Add /play to sitemap**

Add an entry for `/play` alongside existing routes.

- [ ] **Step 2: Verify build passes**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "chore: add /play to sitemap"
```

---

## Task 11: Final verification and push

- [ ] **Step 1: Full build check**

```bash
npx next build
```

- [ ] **Step 2: Test key flows**

Start dev server and verify:
1. `http://localhost:3000/` — shows landing page (not signed in)
2. Landing page stats section shows data
3. "Take the Challenge" navigates to `/play`
4. `/play` shows the game with full terminal CRT effects
5. `/stats`, `/profile`, `/changelog` all work with terminal styling
6. NavBar HOME link goes to `/play`
7. 404 page works and links to `/play`
8. Sign in → visit `/` → redirects to `/play`
9. Mobile responsive: landing page sections stack correctly

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/landing-page
```

- [ ] **Step 4: Open PR for preview testing**

```bash
gh pr create --title "feat: landing page for research recruitment" --body "..."
```

Test on Vercel preview URL, especially on mobile.
