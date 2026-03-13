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

    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/daily') ,
      { timeout: 30_000 },
    );
    await dailyButton.click();
    await cardsResponse;

    // Step 1: Select confidence first (UI requires this before answer buttons appear)
    const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await expect(confidenceButton).toBeVisible({ timeout: 10_000 });
    await confidenceButton.click();

    // Step 2: Now phishing/legit buttons appear
    const phishingButton = page.getByRole('button', { name: /phishing/i });
    await expect(phishingButton).toBeVisible({ timeout: 5_000 });

    const checkResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/check'),
      { timeout: 15_000 },
    );
    await phishingButton.click();

    await checkResponse;
    await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 5_000 });
  });

  test('expert mode: start and answer a card', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/');

    const expertButton = page.getByRole('button', { name: /expert mode/i });
    await expect(expertButton).toBeVisible({ timeout: 15_000 });

    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/expert') ,
      { timeout: 30_000 },
    );
    await expertButton.click();
    await cardsResponse;

    // Step 1: Select confidence first
    const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await expect(confidenceButton).toBeVisible({ timeout: 10_000 });
    await confidenceButton.click();

    // Step 2: Now phishing/legit buttons appear
    const phishingButton = page.getByRole('button', { name: /phishing/i });
    await expect(phishingButton).toBeVisible({ timeout: 5_000 });

    const checkResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/check'),
      { timeout: 15_000 },
    );
    await phishingButton.click();

    await checkResponse;
    await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 5_000 });
  });

  test('stats page loads with charts', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/stats');
    await expect(page.locator('body')).not.toContainText(/error|exception/i, { timeout: 15_000 });
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
    await expect(page.getByText(/callsign|operator|profile/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
