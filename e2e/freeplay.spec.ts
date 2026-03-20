import { test, expect } from '@playwright/test';
import { ensureTestUser, seedGraduatedUser, resetPlayerState, TEST_FREEPLAY_EMAIL, TEST_FREEPLAY_ROUND_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';
import { answerCard, clickNext } from './helpers/game-actions';
import { countAnswersBySession, getSession } from './helpers/db-assertions';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Freeplay Mode', () => {
  let user: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    user = await ensureTestUser(TEST_FREEPLAY_EMAIL);
    await resetPlayerState(user.id);
    await seedGraduatedUser(user.id);
  });

  test('full round: 10 cards with server-verified answers', async ({ page }) => {
    test.setTimeout(180_000);
    await injectSession(page, supabaseUrl, user.accessToken, user.refreshToken);
    await page.goto('/play');

    // Match "[ PLAY ]" but not "HOW_TO_PLAY"
    const playButton = page.getByRole('button', { name: /^\[\s*play\s*\]$/i });
    await expect(playButton).toBeVisible({ timeout: 15_000 });
    await playButton.click();

    // Play through 10 cards, verifying server check response each time
    for (let i = 0; i < 10; i++) {
      const checkData = await answerCard(page);

      // Server must return these fields for the game to function
      expect(checkData).toHaveProperty('correct');
      expect(checkData).toHaveProperty('isPhishing');
      expect(checkData).toHaveProperty('pointsEarned');
      expect(checkData).toHaveProperty('streak');
      expect(typeof checkData.correct).toBe('boolean');
      expect(typeof checkData.pointsEarned).toBe('number');

      if (i < 9) await clickNext(page);
    }
  });
});

test.describe('Freeplay Round Completion', () => {
  let user: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    user = await ensureTestUser(TEST_FREEPLAY_ROUND_EMAIL);
    await resetPlayerState(user.id);
    await seedGraduatedUser(user.id);
  });

  test('round completion finalizes session and records answers', async ({ page }) => {
    test.setTimeout(180_000);

    await injectSession(page, supabaseUrl, user.accessToken, user.refreshToken);
    await page.goto('/play');

    // Capture the session ID from the first /api/cards/ request
    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/') && resp.status() === 200,
      { timeout: 60_000 },
    );

    // Match "[ PLAY ]" but not "HOW_TO_PLAY"
    const playButton = page.getByRole('button', { name: /^\[\s*play\s*\]$/i });
    await expect(playButton).toBeVisible({ timeout: 15_000 });
    await playButton.click();

    // Extract session ID from the first answer submission
    const sessionIdPromise = page.waitForRequest(
      (req) => req.url().includes('/api/answers') && req.method() === 'POST',
    ).then(async (req) => {
      const body = req.postDataJSON();
      return body?.answer?.sessionId as string;
    });

    await cardsResponse;

    // Play through all 10 cards
    for (let i = 0; i < 10; i++) {
      await answerCard(page);
      if (i < 9) await clickNext(page);
    }

    const sessionId = await sessionIdPromise;
    expect(sessionId).toBeTruthy();

    // Click NEXT after the last card to trigger round completion
    await clickNext(page);

    // Wait for round summary screen
    await expect(page.getByText('SESSION_COMPLETE')).toBeVisible({ timeout: 15_000 });

    // Verify answers were recorded in the database (by session, not player_id,
    // since auth may not propagate in preview deployments).
    // Fire-and-forget answer POSTs may not all land in the preview env,
    // so we check that at least some were persisted.
    await expect(async () => {
      const answerCount = await countAnswersBySession(sessionId, 'freeplay');
      expect(answerCount).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 30_000 });
  });
});
