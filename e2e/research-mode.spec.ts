import { test, expect } from '@playwright/test';
import { ensureTestUser, ensurePlayerProfile, resetPlayerState, TEST_FRESH_EMAIL, TEST_FRESH_ROUND_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';
import { answerCard, clickNext, completeResearchOnboarding } from './helpers/game-actions';
import { getPlayerState, countAnswers } from './helpers/db-assertions';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Research Mode', () => {
  let freshUser: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    freshUser = await ensureTestUser(TEST_FRESH_EMAIL);
    await resetPlayerState(freshUser.id);
    await ensurePlayerProfile(freshUser.id, 'TEST_RESEARCHER');
  });

  test('answer is server-verified with correct response structure', async ({ page }) => {
    await injectSession(page, supabaseUrl, freshUser.accessToken, freshUser.refreshToken);
    await page.goto('/');

    const researchButton = page.getByRole('button', { name: /research mode/i });
    await expect(researchButton).toBeVisible({ timeout: 15_000 });

    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/research'),
      { timeout: 30_000 },
    );
    await researchButton.click();
    await cardsResponse;

    // Complete onboarding (intro + tutorial) for first-time user
    await completeResearchOnboarding(page);

    // Answer a real research card
    const checkData = await answerCard(page);

    // Verify server-side check returned correct structure
    expect(checkData).toHaveProperty('correct');
    expect(checkData).toHaveProperty('isPhishing');
    expect(checkData).toHaveProperty('pointsEarned');
    expect(checkData).toHaveProperty('streak');
    expect(checkData).toHaveProperty('explanation');
    expect(typeof checkData.correct).toBe('boolean');
    expect(typeof checkData.isPhishing).toBe('boolean');

    // Advance to next card to confirm game loop works
    await clickNext(page);

    // Second card's confidence selector should appear
    const confidence2 = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await expect(confidence2).toBeVisible({ timeout: 10_000 });
  });

  test('each card produces exactly one /check call', async ({ page }) => {
    await injectSession(page, supabaseUrl, freshUser.accessToken, freshUser.refreshToken);
    await page.goto('/');

    let checkCount = 0;
    page.on('response', (resp) => {
      if (resp.url().includes('/api/cards/check')) checkCount++;
    });

    const researchButton = page.getByRole('button', { name: /research mode/i });
    await expect(researchButton).toBeVisible({ timeout: 15_000 });

    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/research'),
      { timeout: 30_000 },
    );
    await researchButton.click();
    await cardsResponse;

    await completeResearchOnboarding(page);
    await answerCard(page);

    // Exactly one check call per answered card
    expect(checkCount).toBe(1);
  });
});

test.describe('Research Round Completion', () => {
  let freshUser: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    freshUser = await ensureTestUser(TEST_FRESH_ROUND_EMAIL);
    await resetPlayerState(freshUser.id);
    await ensurePlayerProfile(freshUser.id, 'TEST_ROUND_RESEARCHER');
  });

  test('full research round awards XP and records answers', async ({ page }) => {
    test.setTimeout(120_000);
    const before = await getPlayerState(freshUser.id);

    await injectSession(page, supabaseUrl, freshUser.accessToken, freshUser.refreshToken);
    await page.goto('/');

    // Set up listener for XP call BEFORE starting the round
    const xpPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/player/xp') && resp.status() === 200,
      { timeout: 120_000 },
    );

    const researchButton = page.getByRole('button', { name: /research mode/i });
    await expect(researchButton).toBeVisible({ timeout: 15_000 });

    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/research'),
      { timeout: 30_000 },
    );
    await researchButton.click();
    await cardsResponse;

    await completeResearchOnboarding(page);

    // Play through all 10 research cards
    for (let i = 0; i < 10; i++) {
      await answerCard(page);
      if (i < 9) await clickNext(page);
    }

    // Click NEXT after the last card to trigger round completion
    await clickNext(page);

    // Wait for round summary screen
    await expect(page.getByText('SESSION_COMPLETE')).toBeVisible({ timeout: 15_000 });

    // Wait for XP award API call to complete
    const xpResponse = await xpPromise;
    const xpData = await xpResponse.json();

    // XP response must include expected fields
    expect(xpData).toHaveProperty('xp');
    expect(xpData).toHaveProperty('level');
    expect(xpData).toHaveProperty('xpEarned');
    expect(typeof xpData.xpEarned).toBe('number');
    expect(xpData.xpEarned).toBeGreaterThan(0);

    // XP EARNED should appear on screen
    await expect(page.getByText('XP EARNED')).toBeVisible({ timeout: 10_000 });

    // Verify database state was updated
    const after = await getPlayerState(freshUser.id);
    expect(after!.xp).toBeGreaterThan(before!.xp);
    expect(after!.research_sessions_completed).toBeGreaterThan(before!.research_sessions_completed);
    expect(after!.last_xp_session_id).not.toBeNull();

    // Verify research answers were recorded in the database
    const researchAnswers = await countAnswers(freshUser.id, 'research');
    expect(researchAnswers).toBeGreaterThanOrEqual(10);
  });
});
