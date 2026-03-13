# Environment Separation Design

**Date:** 2026-03-13
**Status:** Approved
**Approach:** Vercel Environment Variables (Approach A)

## Goal

Separate dev/preview from production so that branch work never touches the prod database or cache. Preview deployments on Vercel should auto-connect to dev infrastructure.

## Infrastructure

### New Resources

| Resource | Plan | Purpose |
|----------|------|---------|
| Supabase project `phish-or-not-dev` | Free | Dev/preview database |
| Upstash Redis database `phish-or-not-dev` | Free | Dev rate limiting |

### Vercel Environment Variables

All variables scoped by Vercel environment (Production vs Preview & Development):

| Variable | Production | Preview & Development |
|----------|-----------|----------------------|
| `SUPABASE_URL` | prod URL | dev URL |
| `SUPABASE_PUBLISHABLE_KEY` | prod key | dev key |
| `SUPABASE_SERVICE_ROLE_KEY` | prod key | dev key |
| `NEXT_PUBLIC_SUPABASE_URL` | prod URL | dev URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | prod key | dev key |
| `KV_REST_API_URL` | prod Upstash | dev Upstash |
| `KV_REST_API_TOKEN` | prod token | dev token |
| `OPENAI_API_KEY` | shared | shared |
| `ANTHROPIC_API_KEY` | shared | shared |
| `AI_PROVIDER` | shared | shared |
| `ADMIN_USER_ID` | shared | shared |

No code changes required — existing `lib/supabase.ts`, `lib/supabase-browser.ts`, and `lib/redis.ts` read from env vars cleanly.

### Local Development

Update `.env.local.example` to include the `NEXT_PUBLIC_` variables that `lib/supabase-browser.ts` requires. Developers running `npm run dev` locally should copy `.env.local.example` and fill in dev Supabase/Upstash credentials.

### Housekeeping

- Add `backups/` to `.gitignore` (avoid committing database dumps)
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local.example`

## Supabase CLI & Migration Workflow

### Local Setup

- Install Supabase CLI as a dev dependency
- Link to both projects using project refs
- Add npm scripts for common operations

### Migration Flow

```
1. Create migration:  supabase migration new <name>
2. Write SQL in:      supabase/migrations/<timestamp>_<name>.sql
3. Test on dev:       npm run db:push:dev
4. PR & review:       Migration file reviewed alongside code
5. Apply to prod:     npm run db:migrate:prod  (auto-backs up first)
6. Merge to master:   Vercel deploys code to prod
```

> **Ordering matters:** For additive migrations (new columns/tables the code depends on), run `db:push:prod` **before** merging so the schema is ready when the code deploys. For removal migrations (dropping unused columns), deploy the code first, then migrate later.

### NPM Scripts

```json
"db:push:dev": "supabase db push --project-ref <dev-ref>",
"db:migrate:prod": "npm run db:dump:prod && supabase db push --project-ref <prod-ref>",
"db:dump:prod": "supabase db dump --project-ref <prod-ref> > backups/pre-migration-$(date +%Y%m%d-%H%M%S).sql",
"db:reset:dev": "supabase db reset --project-ref <dev-ref>",
"db:seed:dev": "psql <dev-connection-string> -f supabase/seed.sql"
```

### Migration File Reconciliation

Existing migration files in `supabase/migrations/` do not have timestamp prefixes (e.g., `add-dealt-cards-to-sessions.sql`). The Supabase CLI expects timestamped filenames to track which migrations have been applied.

During initial setup:
1. Rename existing migration files to include timestamp prefixes (based on git commit dates)
2. Mark all existing migrations as "already applied" on both prod and dev using `supabase migration repair`
3. All future migrations use `supabase migration new` which auto-generates timestamps

### Initial Dev DB Setup

Apply all existing migrations from `supabase/migrations/` to the new dev project to match prod schema. Seed with a subset of freeplay cards exported from prod.

## Seed Data

Export a sample of freeplay cards from prod Supabase and commit as `supabase/seed.sql`. This gives dev a realistic dataset for testing without needing the full prod corpus.

## Prod Data Safety

### Migration Rules

These are mandatory for all migrations targeting prod:

1. **Pre-migration backup is automatic.** `npm run db:migrate:prod` chains dump → push, so backups can't be skipped. Never run `db push` against prod directly — always use `db:migrate:prod`.

2. **No destructive SQL in a single migration:**
   - No `DROP TABLE` / `DROP COLUMN`
   - No `TRUNCATE` / `DELETE` without `WHERE`
   - No `ALTER COLUMN ... TYPE` (type changes)
   - No `CASCADE` on anything

3. **Two-phase removal process:**
   - Deploy 1: Stop using the column/table in code
   - Deploy 2 (days later): Drop it after confirming nothing references it

### Answers Table Protection

A Postgres trigger on the `answers` table blocks `DELETE` and `TRUNCATE`:

```sql
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

This trigger is applied to both prod and dev databases.

> **Note:** Postgres requires separate triggers for DELETE (row-level) and TRUNCATE (statement-level) — they cannot be combined.

### Safety Hierarchy

```
Trigger blocks deletes on answers  →  catches bad migrations
Pre-migration backup               →  catches schema mistakes
Supabase PITR (Pro plan)           →  catches everything else
```

## E2E Testing on Preview Deploys

### Overview

Playwright E2E tests run against the Vercel preview URL for every PR. Tests must pass before the PR can be merged (enforced via GitHub branch protection, with admin bypass for rare exceptions).

### Test Infrastructure

- **Framework:** Playwright (runs in GitHub Actions)
- **Target:** Vercel preview URL (extracted from the Vercel deployment status via GitHub API)
- **Auth:** Two seeded test accounts in dev Supabase, authenticated via Supabase service role (bypass OTP)

### Test Accounts (seeded in dev DB)

| Account | State | Tests |
|---------|-------|-------|
| `test-fresh@phish-or-not.dev` | New user, 0 answers | Research mode full flow |
| `test-graduated@phish-or-not.dev` | 30+ research answers, graduated | Daily, Expert, Stats, Intel, Profile |

These accounts and their progression state are part of `supabase/seed.sql`.

### Test Suites

#### Critical: Research Mode (fresh account)
1. Land on `/` — see "RESEARCH MODE" button
2. Click Research Mode — see research intro screen
3. Progress through tutorial
4. Answer a card — verify server-side answer check fires (response includes correctness + explanation)
5. Verify streak tracking updates
6. Complete a round — verify summary screen with XP
7. Verify answer was written to dev DB (API call or DB check)

#### Core: Freeplay (no auth required)
1. Land on `/` — see "PLAY" button
2. Start freeplay — card loads with phish/legit options
3. Answer a card — see feedback screen
4. Complete a round — see summary

#### Graduation-Gated Modes (graduated account)
1. **Daily Challenge** — start daily, answer card, see feedback, verify "already played" lock after
2. **Expert Mode** — start expert, answer card, see feedback
3. **Stats** — `/stats` loads, charts render without errors
4. **Intel** — `/intel/player` loads, aggregate data renders
5. **Profile** — `/profile` loads, callsign displayed, fields editable

#### Navigation & UI
1. **Signal Guide** — expandable section opens and closes on `/`
2. **Leaderboard** — XP tab loads; Daily tab loads for graduated user
3. **Methodology** — `/methodology` loads markdown content
4. **All nav links** — back buttons and cross-page links resolve correctly

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  deployment_status:  # Triggers when Vercel deployment completes

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          BASE_URL: ${{ github.event.deployment_status.target_url }}
          TEST_SUPABASE_SERVICE_KEY: ${{ secrets.DEV_SUPABASE_SERVICE_ROLE_KEY }}
          TEST_SUPABASE_URL: ${{ secrets.DEV_SUPABASE_URL }}
```

### Branch Protection

- **Required status check:** `E2E Tests` must pass before merge
- **Admin bypass:** Repo admins can force-merge in rare cases
- Configured in GitHub repo settings → Branches → Branch protection rules for `master`

### Test Account Auth Strategy

Playwright tests authenticate via Supabase Admin API (service role key) to generate a session for the test accounts — no OTP flow needed. This is safe because:
- Service role key is only the **dev** key (stored as a GitHub Actions secret)
- Test accounts only exist in the dev database
- No prod credentials are ever in CI

## Deployment Workflow (End to End)

```
feature branch → PR opens
  ├── Vercel: preview deploy → dev Supabase + dev Upstash
  ├── GitHub Actions: E2E tests run against preview URL
  │     ├── Research mode (fresh account) — CRITICAL
  │     ├── Freeplay (no auth)
  │     ├── Daily + Expert + Stats + Intel (graduated account)
  │     └── Navigation & UI checks
  ├── Status check: must pass to merge (admin bypass available)
  └── Manual review
       ↓
  PR approved, all checks green
       ↓
  If additive migration: npm run db:migrate:prod (before merge)
       ↓
  Merge to master → Vercel deploys code to prod
       ↓
  If removal migration: npm run db:migrate:prod (after merge, days later)
```

## Post-Setup Verification

After initial setup is complete, run this one-time verification:

1. **Create a test branch** with a trivial change (e.g., add a comment)
2. **Push it** and wait for Vercel preview deploy
3. **Open the preview URL** and trigger an action that writes to Supabase (e.g., start a game session)
4. **Check the dev Supabase dashboard** — confirm the row appeared in dev, NOT prod
5. **Check prod Supabase dashboard** — confirm no new rows from the test
6. **Delete the test branch**

This confirms Vercel's env scoping is working correctly before any real development begins.

## Known Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Running raw `db push` against prod (skipping backup) | Low | `db:migrate:prod` chains backup automatically; document never to use `db push` directly |
| Migration drift between dev and prod | Medium | CLI tracks applied migrations; `db push` errors on mismatch rather than silently corrupting |
| Shared AI keys — runaway preview exhausts budget | Low | Set usage limits on OpenAI dashboard; low volume project |
| Existing migrations lack timestamps | One-time | Reconcile during initial setup with `migration repair` |
| Dev/prod auth sessions are separate | Not a risk | Expected behavior — users must log in separately on preview URLs |
