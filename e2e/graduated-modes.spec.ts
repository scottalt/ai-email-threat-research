import { test, expect } from '@playwright/test';
import {
  ensureTestUser,
  seedGraduatedUser,
  resetPlayerState,
  TEST_GRADUATED_EMAIL,
} from './helpers/test-accounts';
import { injectSession } from './helpers/auth';
import { answerCard } from './helpers/game-actions';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;

test.describe('Graduated User Modes & Pages', () => {
  let graduatedUser: Awaited<ReturnType<typeof ensureTestUser>>;

  test.beforeAll(async () => {
    graduatedUser = await ensureTestUser(TEST_GRADUATED_EMAIL);
    await resetPlayerState(graduatedUser.id);
    await seedGraduatedUser(graduatedUser.id);
  });

  test('daily challenge: server-verified answer', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/play');

    const dailyButton = page.getByRole('button', { name: /daily challenge/i });
    await expect(dailyButton).toBeVisible({ timeout: 15_000 });

    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/daily'),
      { timeout: 30_000 },
    );
    await dailyButton.click();
    await cardsResponse;

    const checkData = await answerCard(page);
    expect(checkData).toHaveProperty('correct');
    expect(checkData).toHaveProperty('isPhishing');
    expect(typeof checkData.correct).toBe('boolean');
  });

  test('expert mode: server-verified answer', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/play');

    const expertButton = page.getByRole('button', { name: /expert/i });
    await expect(expertButton).toBeVisible({ timeout: 15_000 });

    const cardsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/expert'),
      { timeout: 30_000 },
    );
    await expertButton.click();
    await cardsResponse;

    const checkData = await answerCard(page);
    expect(checkData).toHaveProperty('correct');
    expect(checkData).toHaveProperty('isPhishing');
    expect(typeof checkData.correct).toBe('boolean');
  });

  test('stats page loads without crashing', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/stats');
    // Stats page renders one of: full stats, locked state, or loading
    await expect(
      page.getByText(/accuracy|operator_stats|stats_locked|not_authenticated|loading/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('intel page loads with data', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/intel/player');
    await expect(page.getByText(/bypass|technique|analysis/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('profile page loads', async ({ page }) => {
    await injectSession(page, supabaseUrl, graduatedUser.accessToken, graduatedUser.refreshToken);
    await page.goto('/profile');
    await expect(page.getByText(/callsign|operator|profile/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
