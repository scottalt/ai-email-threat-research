import { test, expect } from '@playwright/test';
import { ensureTestUser, seedGraduatedUser, resetPlayerState, TEST_GRADUATED_EMAIL } from './helpers/test-accounts';
import { injectSession } from './helpers/auth';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Navigation & UI', () => {
  test('landing page loads with CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /take the challenge/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('game page loads with play button', async ({ page }) => {
    await page.goto('/play');
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
    await page.goto('/play');

    const dailyTab = page.getByText(/daily/i).first();
    await expect(dailyTab).toBeVisible({ timeout: 15_000 });
  });

  test('game nav bar hidden when signed out', async ({ page }) => {
    await page.goto('/play');
    // Game NavBar should not be visible for unauthenticated users
    // Landing page has its own nav, but the game NavBar (with HOME link) should be hidden
    const gameNav = page.locator('nav').filter({ hasText: 'HOME' });
    await expect(gameNav).not.toBeVisible({ timeout: 5_000 });
  });

  test('game nav bar visible for signed-in user', async ({ page }) => {
    const graduatedUser = await ensureTestUser(TEST_GRADUATED_EMAIL);
    await seedGraduatedUser(graduatedUser.id);
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/play');
    // NavBar renders two <nav> elements (desktop + mobile), use first()
    const gameNav = page.locator('nav').filter({ hasText: 'HOME' }).first();
    await expect(gameNav).toBeVisible({ timeout: 10_000 });
  });

  test('methodology page is accessible', async ({ page }) => {
    await page.goto('/methodology');
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
