# Landing Page Design Spec

## Goal

Replace the current game-as-homepage with a dedicated landing page that converts strangers into research participants. The game moves to `/play`. Signed-in users skip the landing page entirely.

## Audience

Cybersecurity professionals, tech workers, and students — anyone interested in phishing detection. The page must work for all three without jargon that excludes any group.

## Tone

Hybrid — professional research credibility paired with a compelling challenge CTA. Serious enough for an academic audience, provocative enough to make a Redditor click.

## Architecture

### Route groups

Use Next.js route groups to give the landing page and the game separate layouts:

- **`app/(landing)/`** — landing page with clean modern styling, no CRT effects
- **`app/(game)/`** — all game pages with terminal theme, CRT effects, nav bar

### Routes

| Path | Route group | Content | Who sees it |
|------|------------|---------|-------------|
| `/` | `(landing)` | Landing page | Unauthenticated visitors |
| `/play` | `(game)` | Game (StartScreen + Game) | All players (auth optional) |
| `/stats` | `(game)` | Stats page | Signed-in players |
| `/profile` | `(game)` | Profile page | Signed-in players |
| `/intel/player` | `(game)` | Intel page | Signed-in players |
| `/changelog` | `(game)` | Changelog | All players |
| `/methodology` | `(game)` | Methodology | All visitors |
| `/admin/*` | `(game)` | Admin pages | Admin only |

`/play` is accessible to unauthenticated users — the StartScreen handles auth state gracefully (shows sign-up prompt).

### Middleware redirect

Signed-in users hitting `/` are redirected to `/play` via `middleware.ts`. Detection uses the existing Supabase auth cookie check already in middleware.

### Layout restructuring (Option A — clean separation)

**Root layout (`app/layout.tsx`)** becomes a bare shell:
- `<html>` and `<body>` tags
- Vercel Analytics
- ServiceWorker registration
- No CRT effects, no providers, no NavBar

**Game layout (`app/(game)/layout.tsx`)** gets all game chrome:
- PlayerProvider, ThemeProvider, NavVisibilityProvider
- NavBar
- TerminalSounds
- CRT scanline sweep overlay
- GeistMono font
- `crt-active` class on wrapper div

**Landing layout (`app/(landing)/layout.tsx`)** gets clean styling:
- Inter + JetBrains Mono fonts (via `next/font/google`)
- No CRT effects, no providers, no NavBar
- Own metadata (title, OG tags)

### CRT CSS refactoring

The `globals.css` CRT pseudo-elements (`body::before` scanlines, `body::after` vignette) are currently unconditional on `body`. These must be scoped to a class (e.g., `.crt-active::before`, `.crt-active::after`) so the landing page doesn't inherit them. The `(game)` layout applies this class to its wrapper.

### New files

- `app/(landing)/page.tsx` — landing page (server component with client stats fetcher)
- `app/(landing)/layout.tsx` — clean layout with Inter/JetBrains Mono
- `app/(game)/layout.tsx` — game layout with all providers, NavBar, CRT effects
- `app/(game)/play/page.tsx` — game entry point (content from current `app/page.tsx`)
- `app/api/public-stats/route.ts` — public research stats endpoint

### Moved files

- `app/page.tsx` → `app/(game)/play/page.tsx`
- `app/stats/page.tsx` → `app/(game)/stats/page.tsx`
- `app/profile/page.tsx` → `app/(game)/profile/page.tsx`
- `app/intel/` → `app/(game)/intel/`
- `app/changelog/` → `app/(game)/changelog/`
- `app/methodology/` → `app/(game)/methodology/`
- `app/admin/` → `app/(game)/admin/`
- Game providers and NavBar move from root layout to `app/(game)/layout.tsx`

### NavBar update

The HOME link in `components/NavBar.tsx` changes from `/` to `/play`.

### Unchanged

- All game components (StartScreen, Game, GameCard, etc.) — no modifications
- All API routes (except new public-stats) — unchanged

## Landing page design

### Visual style

- **Dark background**: `#09090b` (zinc-950)
- **Typography**: Inter (sans-serif) via `next/font/google` for body, JetBrains Mono for terminal preview elements
- **Accent color**: `#00ff41` (same green as the game, used sparingly)
- **No CRT effects** — no scanlines, no phosphor glow, no flicker
- **Clean modern aesthetic** — rounded corners, subtle borders, backdrop blur nav

### Sections (top to bottom)

#### 1. Navigation bar (fixed)

- Logo: green icon + "Threat Terminal" text
- Links: How It Works, Research
- CTA button: "Start Playing" → `/play`

#### 2. Hero

- Badge: "Live research study — [N] participants" (live count, green dot pulse)
- Headline: "Can you spot AI‑generated phishing?"
- Subtitle: "Grammar is perfect. Spelling is flawless. The only way to catch modern phishing is forensic analysis. Test your skills and contribute to real research."
- Primary CTA: "Take the Challenge" → `/play`
- Secondary CTA: "Learn About the Research" → scrolls to research section
- Terminal preview: static styled `<div>` mockup of a phishing email card with PHISHING/LEGIT buttons. Built with HTML/CSS, not a screenshot or image. Not interactive — `pointer-events: none` on the buttons.

#### 3. Live research stats

- Heading: "What we've found so far"
- Subtitle: "Real data from real participants — updated live"
- 3 stat cards in a row: participant count, average accuracy, total answers collected
- No technique-level breakdown — revealing which techniques fool people most would prime participants and spoil research findings
- Data source: `GET /api/public-stats` (cached 5 minutes)

#### 4. How it works

- 3-step grid:
  1. Read the email — "AI-generated emails — some phishing, some legitimate. Grammar and spelling will be perfect in both."
  2. Make your call — "Use forensic tools — sender verification, URL inspection, header analysis — to decide: phishing or legit?"
  3. See how you compare — "Get instant feedback, earn XP, climb the leaderboard. After 30 answers, unlock Expert mode and full research analytics."

#### 5. About the research

- Heading: "About the research"
- 2 paragraphs explaining the study (what and why)
- Author credit: "A research project by Scott Altiparmak" with link

#### 6. Final CTA

- Heading: "Think you'd do better?"
- Subtitle: "Most people score under 65%. Five minutes. Thirty emails."
- CTA button: "Take the Challenge →" → `/play`

## Public stats API

### `GET /api/public-stats`

Returns anonymized aggregate research data. No admin authentication required.

**Response:**
```json
{
  "participants": 523,
  "totalAnswers": 4891,
  "overallAccuracy": 62,
  "byTechnique": []
}
```

**Implementation:** Use Supabase aggregate queries (`SELECT COUNT(*)`, etc.) — NOT the `fetchAllRows` pattern from the admin endpoint. The admin endpoint scans the entire table into memory, which is unacceptable for a public endpoint.

**`byTechnique`:** Empty array for now. Technique-level data is intentionally withheld from the public endpoint to avoid priming participants or spoiling research findings. Can be enabled post-study.

**Caching:** Next.js `revalidate: 300` (5 minutes). The route handler exports `revalidate` so the response is ISR-cached at the edge.

**Rate limiting:** 20 requests per IP per minute via Redis (same pattern as other public endpoints).

**Privacy:** No player-identifiable data exposed. Only aggregate counts and percentages.

## Middleware changes

Add to existing `middleware.ts`:

```
If path === '/' AND user is authenticated → redirect to /play
```

Uses the same Supabase auth cookie check already in place. No new auth logic needed.

## SEO updates

- Landing page gets its own metadata: title "Threat Terminal — Can You Spot AI-Generated Phishing?", canonical `/`
- Game pages get canonical `/play` (update existing metadata)
- OG image and description stay on the landing page (where they matter most for link previews)

## Mobile responsiveness

- Stats grid: 3 columns → 1 column on mobile
- How it works: 3 columns → 1 column stacked on mobile
- Technique grid: 2 columns → 1 column on mobile
- Nav links collapse (hidden on mobile, CTA button remains)
- Terminal preview: scales down, maintains aspect ratio

## What this does NOT include

- Interactive "try one card" teaser (future v2)
- Phishing IQ test / shareable score (future v2)
- Animated terminal preview (static only)
- Any changes to the game itself
- SEO pages for individual techniques (future)

## Known trade-offs

- Existing bookmarks to `/` will show the landing page instead of the game for unauthenticated users. The prominent CTA to `/play` makes this low-friction.
- Signed-in users bookmarked on `/` get a redirect to `/play` — one extra hop, acceptable.

## Version

This is a minor release (v1.8.0) — new player-facing feature.
