import { expect, type Page } from '@playwright/test';

/**
 * Answer one game card: confidence → answer → wait for server check.
 * Returns the parsed /api/cards/check response for assertions.
 */
export async function answerCard(
  page: Page,
  answer: 'phishing' | 'legit' = 'phishing',
): Promise<{ correct: boolean; isPhishing: boolean; pointsEarned: number; streak: number; explanation: string }> {
  // Step 1: Select confidence (must happen before answer buttons appear)
  const confidenceButton = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
  await expect(confidenceButton).toBeVisible({ timeout: 15_000 });
  await confidenceButton.click();

  // Step 2: Click answer
  const answerButton = page.getByRole('button', { name: new RegExp(answer, 'i') });
  await expect(answerButton).toBeVisible({ timeout: 5_000 });

  const checkResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/cards/check'),
    { timeout: 15_000 },
  );
  await answerButton.click();

  const resp = await checkResponse;
  return resp.json();
}

/**
 * Click the NEXT button to advance to the next card.
 * Uses force:true to bypass CSS animation stability checks.
 */
export async function clickNext(page: Page): Promise<void> {
  const nextButton = page.getByRole('button', { name: /next/i });
  await expect(nextButton).toBeVisible({ timeout: 10_000 });
  await nextButton.click({ force: true });
}

/**
 * Complete the research intro + tutorial flow for a first-time user.
 * Handles: intro screen → tutorial mini-game → ready for real cards.
 */
export async function completeResearchOnboarding(page: Page): Promise<void> {
  // Intro screen — click BEGIN
  const beginButton = page.getByRole('button', { name: /begin/i });
  if (await beginButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await beginButton.click();
  }

  // Tutorial — has a TRAINING_SIMULATION banner
  const trainingBanner = page.getByText('TRAINING_SIMULATION');
  if (await trainingBanner.isVisible({ timeout: 5_000 }).catch(() => false)) {
    // Tutorial requires: confidence → answer → "GOT IT"
    const confidence = page.getByRole('button', { name: /certain|likely|guessing/i }).first();
    await expect(confidence).toBeVisible({ timeout: 3_000 });
    await confidence.click();

    const phishing = page.getByRole('button', { name: /phishing/i });
    await expect(phishing).toBeVisible({ timeout: 3_000 });
    await phishing.click();

    const gotIt = page.getByRole('button', { name: /got it/i });
    await expect(gotIt).toBeVisible({ timeout: 3_000 });
    await gotIt.click();
  }
}
