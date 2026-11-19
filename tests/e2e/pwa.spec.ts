import { expect, test } from '@playwright/test';

test('works offline once loaded (service worker precache)', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Haunted Pomodoro' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Light a candle' })).toBeVisible();
  await context.setOffline(false);
});

test('reduced motion stills the house', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('.ghost-body').first()).toHaveCSS('animation-name', 'none');
  // The opening drapes and title card are stills: drapes at rest, title card out of view.
  await expect(page.locator('.drape-left')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.title-card')).toHaveCSS('opacity', '0');

  // The person can ask for the full theatre anyway.
  await page.keyboard.press(',');
  await page.getByLabel('Full theatre').check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await context.close();
});

test('fits a phone screen without sideways scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Light a candle' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await context.close();
});

test('link previews have a title, description and a 1200x630 image', async ({ page, request }) => {
  await page.goto('/');
  const meta = (property: string) => page.locator(`meta[property="${property}"], meta[name="${property}"]`).getAttribute('content');
  expect(await meta('og:title')).toContain('Haunted Pomodoro');
  expect(await meta('og:description')).toContain('keeps your candle lit');
  expect(await meta('twitter:card')).toBe('summary_large_image');
  const image = await meta('og:image');
  expect(image).toMatch(/\/og-image\.png$/);
  expect(image).not.toContain('%');
  const response = await request.get(new URL(image!, page.url()).href);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
  const png = await response.body();
  // PNG header: width and height are big-endian at bytes 16 and 20.
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});
