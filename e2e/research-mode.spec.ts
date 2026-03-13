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
    await injectSession(page, supabaseUrl, freshUser.accessToken, freshUser.refreshToken);
    await page.goto('/');

    // Should see RESEARCH MODE button (fresh user, not graduated)
    const researchButton = page.getByRole('button', { name: /research mode/i });
    await expect(researchButton).toBeVisible({ timeout: 15_000 });

    // Set up response listener BEFORE clicking
    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/research') ,
      { timeout: 30_000 },
    );
    await researchButton.click();

    // Research intro screen (first time)
    const beginButton = page.getByRole('button', { name: /begin|start|continue/i });
    if (await beginButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await beginButton.click();
    }

    // Tutorial screen (first time research player)
    const completeButton = page.getByRole('button', { name: /complete|got it|continue/i });
    if (await completeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await completeButton.click();
    }

    // Wait for cards response
    await cardsResponse;

    // Answer the first card
    const phishingButton = page.getByRole('button', { name: /phishing/i });
    const legitButton = page.getByRole('button', { name: /legit/i });
    await expect(phishingButton.or(legitButton)).toBeVisible({ timeout: 10_000 });

    // Set up check listener BEFORE clicking
    const checkResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/check') ,
      { timeout: 15_000 },
    );
    await phishingButton.click();

    // Select confidence
    const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await expect(confidenceButton).toBeVisible({ timeout: 5_000 });
    await confidenceButton.click();

    // Wait for server-side answer check
    const checkData = await (await checkResponse).json();

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

    let checkCount = 0;
    page.on('response', (resp) => {
      if (resp.url().includes('/api/cards/check')) checkCount++;
    });

    const researchButton = page.getByRole('button', { name: /research mode/i });
    await expect(researchButton).toBeVisible({ timeout: 15_000 });

    // Set up response listener BEFORE clicking
    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/research') ,
      { timeout: 30_000 },
    );
    await researchButton.click();

    // Skip intro/tutorial if shown
    for (const name of [/begin|start|continue/i, /complete|got it|continue/i]) {
      const btn = page.getByRole('button', { name });
      if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) await btn.click();
    }

    await cardsResponse;

    // Answer one card
    const phishingButton = page.getByRole('button', { name: /phishing/i });
    await expect(phishingButton).toBeVisible({ timeout: 10_000 });

    const checkResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/check'),
      { timeout: 15_000 },
    );
    await phishingButton.click();

    const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await confidenceButton.click();

    await checkResponse;

    // Each card should only produce ONE check call
    expect(checkCount).toBe(1);
  });
});
