import { test, expect } from '@playwright/test';
import { ensureTestUser, seedGraduatedUser, TEST_FREEPLAY_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Freeplay Mode', () => {
  let user: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    user = await ensureTestUser(TEST_FREEPLAY_EMAIL);
    await seedGraduatedUser(user.id);
  });

  test('play a full round: card → answer → feedback → next → summary', async ({ page }) => {
    await injectSession(page, supabaseUrl, user.accessToken, user.refreshToken);
    await page.goto('/');

    // Graduated user sees [ PLAY ] for freeplay
    const playButton = page.getByRole('button', { name: /play/i }).first();
    await expect(playButton).toBeVisible({ timeout: 15_000 });

    // Set up response listener BEFORE clicking to avoid race condition
    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/'),
      { timeout: 30_000 },
    );
    await playButton.click();
    await cardsResponse;

    // Debug: log what the page shows after clicking play
    await page.waitForTimeout(3_000);
    console.log('Page URL after play:', page.url());
    console.log('Page content excerpt:', await page.locator('body').innerText().then(t => t.slice(0, 500)));

    // Answer 10 cards to complete a round
    for (let i = 0; i < 10; i++) {
      const phishingButton = page.getByRole('button', { name: /phishing/i });
      await expect(phishingButton).toBeVisible({ timeout: 15_000 });

      const checkResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/cards/check'),
        { timeout: 15_000 },
      );
      await phishingButton.click();

      const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
      await expect(confidenceButton).toBeVisible({ timeout: 5_000 });
      await confidenceButton.click();

      await checkResponse;

      // Feedback screen
      await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 5_000 });

      if (i < 9) {
        const nextButton = page.getByRole('button', { name: /next/i });
        await nextButton.click();
      }
    }

    // Summary screen after 10th card
    await expect(page.getByText(/summary|round complete|results/i)).toBeVisible({ timeout: 10_000 });
  });
});
