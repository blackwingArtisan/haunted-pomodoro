import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// Req 9.9
test('the week demo opens on two made-up weeks: the Hearth comes first and the banner jumps to it', async ({ page }) => {
  await page.goto('/?demo=week');
  await expect(page.getByRole('status').filter({ hasText: 'Demo house.' })).toContainText('Two made-up weeks of history');
  await expect(page.getByRole('heading', { name: 'The Conservatory' })).toBeVisible();
  const hearth = page.locator('.side .hearth');
  const ledger = page.locator('.side .ledger');
  const [hearthTop, ledgerTop] = await Promise.all([hearth.evaluate((el) => el.getBoundingClientRect().top), ledger.evaluate((el) => el.getBoundingClientRect().top)]);
  expect(hearthTop).toBeLessThan(ledgerTop);

  await expect(page.getByTestId('weekly')).toContainText('time away fell from 55 min to 13 min');
  await expect(page.locator('.fortnight .mini-candle[data-lit="true"]')).toHaveCount(12);
  await page.getByRole('link', { name: 'See the week' }).click();
  await expect(page.getByTestId('weekly')).toBeInViewport();
});

// Req 12.11
test('the Hearth saves the week as a 1200x630 PNG postcard', async ({ page }) => {
  await page.goto('/?demo=week');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save this week’s postcard' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^haunted-pomodoro-week-\d{4}-\d{2}-\d{2}\.png$/);
  const png = await readFile((await download.path())!);
  // The PNG signature, then the header chunk's width and height.
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  expect(png.length).toBeGreaterThan(20_000);
});

// Req 12.11
test('a house with no sessions this week has no postcard to save', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Save this week’s postcard' })).toHaveCount(0);
});

// Req 9.9
test('on a phone the week demo banner fits without sideways scroll', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/?demo=week');
  await expect(page.getByRole('link', { name: 'See the week' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave the demo' })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await context.close();
});
