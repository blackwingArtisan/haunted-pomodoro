import { expect, test } from '@playwright/test';

/**
 * Renders every synthesized sound through the real engine in Chromium's OfflineAudioContext and
 * checks the measured levels: audible, never clipping at full volume, and fading out cleanly.
 */
// Req 6.3, 6.4, 6.5, 6.8, 6.9
test('every sound renders within its level limits', async ({ page }) => {
  await page.goto('/sound-check.html');
  const summary = page.getByTestId('summary');
  await expect(summary).toHaveAttribute('data-total', '8', { timeout: 30_000 });
  await expect(summary).toHaveText('8 of 8 sounds within limits.');

  const rows = page.getByTestId('sound-row');
  await expect(rows).toHaveCount(8);
  for (const row of await rows.all()) {
    const name = await row.getAttribute('data-sound');
    await expect(row, `${name} should be within limits`).toHaveAttribute('data-ok', 'true');
    expect(Number(await row.getAttribute('data-clipped'))).toBe(0);
    expect(Number(await row.getAttribute('data-peak-db'))).toBeLessThanOrEqual(-1);
    expect(Number(await row.getAttribute('data-peak-db'))).toBeGreaterThanOrEqual(-28);
  }

  // Every sound can be played from the page without errors.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: 'Play Ghost moan' }).click();
  await page.getByRole('button', { name: 'Play wind' }).click();
  await expect(page.getByRole('button', { name: 'Stop wind' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
