import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function scan(page: Page) {
  // Let one-off entrance animations (a dialog fading in, say) finish first, so axe measures colors as
  // the person sees them rather than part-way through a fade. Looping animations are left running.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

// Req 7.5
test('the main screen has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Light a candle' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

// Req 7.5
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

// Req 7.5, 10.1, 11.14
test('settings in a normal house, with export, import and notifications, have no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press(',');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('button', { name: 'Export house' })).toBeEnabled();
  await expect(dialog.getByLabel('Import house')).toBeEnabled();
  await expect(dialog.getByRole('switch', { name: /Notify me when a phase ends/ })).not.toBeChecked();
  expect(await scan(page)).toEqual([]);
});

// Req 7.5
test('the sound check page has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/sound-check.html');
  await expect(page.getByTestId('summary')).toHaveAttribute('data-total', '8', { timeout: 30_000 });
  expect(await scan(page)).toEqual([]);
});

// Req 7.16
test('at phone width the icon-only toolbar keeps its names and the screen has no WCAG A/AA violations', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  for (const path of ['/', '/?demo=1']) {
    await page.goto(path);
    await expect(page.getByTestId('primary')).toBeVisible();
    const toolbar = page.getByRole('navigation', { name: 'House tools' });
    for (const name of ['House', 'Settings', 'Keys']) await expect(toolbar.getByRole('button', { name, exact: true })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  }
  await context.close();
});

// Req 7.7
test('a keyboard user can Tab to "Light a candle", sees a focus ring, and starts the session with Enter', async ({ page }) => {
  await page.goto('/');
  const primary = page.getByTestId('primary');
  for (let i = 0; i < 40 && !(await primary.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(primary).toBeFocused();
  const ring = await primary.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThan(0);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});

// Req 7.5, 7.22
test('the plain view with the costume off has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByTestId('unmask').click();
  await expect(page.getByTestId('plain-stage')).toBeVisible();
  expect(await scan(page)).toEqual([]);
});
