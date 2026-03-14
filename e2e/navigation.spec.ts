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

  test('nav bar hidden when signed out', async ({ page }) => {
    await page.goto('/');
    // Nav bar should not be visible for unauthenticated users
    await expect(page.locator('nav')).not.toBeVisible({ timeout: 5_000 });
  });

  test('nav bar visible for signed-in user', async ({ page }) => {
    const graduatedUser = await ensureTestUser(TEST_GRADUATED_EMAIL);
    await seedGraduatedUser(graduatedUser.id);
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav.first()).toBeVisible({ timeout: 10_000 });
    await expect(nav.first().locator('a[aria-current="page"]')).toContainText('HOME');
  });

  test('methodology page is accessible', async ({ page }) => {
    await page.goto('/methodology');
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
