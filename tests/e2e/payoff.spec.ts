import { expect, test, type Locator } from '@playwright/test';

type Box = { top: number; bottom: number; left: number; right: number };

const rect = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Req 4.21, 4.24
test('lighting a candle washes the stage in one warm bloom, and the haunted room keeps a little color', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  const scene = page.locator('svg.scene').first();
  expect(await scene.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--restore')))).toBeCloseTo(0.08, 5);
  await expect(page.getByTestId('strike-bloom')).toHaveCount(0);

  await page.getByRole('button', { name: 'Light a candle' }).click();
  const bloom = page.getByTestId('strike-bloom');
  await expect(bloom).toHaveCount(1);
  await expect(bloom).toHaveCSS('animation-name', 'strike-bloom');
  await expect(bloom).toHaveCSS('animation-duration', '0.6s');
  await expect(bloom).toHaveCSS('animation-iteration-count', '1');
  await expect(bloom).toHaveCSS('mix-blend-mode', 'screen');
});

// Req 4.21
test('with reduced motion the bloom is a plain fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await expect(page.getByTestId('strike-bloom')).toHaveCSS('animation-name', 'strike-fade');
});

// Req 4.22, 4.23
test('the restored frame is clear: no caption or ghost line covers the portrait or the fireplace', async ({ browser }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.clock.install();
    await page.goto('/?demo=1');
    await page.getByRole('button', { name: 'Light a candle' }).click();
    await page.clock.runFor(21_000);
    const banner = page.getByTestId('restored-banner');
    const line = page.getByTestId('ghost-line');
    await expect(banner).toBeVisible();
    await expect(line).toContainText('A page of my book came back');
    // The ghost waits for the sweep before it speaks.
    await expect(line).toHaveCSS('animation-delay', '2.5s');

    // Measure the settled frame: the caption's letter-spacing eases in over 1.6 s.
    await banner.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    const scene = page.locator('svg.scene').first();
    const [portrait, fire, caption, words] = await Promise.all([rect(scene.locator('.portrait')), rect(scene.locator('.fire .flame.f2')), rect(banner.locator('.restored-name')), rect(line)]);
    expect(overlaps(caption, portrait), `caption over the portrait at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(overlaps(caption, fire), `caption over the fire at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(overlaps(words, portrait), `ghost line over the portrait at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(overlaps(words, fire), `ghost line over the fire at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(overlaps(words, caption), `ghost line over the caption at ${viewport.width}x${viewport.height}`).toBe(false);
    await context.close();
  }
});
