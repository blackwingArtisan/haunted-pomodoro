import { expect, test, type Page } from '@playwright/test';
import { setTabHidden } from './helpers';

/** One wandering that counts: away past the grace period (2 s in the demo, 3 s otherwise), then back. */
async function wanderAndReturn(page: Page, awayMs = 2_500) {
  await setTabHidden(page, true);
  await page.clock.runFor(awayMs);
  await setTabHidden(page, false);
  await page.clock.runFor(200);
}

// Req 3.18, 3.19
test('every return from a wandering leaves a will-o\'-wisp, and finishing the session keeps them', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  const wisps = page.getByTestId('wisps');
  const scene = page.locator('svg.scene').first();
  await expect(wisps).toHaveAttribute('data-count', '0');

  await page.getByRole('button', { name: 'Light a candle' }).click();
  await wanderAndReturn(page);
  await expect(wisps).toHaveAttribute('data-count', '1');
  await expect(scene).toHaveAttribute('aria-label', /One will-o'-wisp glows near the ceiling, lit for the time you came back today\./);

  await wanderAndReturn(page);
  await expect(wisps).toHaveAttribute('data-count', '2');
  await expect(scene).toHaveAttribute('aria-label', /Two will-o'-wisps glow near the ceiling, one for each time you came back today\./);
  await expect(wisps.locator('.wisp')).toHaveCount(2);

  // The session ends and the room is restored; the wisps stay.
  await page.clock.runFor(20_000);
  await expect(scene).toHaveAttribute('data-restored', 'true');
  await expect(wisps).toHaveAttribute('data-count', '2');
});

// Req 3.18
test('wisps are saved with the day, so a reload keeps them', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await wanderAndReturn(page, 4_000);
  await expect(page.getByTestId('wisps')).toHaveAttribute('data-count', '1');
  await page.reload();
  await expect(page.getByTestId('wisps')).toHaveAttribute('data-count', '1');
});

// Req 3.18
test('with reduced motion the wisps hold still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await wanderAndReturn(page);
  await expect(page.locator('.wisp-float').first()).toHaveCSS('animation-name', 'none');
});
