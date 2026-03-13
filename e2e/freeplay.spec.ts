import { test, expect } from '@playwright/test';

test.describe('Freeplay Mode', () => {
  test('play a full round: card → answer → feedback → next → summary', async ({ page }) => {
    await page.goto('/');

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
      const phishingButton = page.getByRole('button', { name: /phishing/i });
      await expect(phishingButton).toBeVisible({ timeout: 10_000 });
      await phishingButton.click();

      const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
      await expect(confidenceButton).toBeVisible({ timeout: 5_000 });
      await confidenceButton.click();

      await page.waitForResponse(
        (resp) => resp.url().includes('/api/cards/check') && resp.status() === 200,
        { timeout: 15_000 },
      );

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
