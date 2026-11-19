import { expect, test } from '@playwright/test';
import { setTabHidden } from '../e2e/helpers';

// Runs against a deployed copy (see playwright.smoke.config.ts). It changes nothing on the server:
// the demo house never reads or writes the visitor's own house.

test('the deployed page loads with its manifest, icon and preview image', async ({ page, request }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Haunted Pomodoro' })).toBeVisible();
  for (const path of ['/manifest.webmanifest', '/icon-192.png', '/sw.js']) {
    expect((await request.get(path)).ok(), path).toBe(true);
  }
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/^https:\/\/.+\/og-image\.png$|^\/og-image\.png$/);
  expect((await request.get(new URL(image!, page.url()).href)).ok()).toBe(true);
});

test('the deployed demo wakes the ghost and restores the parlor', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await page.clock.runFor(3_000);
  await setTabHidden(page, true);
  await page.clock.runFor(3_000);
  await setTabHidden(page, false);
  await expect(page.getByTestId('ghost-line')).toContainText('There you are');
  await page.clock.runFor(15_000);
  await expect(page.getByTestId('restored-banner')).toContainText('The Parlor');
});

test('the deployed page keeps working offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Light a candle' })).toBeVisible();
  await context.setOffline(false);
});
