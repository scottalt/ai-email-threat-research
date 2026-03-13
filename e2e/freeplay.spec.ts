import { test, expect } from '@playwright/test';
import { ensureTestUser, seedGraduatedUser, TEST_FREEPLAY_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';
import { answerCard, clickNext } from './helpers/game-actions';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Freeplay Mode', () => {
  let user: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    user = await ensureTestUser(TEST_FREEPLAY_EMAIL);
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
