import { test, expect } from '@playwright/test';
import { ensureTestUser, seedGraduatedUser, resetPlayerState, TEST_FREEPLAY_EMAIL, TEST_FREEPLAY_ROUND_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';
import { answerCard, clickNext } from './helpers/game-actions';
import { getPlayerState, countAnswers } from './helpers/db-assertions';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Freeplay Mode', () => {
  let user: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    user = await ensureTestUser(TEST_FREEPLAY_EMAIL);
    await resetPlayerState(user.id);
    await seedGraduatedUser(user.id);
  });

  test('full round: 10 cards with server-verified answers', async ({ page }) => {
    await injectSession(page, supabaseUrl, user.accessToken, user.refreshToken);
    await page.goto('/');

    const playButton = page.getByRole('button', { name: /play/i }).first();
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

  test('round completion awards XP and records answers', async ({ page }) => {
    test.setTimeout(120_000);
    const before = await getPlayerState(user.id);

    await injectSession(page, supabaseUrl, user.accessToken, user.refreshToken);
    await page.goto('/');

    const playButton = page.getByRole('button', { name: /play/i }).first();
    await expect(playButton).toBeVisible({ timeout: 15_000 });
    await playButton.click();

    // Play through all 10 cards
    for (let i = 0; i < 10; i++) {
      await answerCard(page);
      if (i < 9) await clickNext(page);
    }

    // Click NEXT after the last card to trigger round completion
    await clickNext(page);

    // Wait for round summary screen
    await expect(page.getByText('SESSION_COMPLETE')).toBeVisible({ timeout: 15_000 });

    // XP EARNED should appear on screen once the XP call completes
    await expect(page.getByText('XP EARNED')).toBeVisible({ timeout: 30_000 });

    // Verify database state was updated (source of truth)
    // Poll briefly to allow the async XP write to complete
    await expect(async () => {
      const after = await getPlayerState(user.id);
      expect(after!.xp).toBeGreaterThan(before!.xp);
      expect(after!.total_sessions).toBeGreaterThan(before!.total_sessions);
      expect(after!.last_xp_session_id).not.toBeNull();
      expect(after!.last_xp_session_id).not.toBe(before!.last_xp_session_id);
    }).toPass({ timeout: 15_000 });

    // Verify freeplay answers were recorded in the database
    const freeplayAnswers = await countAnswers(user.id, 'freeplay');
    expect(freeplayAnswers).toBeGreaterThanOrEqual(10);
  });
});
