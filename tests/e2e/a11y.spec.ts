import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('the main screen has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Light a candle' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('the demo session, settings and house map have no WCAG A/AA violations', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId('restored-banner')).toBeVisible();
  expect(await scan(page)).toEqual([]);

  await page.keyboard.press(',');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await page.keyboard.press('h');
  await expect(page.getByRole('dialog', { name: 'The House' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('settings in a normal house, with export, import and notifications, have no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press(',');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('button', { name: 'Export house' })).toBeEnabled();
  await expect(dialog.getByLabel('Import house')).toBeEnabled();
  await expect(dialog.getByRole('switch', { name: /Notify me when a phase ends/ })).not.toBeChecked();
  expect(await scan(page)).toEqual([]);
});

test('the sound check page has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/sound-check.html');
  await expect(page.getByTestId('summary')).toHaveAttribute('data-total', '8', { timeout: 30_000 });
  expect(await scan(page)).toEqual([]);
});
