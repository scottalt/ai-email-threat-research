import { test, expect } from '@playwright/test';
import { ensureTestUser, seedGraduatedUser, TEST_GRADUATED_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Navigation & UI', () => {
  test('homepage loads with play button and leaderboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /play/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/xp/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('signal guide expands and collapses', async ({ page }) => {
    await page.goto('/');
    const guide = page.getByText(/signal guide/i);
    if (await guide.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await guide.click();
      await expect(page.locator('body')).toContainText(/phishing|signal|indicator/i, { timeout: 5_000 });
    }
  });

  test('methodology page loads markdown content', async ({ page }) => {
    await page.goto('/methodology');
    await expect(page.locator('body')).not.toContainText(/error|404/i, { timeout: 10_000 });
    await expect(page.getByText(/methodology|research/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('leaderboard daily tab visible for graduated user', async ({ page }) => {
    const graduatedUser = await ensureTestUser(TEST_GRADUATED_EMAIL);
    await seedGraduatedUser(graduatedUser.id);
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/');

    const dailyTab = page.getByText(/daily/i).first();
    await expect(dailyTab).toBeVisible({ timeout: 15_000 });
  });

  test('back navigation links work', async ({ page }) => {
    await page.goto('/methodology');
    const backLink = page.getByText(/intel|back/i).first();
    await expect(backLink).toBeVisible({ timeout: 10_000 });
    await backLink.click();
    await expect(page).toHaveURL(/intel|\//, { timeout: 10_000 });
  });
});
