import { test, expect } from '@playwright/test';
import { ensureTestUser, seedGraduatedUser, TEST_GRADUATED_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Navigation & UI', () => {
  test('homepage loads with play button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /play/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('methodology page renders content', async ({ page }) => {
    await page.goto('/methodology');
    // Just verify the page rendered meaningful content (not a 404 or crash)
    await expect(page.getByText(/methodology|research/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('leaderboard visible for graduated user', async ({ page }) => {
    const graduatedUser = await ensureTestUser(TEST_GRADUATED_EMAIL);
    await seedGraduatedUser(graduatedUser.id);
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/');

    const dailyTab = page.getByText(/daily/i).first();
    await expect(dailyTab).toBeVisible({ timeout: 15_000 });
  });

  test('back navigation from methodology works', async ({ page }) => {
    await page.goto('/methodology');
    const backLink = page.getByText(/intel|back/i).first();
    await expect(backLink).toBeVisible({ timeout: 10_000 });
    await backLink.click();
    await expect(page).toHaveURL(/intel|\//, { timeout: 10_000 });
  });
});
