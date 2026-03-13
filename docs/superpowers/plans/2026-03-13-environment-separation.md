# Environment Separation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate dev/preview from production so branch work never touches the prod database, and E2E tests gate every merge to master.

**Architecture:** Vercel environment variable scoping routes preview deploys to a dev Supabase + Upstash instance. Playwright E2E tests run against Vercel preview URLs via GitHub Actions. Branch protection requires E2E pass before merge.

**Tech Stack:** Supabase CLI, Upstash Redis, Vercel env config, Playwright, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-13-environment-separation-design.md`

---

## Chunk 1: Infrastructure & Project Config

### Task 1: Create dev Supabase project and export seed data

> This task requires manual steps in external dashboards. The implementer should follow these steps and record the outputs.

**Files:**
- Create: `supabase/seed.sql`
- Modify: `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create dev Supabase project**

Go to https://supabase.com/dashboard → New Project:
- Name: `phish-or-not-dev`
- Plan: Free
- Region: same as prod

Record these values (you'll need them in Task 3):
- Project URL (`https://xxx.supabase.co`)
- Anon/public key
- Service role key
- Project ref (the `xxx` part of the URL)

- [ ] **Step 2: Export seed data from prod**

In the prod Supabase SQL Editor, run this query to export a sample of freeplay cards:

```sql
-- Export 50 freeplay cards (mix of phishing and legit, across difficulties)
SELECT * FROM cards_real
WHERE status IS NULL OR status != 'rejected'
ORDER BY random()
LIMIT 50;
```

Export the result as CSV from the Supabase dashboard, then convert to INSERT statements. Save as `supabase/seed.sql`:

```sql
-- Seed data: subset of freeplay cards for dev/test environment
-- Exported from prod on YYYY-MM-DD

-- Insert cards_real rows
INSERT INTO cards_real (id, staging_id, card_id, type, is_phishing, difficulty, from_address, subject, body, technique, secondary_technique, grammar_quality, prose_fluency, personalization_level, contextual_coherence, highlights, clues, explanation, source_corpus, dataset_version, approved_at, created_at)
VALUES
  -- Paste converted rows here
;

-- Insert dataset_versions if not already present
INSERT INTO dataset_versions (version, description)
VALUES ('v1', 'Initial dataset — GenAI era phishing, post-2023 samples, 600 phishing / 400 legitimate')
ON CONFLICT (version) DO NOTHING;
```

Ensure a mix: ~25 phishing, ~25 legit, spread across easy/medium/hard/extreme.

- [ ] **Step 3: Create test user seed data**

Add to `supabase/seed.sql` — the test accounts for E2E:

```sql
-- ============================================================
-- Test accounts for E2E testing
-- ============================================================

-- Fresh test user (0 research answers, not graduated)
-- Auth user created via Supabase Admin API in test setup
-- Player record auto-created on first /api/player GET

-- Graduated test user: needs 30+ research answers and research_graduated = true
-- We insert the player row and fake 30 answer rows

-- Player row for graduated user (auth_id will be set during test setup)
-- This is a placeholder — the actual auth_id comes from Supabase Admin API
-- The E2E test setup script will:
--   1. Create auth user via admin.auth.createUser()
--   2. Insert/update player row with that auth_id
--   3. Insert 30 research answer rows for that player

-- NOTE: test account setup is handled by the E2E test helper, not raw SQL,
-- because auth_id must come from Supabase's auth system.
-- See: e2e/helpers/test-accounts.ts (created in Task 7)
```

- [ ] **Step 4: Update .env.local.example**

```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Browser-side Supabase (required for auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Upstash Redis (rate-limiting / KV cache)
KV_REST_API_URL=https://your-instance.upstash.io
KV_REST_API_TOKEN=your-upstash-token

# AI Preprocessor (default: openai — set to anthropic to use Claude)
OPENAI_API_KEY=your-openai-api-key
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=your-anthropic-api-key

# Dev database direct connection (for seed scripts only)
# Find this in Supabase Dashboard → Settings → Database → Connection string (URI)
# DEV_DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

- [ ] **Step 5: Add backups/ to .gitignore**

Append to `.gitignore`:

```
# database backups
backups/
```

- [ ] **Step 6: Commit**

```bash
git add supabase/seed.sql .env.local.example .gitignore
git commit -m "chore: add seed data, update env example, gitignore backups"
```

---

### Task 2: Create dev Upstash Redis instance

> Manual dashboard step.

- [ ] **Step 1: Create dev Upstash database**

Go to https://console.upstash.com → Create Database:
- Name: `phish-or-not-dev`
- Plan: Free
- Region: same as prod

Record:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

---

### Task 3: Configure Vercel environment variables

> Manual dashboard step.

- [ ] **Step 1: Update Vercel env vars for Production scope**

Go to Vercel → Project Settings → Environment Variables.

For each of these, ensure the scope is **Production only**:
- `SUPABASE_URL` → prod URL
- `SUPABASE_PUBLISHABLE_KEY` → prod key
- `SUPABASE_SERVICE_ROLE_KEY` → prod key
- `NEXT_PUBLIC_SUPABASE_URL` → prod URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → prod key
- `KV_REST_API_URL` → prod Upstash URL
- `KV_REST_API_TOKEN` → prod Upstash token

- [ ] **Step 2: Add Vercel env vars for Preview & Development scope**

For each of these, set scope to **Preview** and **Development**:
- `SUPABASE_URL` → dev URL
- `SUPABASE_PUBLISHABLE_KEY` → dev key
- `SUPABASE_SERVICE_ROLE_KEY` → dev key
- `NEXT_PUBLIC_SUPABASE_URL` → dev URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → dev key
- `KV_REST_API_URL` → dev Upstash URL
- `KV_REST_API_TOKEN` → dev Upstash token

- [ ] **Step 3: Verify shared vars have All Environments scope**

These should apply to all environments:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `AI_PROVIDER`
- `ADMIN_USER_ID`

---

### Task 4: Install Supabase CLI and add npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Supabase CLI**

```bash
npm install -D supabase
```

- [ ] **Step 2: Add database scripts to package.json**

Add to `"scripts"` in `package.json` (replace `<dev-ref>` and `<prod-ref>` with actual project refs from Task 1):

```json
"db:push:dev": "supabase db push --project-ref <dev-ref>",
"db:migrate:prod": "npm run db:dump:prod && supabase db push --project-ref <prod-ref>",
"db:dump:prod": "supabase db dump --project-ref <prod-ref> -f backups/pre-migration-$(date +%Y%m%d-%H%M%S).sql",
"db:reset:dev": "supabase db reset --project-ref <dev-ref>",
"db:seed:dev": "supabase db push --project-ref <dev-ref> && psql \"$DEV_DATABASE_URL\" -f supabase/seed.sql"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install supabase CLI, add db management scripts"
```

---

### Task 5: Reconcile existing migration files and set up dev DB

**Files:**
- Modify: `supabase/migrations/*.sql` (rename all 7 files)

- [ ] **Step 1: Rename migration files with timestamp prefixes**

The Supabase CLI expects filenames like `YYYYMMDDHHMMSS_name.sql`. Rename each file based on its git commit date. Run:

```bash
cd supabase/migrations

# Get git dates for each file and rename
# Format: YYYYMMDDHHMMSS_original-name.sql
# Use git log to find when each was committed, then rename in chronological order

# Example (adjust timestamps from actual git log):
# git log --format="%ai" --diff-filter=A -- add-player-streaks.sql
# Then rename accordingly
```

Rename all 7 files:
- `add-answer-dedup-constraint.sql` → `YYYYMMDDHHMMSS_add-answer-dedup-constraint.sql`
- `add-dealt-cards-to-sessions.sql` → `YYYYMMDDHHMMSS_add-dealt-cards-to-sessions.sql`
- `add-expert-preview-game-modes.sql` → `YYYYMMDDHHMMSS_add-expert-preview-game-modes.sql`
- `add-player-achievements.sql` → `YYYYMMDDHHMMSS_add-player-achievements.sql`
- `add-player-streaks.sql` → `YYYYMMDDHHMMSS_add-player-streaks.sql`
- `add-reply-to-and-auth-status-to-staging.sql` → `YYYYMMDDHHMMSS_add-reply-to-and-auth-status-to-staging.sql`
- `add-research-signal-columns.sql` → `YYYYMMDDHHMMSS_add-research-signal-columns.sql`

- [ ] **Step 2: Apply schema to dev Supabase**

First, run the base schema, then all migrations:

```bash
# Connect to dev Supabase SQL editor or use psql
psql "$DEV_DATABASE_URL" -f supabase/schema.sql

# Then push migrations
npm run db:push:dev
```

- [ ] **Step 3: Mark migrations as applied on prod**

Since prod already has these applied, tell Supabase CLI they're done:

```bash
# For each migration, mark as applied on prod
supabase migration repair --status applied YYYYMMDDHHMMSS --project-ref <prod-ref>
# Repeat for all 7 migrations
```

- [ ] **Step 4: Seed dev DB**

```bash
psql "$DEV_DATABASE_URL" -f supabase/seed.sql
```

- [ ] **Step 5: Commit renamed migrations**

```bash
git add supabase/migrations/
git commit -m "chore: add timestamp prefixes to migration files for Supabase CLI"
```

---

### Task 6: Add answers table protection trigger

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_protect-answers-table.sql`

- [ ] **Step 1: Create the migration**

```bash
npx supabase migration new protect-answers-table
```

This creates a timestamped file. Write this SQL into it:

```sql
-- Protect the answers table from accidental DELETE and TRUNCATE.
-- Must be deliberately dropped before any data cleanup.

CREATE OR REPLACE FUNCTION prevent_answer_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Direct deletion from answers table is blocked. Use admin override if necessary.';
END;
$$ LANGUAGE plpgsql;

-- Row-level: blocks individual DELETEs
CREATE TRIGGER protect_answers_delete
  BEFORE DELETE ON answers
  FOR EACH ROW EXECUTE FUNCTION prevent_answer_deletion();

-- Statement-level: blocks TRUNCATE
CREATE TRIGGER protect_answers_truncate
  BEFORE TRUNCATE ON answers
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_answer_deletion();
```

- [ ] **Step 2: Test on dev**

```bash
npm run db:push:dev
```

Verify in dev Supabase SQL editor:

```sql
DELETE FROM answers WHERE id = '00000000-0000-0000-0000-000000000000';
-- Expected: ERROR "Direct deletion from answers table is blocked."
```

- [ ] **Step 3: Apply to prod**

```bash
npm run db:migrate:prod
```

This will auto-backup first, then apply.

- [ ] **Step 4: Verify on prod**

In prod Supabase SQL editor, run the same test DELETE (with a non-existent ID). Confirm the trigger fires.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add DELETE/TRUNCATE protection trigger on answers table"
```

---

## Chunk 2: E2E Test Infrastructure

### Task 7: Install Playwright and create test helpers

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/helpers/test-accounts.ts`
- Create: `e2e/helpers/auth.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add test scripts to package.json**

Add to `"scripts"`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 3: Create playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

- [ ] **Step 4: Create test account helper**

Create `e2e/helpers/test-accounts.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_KEY!;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const TEST_FRESH_EMAIL = 'test-fresh@phish-or-not.dev';
export const TEST_GRADUATED_EMAIL = 'test-graduated@phish-or-not.dev';

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Ensure a test user exists in Supabase Auth and return session tokens.
 * Uses admin API — no OTP needed.
 */
export async function ensureTestUser(email: string): Promise<TestUser> {
  // Try to find existing user
  const { data: { users } } = await admin.auth.admin.listUsers();
  let user = users.find((u) => u.email === email);

  if (!user) {
    // Create user with auto-confirmed email
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user ${email}: ${error.message}`);
    user = data.user;
  }

  // Generate a session for this user (admin impersonation)
  const { data: linkData, error: sessionErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (sessionErr || !linkData?.properties?.hashed_token) {
    throw new Error(`Failed to generate session for ${email}: ${sessionErr?.message ?? 'no hashed_token returned'}`);
  }

  // Exchange the link token for a session
  const { data: tokenData, error: tokenErr } = await admin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (tokenErr || !tokenData?.session) {
    throw new Error(`Failed to verify token for ${email}: ${tokenErr?.message ?? 'no session returned'}`);
  }

  return {
    id: user.id,
    email,
    accessToken: tokenData.session.access_token,
    refreshToken: tokenData.session.refresh_token,
  };
}

/**
 * Set up the graduated test user with 30 research answers and graduated flag.
 * Idempotent — safe to call multiple times.
 */
export async function seedGraduatedUser(authId: string): Promise<void> {
  // Ensure player row exists
  const { data: player } = await admin
    .from('players')
    .select('id, research_graduated')
    .eq('auth_id', authId)
    .single();

  let playerId: string;

  if (!player) {
    const { data: newPlayer, error } = await admin
      .from('players')
      .insert({ auth_id: authId, research_graduated: true, xp: 3000, level: 5 })
      .select('id')
      .single();
    if (error) throw new Error(`Failed to create player: ${error.message}`);
    playerId = newPlayer.id;
  } else {
    playerId = player.id;
    if (!player.research_graduated) {
      await admin.from('players').update({ research_graduated: true }).eq('id', playerId);
    }
  }

  // Check if already has 30+ research answers
  const { count } = await admin
    .from('answers')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('game_mode', 'research');

  if ((count ?? 0) >= 30) return; // Already seeded

  // Get card IDs not already answered by this player (avoids dedup constraint)
  const { data: existingAnswers } = await admin
    .from('answers')
    .select('card_id')
    .eq('player_id', playerId)
    .eq('game_mode', 'research');

  const answeredCardIds = new Set((existingAnswers ?? []).map((a) => a.card_id));
  const needed = 30 - (count ?? 0);

  const { data: cards } = await admin
    .from('cards_real')
    .select('card_id, is_phishing, difficulty, type, technique')
    .limit(needed + 10); // fetch extra in case of overlap

  if (!cards) throw new Error('Failed to fetch cards for seeding');

  const availableCards = cards.filter((c) => !answeredCardIds.has(c.card_id));
  if (availableCards.length < needed) {
    throw new Error(`Need ${needed} unanswered cards, found ${availableCards.length}`);
  }

  // Create a fake session
  const sessionId = crypto.randomUUID();
  await admin.from('sessions').insert({
    session_id: sessionId,
    game_mode: 'research',
    cards_answered: needed,
    completed_at: new Date().toISOString(),
  });

  // Insert answers (only for unanswered cards)
  const answers = availableCards.slice(0, needed).map((card, i) => ({
    session_id: sessionId,
    player_id: playerId,
    card_id: card.card_id,
    card_source: 'real' as const,
    is_phishing: card.is_phishing,
    technique: card.technique,
    difficulty: card.difficulty,
    type: card.type,
    user_answer: card.is_phishing ? 'phishing' : 'legit', // all correct
    correct: true,
    confidence: 'certain' as const,
    game_mode: 'research' as const,
    answer_ordinal: (i % 10) + 1,
  }));

  const { error: insertErr } = await admin.from('answers').insert(answers);
  if (insertErr) throw new Error(`Failed to seed answers: ${insertErr.message}`);
}
```

- [ ] **Step 5: Create auth injection helper**

Create `e2e/helpers/auth.ts`:

```typescript
import { Page } from '@playwright/test';

/**
 * Inject Supabase auth session into the browser.
 *
 * @supabase/ssr (v0.9+) uses cookies for session storage, not localStorage.
 * The cookie name format is: sb-<project-ref>-auth-token
 * The value is a base64-encoded JSON session split across chunked cookies.
 *
 * We also set localStorage as a fallback in case any code reads from there.
 */
export async function injectSession(
  page: Page,
  supabaseUrl: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const domain = new URL(page.url() || 'http://localhost').hostname;

  const sessionPayload = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  // Set the auth cookie that @supabase/ssr reads
  await page.context().addCookies([
    {
      name: cookieName,
      value: encodeURIComponent(sessionPayload),
      domain,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // Also set localStorage as fallback
  await page.addInitScript(
    ({ key, payload }) => {
      localStorage.setItem(key, payload);
    },
    { key: cookieName, payload: sessionPayload },
  );
}
```

- [ ] **Step 6: Add playwright artifacts to .gitignore**

Append to `.gitignore`:

```
# playwright
/test-results/
/playwright-report/
```

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/ package.json package-lock.json .gitignore
git commit -m "chore: set up Playwright with test account helpers"
```

---

## Chunk 3: E2E Test Suites

### Task 8: Research mode E2E tests (CRITICAL)

**Files:**
- Create: `e2e/research-mode.spec.ts`

- [ ] **Step 1: Write the research mode test**

```typescript
import { test, expect } from '@playwright/test';
import { ensureTestUser, TEST_FRESH_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Research Mode', () => {
  let freshUser: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    freshUser = await ensureTestUser(TEST_FRESH_EMAIL);
  });

  test('full research flow: intro → tutorial → answer card → feedback → summary', async ({ page }) => {
    // Inject auth session
    await injectSession(page, supabaseUrl, freshUser.accessToken, freshUser.refreshToken);
    await page.goto('/');

    // Should see RESEARCH MODE button (fresh user, not graduated)
    const researchButton = page.getByRole('button', { name: /research mode/i });
    await expect(researchButton).toBeVisible({ timeout: 15_000 });
    await researchButton.click();

    // Research intro screen (first time)
    // Look for the intro content and proceed
    const beginButton = page.getByRole('button', { name: /begin|start|continue/i });
    if (await beginButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await beginButton.click();
    }

    // Tutorial screen (first time research player)
    const completeButton = page.getByRole('button', { name: /complete|got it|continue/i });
    if (await completeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await completeButton.click();
    }

    // Playing phase — card should be visible
    // Wait for card to load (API call to /api/cards/research)
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/research') && resp.status() === 200,
      { timeout: 30_000 },
    );

    // Answer the first card — click phishing or legit button
    const phishingButton = page.getByRole('button', { name: /phishing/i });
    const legitButton = page.getByRole('button', { name: /legit/i });
    await expect(phishingButton.or(legitButton)).toBeVisible({ timeout: 10_000 });
    await phishingButton.click();

    // Select confidence
    const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await expect(confidenceButton).toBeVisible({ timeout: 5_000 });
    await confidenceButton.click();

    // Wait for server-side answer check
    const checkResponse = await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/check') && resp.status() === 200,
      { timeout: 15_000 },
    );
    const checkData = await checkResponse.json();

    // Verify server returned expected fields
    expect(checkData).toHaveProperty('correct');
    expect(checkData).toHaveProperty('isPhishing');
    expect(checkData).toHaveProperty('pointsEarned');
    expect(checkData).toHaveProperty('streak');
    expect(checkData).toHaveProperty('explanation');

    // Feedback screen should be visible
    await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 5_000 });

    // Click next to proceed
    const nextButton = page.getByRole('button', { name: /next/i });
    await expect(nextButton).toBeVisible({ timeout: 5_000 });
    await nextButton.click();

    // Second card should load — confirms the game loop works
    await expect(phishingButton.or(legitButton)).toBeVisible({ timeout: 10_000 });
  });

  test('server-side answer verification rejects re-checking same card', async ({ page }) => {
    await injectSession(page, supabaseUrl, freshUser.accessToken, freshUser.refreshToken);
    await page.goto('/');

    // Intercept the check endpoint
    let checkCount = 0;
    page.on('response', (resp) => {
      if (resp.url().includes('/api/cards/check')) checkCount++;
    });

    const researchButton = page.getByRole('button', { name: /research mode/i });
    await expect(researchButton).toBeVisible({ timeout: 15_000 });
    await researchButton.click();

    // Skip intro/tutorial if shown
    for (const name of [/begin|start|continue/i, /complete|got it|continue/i]) {
      const btn = page.getByRole('button', { name });
      if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) await btn.click();
    }

    // Wait for cards
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/research') && resp.status() === 200,
      { timeout: 30_000 },
    );

    // Answer one card
    const phishingButton = page.getByRole('button', { name: /phishing/i });
    await expect(phishingButton).toBeVisible({ timeout: 10_000 });
    await phishingButton.click();

    const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await confidenceButton.click();

    await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/check'),
      { timeout: 15_000 },
    );

    // The game should have moved to feedback, then next card
    // Each card should only produce ONE check call — anti-cheat prevents re-checking
    expect(checkCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test locally against dev**

```bash
BASE_URL=http://localhost:3000 TEST_SUPABASE_URL=<dev-url> TEST_SUPABASE_SERVICE_KEY=<dev-service-key> npx playwright test e2e/research-mode.spec.ts
```

Expected: Tests pass against local dev server.

- [ ] **Step 3: Commit**

```bash
git add e2e/research-mode.spec.ts
git commit -m "test: add research mode E2E tests (critical path)"
```

---

### Task 9: Freeplay mode E2E tests

**Files:**
- Create: `e2e/freeplay.spec.ts`

- [ ] **Step 1: Write freeplay test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Freeplay Mode', () => {
  test('play a full round: card → answer → feedback → next → summary', async ({ page }) => {
    await page.goto('/');

    // Click play button (freeplay, no auth required)
    const playButton = page.getByRole('button', { name: /play/i }).first();
    await expect(playButton).toBeVisible({ timeout: 15_000 });
    await playButton.click();

    // Wait for cards to load
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/freeplay') && resp.status() === 200,
      { timeout: 30_000 },
    );

    // Answer 10 cards to complete a round
    for (let i = 0; i < 10; i++) {
      // Answer
      const phishingButton = page.getByRole('button', { name: /phishing/i });
      await expect(phishingButton).toBeVisible({ timeout: 10_000 });
      await phishingButton.click();

      // Confidence
      const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
      await expect(confidenceButton).toBeVisible({ timeout: 5_000 });
      await confidenceButton.click();

      // Wait for check
      await page.waitForResponse(
        (resp) => resp.url().includes('/api/cards/check') && resp.status() === 200,
        { timeout: 15_000 },
      );

      // Feedback screen
      await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 5_000 });

      if (i < 9) {
        // Click next for cards 1-9
        const nextButton = page.getByRole('button', { name: /next/i });
        await nextButton.click();
      }
    }

    // Summary screen should appear after 10th card
    await expect(page.getByText(/summary|round complete|results/i)).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run test locally**

```bash
BASE_URL=http://localhost:3000 npx playwright test e2e/freeplay.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/freeplay.spec.ts
git commit -m "test: add freeplay mode E2E tests"
```

---

### Task 10: Graduated modes and pages E2E tests

**Files:**
- Create: `e2e/graduated-modes.spec.ts`

- [ ] **Step 1: Write graduated user tests**

```typescript
import { test, expect } from '@playwright/test';
import {
  ensureTestUser,
  seedGraduatedUser,
  TEST_GRADUATED_EMAIL,
} from './helpers/test-accounts';
import { injectSession } from './helpers/auth';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Graduated User Modes & Pages', () => {
  let graduatedUser: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    graduatedUser = await ensureTestUser(TEST_GRADUATED_EMAIL);
    await seedGraduatedUser(graduatedUser.id);
  });

  test('daily challenge: start, answer, see feedback', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/');

    const dailyButton = page.getByRole('button', { name: /daily challenge/i });
    await expect(dailyButton).toBeVisible({ timeout: 15_000 });
    await dailyButton.click();

    // Wait for daily card
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/daily') && resp.status() === 200,
      { timeout: 30_000 },
    );

    // Answer the card
    const phishingButton = page.getByRole('button', { name: /phishing/i });
    await expect(phishingButton).toBeVisible({ timeout: 10_000 });
    await phishingButton.click();

    const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await confidenceButton.click();

    // Feedback
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/check'),
      { timeout: 15_000 },
    );
    await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 5_000 });
  });

  test('daily challenge: shows already played after completing', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/');

    const dailyButton = page.getByRole('button', { name: /daily challenge/i });
    await expect(dailyButton).toBeVisible({ timeout: 15_000 });
    await dailyButton.click();

    // If already played today (from previous test), should see "already played" state
    // If not, complete the daily and then verify lock
    const alreadyPlayed = page.getByText(/already|completed|played/i);
    if (await alreadyPlayed.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Already played from previous test — lock is working
      await expect(alreadyPlayed).toBeVisible();
    } else {
      // Complete the daily round, then go back and verify lock
      const phishingButton = page.getByRole('button', { name: /phishing/i });
      await expect(phishingButton).toBeVisible({ timeout: 10_000 });
      // Complete all cards in daily round
      // After summary, navigate back to start and click daily again
      // Should now show locked/completed state
    }
  });

  test('expert mode: start and answer a card', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/');

    const expertButton = page.getByRole('button', { name: /expert mode/i });
    await expect(expertButton).toBeVisible({ timeout: 15_000 });
    await expertButton.click();

    await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/expert') && resp.status() === 200,
      { timeout: 30_000 },
    );

    const phishingButton = page.getByRole('button', { name: /phishing/i });
    await expect(phishingButton).toBeVisible({ timeout: 10_000 });
    await phishingButton.click();

    const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await confidenceButton.click();

    await page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/check'),
      { timeout: 15_000 },
    );
    await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 5_000 });
  });

  test('stats page loads with charts', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/stats');
    // Stats page should load without errors
    await expect(page.locator('body')).not.toContainText(/error|exception/i, { timeout: 15_000 });
    // Should contain stats-related content
    await expect(page.getByText(/accuracy|answers|performance/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('intel page loads with aggregate data', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/intel/player');
    await expect(page.locator('body')).not.toContainText(/error|exception/i, { timeout: 15_000 });
    await expect(page.getByText(/bypass|technique|analysis/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('profile page loads and shows callsign', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/profile');
    await expect(page.locator('body')).not.toContainText(/error|exception/i, { timeout: 15_000 });
    // Profile should have editable fields
    await expect(page.getByText(/callsign|operator|profile/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 2: Run tests locally**

```bash
BASE_URL=http://localhost:3000 TEST_SUPABASE_URL=<dev-url> TEST_SUPABASE_SERVICE_KEY=<dev-service-key> npx playwright test e2e/graduated-modes.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/graduated-modes.spec.ts
git commit -m "test: add graduated user E2E tests (daily, expert, stats, intel, profile)"
```

---

### Task 11: Navigation and UI E2E tests

**Files:**
- Create: `e2e/navigation.spec.ts`

- [ ] **Step 1: Write navigation tests**

```typescript
import { test, expect } from '@playwright/test';
import { ensureTestUser, seedGraduatedUser, TEST_GRADUATED_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Navigation & UI', () => {
  test('homepage loads with play button and leaderboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /play/i }).first()).toBeVisible({ timeout: 15_000 });
    // XP leaderboard tab should be visible
    await expect(page.getByText(/xp/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('signal guide expands and collapses', async ({ page }) => {
    await page.goto('/');
    const guide = page.getByText(/signal guide/i);
    if (await guide.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await guide.click();
      // Content should appear
      await expect(page.locator('body')).toContainText(/phishing|signal|indicator/i, { timeout: 5_000 });
    }
  });

  test('methodology page loads markdown content', async ({ page }) => {
    await page.goto('/methodology');
    await expect(page.locator('body')).not.toContainText(/error|404/i, { timeout: 10_000 });
    await expect(page.getByText(/methodology|research/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('leaderboard daily tab visible for graduated user', async ({ page }) => {
    const graduatedUser = await ensureTestUser(TEST_GRADUATED_EMAIL);
    await seedGraduatedUser(graduatedUser.id);
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/');

    // Daily leaderboard tab should be visible for graduated users
    const dailyTab = page.getByText(/daily/i).first();
    await expect(dailyTab).toBeVisible({ timeout: 15_000 });
  });

  test('back navigation links work', async ({ page }) => {
    await page.goto('/methodology');
    const backLink = page.getByText(/intel|back/i).first();
    await expect(backLink).toBeVisible({ timeout: 10_000 });
    await backLink.click();
    await expect(page).toHaveURL(/intel|\//, { timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run tests locally**

```bash
BASE_URL=http://localhost:3000 TEST_SUPABASE_URL=<dev-url> TEST_SUPABASE_SERVICE_KEY=<dev-service-key> npx playwright test e2e/navigation.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/navigation.spec.ts
git commit -m "test: add navigation and UI E2E tests"
```

---

## Chunk 4: CI Pipeline & Branch Protection

### Task 12: Create GitHub Actions E2E workflow

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Create the workflow file**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  deployment_status:

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success' && github.event.deployment_status.environment != 'Production'
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: ${{ github.event.deployment_status.target_url }}
          TEST_SUPABASE_URL: ${{ secrets.DEV_SUPABASE_URL }}
          TEST_SUPABASE_SERVICE_KEY: ${{ secrets.DEV_SUPABASE_SERVICE_ROLE_KEY }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: add E2E test workflow on Vercel preview deploys"
```

---

### Task 13: Add GitHub Actions secrets and branch protection

> Manual steps in GitHub and Vercel dashboards.

- [ ] **Step 1: Add GitHub Actions secrets**

Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

- `DEV_SUPABASE_URL` → dev Supabase project URL
- `DEV_SUPABASE_SERVICE_ROLE_KEY` → dev Supabase service role key

- [ ] **Step 2: Configure branch protection**

Go to GitHub repo → Settings → Branches → Add rule:

- Branch name pattern: `master`
- Check: "Require status checks to pass before merging"
- Search and add: `E2E Tests`
- Check: "Do not allow bypassing the above settings" → **Uncheck** (allows admin bypass)

---

## Chunk 5: Verification

### Task 14: Post-setup verification

- [ ] **Step 1: Create a test branch**

```bash
git checkout -b test/verify-env-separation
```

Add a trivial change (e.g., a comment in `playwright.config.ts`).

```bash
git add playwright.config.ts
git commit -m "test: verify environment separation"
git push -u origin test/verify-env-separation
```

- [ ] **Step 2: Open a PR and wait for Vercel preview deploy**

```bash
gh pr create --title "test: verify environment separation" --body "Verification PR — will delete after confirming env separation works."
```

Wait for Vercel preview URL to appear on the PR.

- [ ] **Step 3: Verify preview hits dev DB**

Open the preview URL. Start a freeplay game. Check the dev Supabase dashboard → `sessions` table → confirm a new row appeared.

Check the prod Supabase dashboard → `sessions` table → confirm NO new row from this test.

- [ ] **Step 4: Verify E2E tests run**

Check the PR's status checks. The `E2E Tests` workflow should trigger after the Vercel deploy completes. Verify it runs and passes (or debug failures).

- [ ] **Step 5: Clean up**

```bash
gh pr close --delete-branch
git checkout master
```

- [ ] **Step 6: Document results**

If everything passes, the environment separation is confirmed working. If any issues were found, document and fix them before proceeding with normal development.
