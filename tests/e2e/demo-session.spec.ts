import { expect, test } from '@playwright/test';
import { setTabHidden } from './helpers';

test('demo mode: a full session wakes the ghost, then restores the parlor', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');

  const scene = page.locator('svg.scene').first();
  await expect(page.getByTestId('room-title')).toHaveText('The Parlor');
  await expect(scene).toHaveAttribute('data-restored', 'false');
  await expect(scene).toHaveAttribute('data-ghost', 'asleep');
  await expect(page.getByTestId('digits')).toHaveText('00:20');
  // The demo parlor starts fully haunted: no candlestick lit.
  await expect(page.locator('[data-candle="lit"]')).toHaveCount(0);

  // Light the candle.
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await expect(page.getByTestId('phase')).toHaveText('Focus');
  await page.clock.runFor(3_000);
  await expect(page.getByTestId('digits')).toHaveText('00:17');
  await expect(page.locator('[data-candle="burning"]')).toHaveCount(1);

  // Wander off to another tab: the ghost wakes and calls you back.
  await setTabHidden(page, true);
  await page.clock.runFor(3_000);
  await expect(scene).toHaveAttribute('data-ghost', 'calling');
  await expect(page).toHaveTitle(/Come back/);

  // Come back: the ghost has drifted closer and says so, kindly.
  await setTabHidden(page, false);
  await expect(page.getByTestId('ghost-line')).toContainText('There you are');
  await expect(page.getByTestId('wanderings')).toHaveText('Wandered off 1 time');
  await expect(scene).toHaveAttribute('data-ghost', 'awake');
  await expect(scene).toHaveAttribute('data-ghost-closeness', '1');
  // A third of the way through, the first candlestick is already lit: color flows back during the session.
  await expect(page.locator('[data-candle="lit"]')).toHaveCount(1);

  // Finish the session: in the demo house one candle restores the room.
  await page.clock.runFor(15_000);
  await expect(page.getByTestId('restored-banner')).toContainText('The Parlor');
  await expect(page.getByTestId('restore-sweep')).toHaveCount(1);
  await expect(page.locator('[data-candle="lit"]')).toHaveCount(4);
  await expect(scene).toHaveAttribute('data-restored', 'true');
  await expect(page.getByTestId('room-blurb')).toHaveText('The clock ticks again and the portrait rests.');
  await expect(page.locator('.eyes-closed')).toHaveCount(1);
  await expect(page.getByTestId('cobwebs')).toHaveCSS('opacity', '0');
  await expect(page.getByTestId('phase')).toHaveText('Short break');
  await expect(page.getByTestId('announcer')).toContainText('The Parlor is restored');
  await expect(page.getByTestId('streak')).toContainText('5');

  // The break lets the house breathe, then the next room opens.
  await expect(scene).toHaveClass(/is-breathing/);
  await page.clock.runFor(10_500);
  await expect(page.getByTestId('phase')).toHaveText('Focus');
  await expect(page.getByTestId('room-title')).toHaveText('The Library');
  await expect(page.locator('svg.scene').first()).toHaveAttribute('data-restored', 'false');
});

test('demo mode never touches the real house', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await page.getByRole('button', { name: 'Leave the demo' }).click();
  await expect(page.getByTestId('room-title')).toHaveText('The Parlor');
  await expect(page.getByText('No tasks yet.')).toBeVisible();
  await expect(page.getByTestId('digits')).toHaveText('25:00');
});

test('the ghost comes right up to the glass after three wanderings, and its color gathers at the edges', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  const scene = page.locator('svg.scene').first();
  for (let i = 0; i < 3; i++) {
    await setTabHidden(page, true);
    await page.clock.runFor(2_500);
    await setTabHidden(page, false);
    await page.clock.runFor(200);
  }
  await expect(page.getByTestId('wanderings')).toHaveText('Wandered off 3 times');
  await expect(scene).toHaveAttribute('data-ghost-closeness', '3');
  await expect(page.getByTestId('ghost')).toHaveAttribute('style', /scale\(1\.8\)/);
  await expect(page.getByTestId('ghost-vignette')).toHaveCSS('opacity', '0.85', { timeout: 5_000 });
});

test('restoring a room gives back a page of the ghost’s journal, and the Hearth keeps a diary', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  // The demo house has a few earlier days, so the diary and the weekly reflection already speak.
  await expect(page.getByTestId('diary')).toContainText('Yesterday you lit one candle and left me once.');
  await expect(page.getByTestId('weekly')).toHaveText(/^This week: 10 candles, 4 h 10 min focused, 4 wanderings/);

  await page.keyboard.press('h');
  const journal = page.getByTestId('journal');
  await expect(journal).toContainText('0 of 6 pages back');
  await expect(journal.locator('[data-unlocked="true"]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Light a candle' }).click();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId('ghost-line')).toContainText('A page of my book came back');
  await expect(page.getByTestId('announcer')).toContainText('I. The Parlor');

  await page.getByRole('button', { name: 'House', exact: true }).click();
  await expect(journal).toContainText('1 of 6 pages back');
  await expect(journal.locator('[data-unlocked="true"]')).toHaveCount(1);
  await expect(journal.locator('[data-unlocked="true"]')).toContainText('I began this book the winter the lamps went out.');
  await expect(page.getByTestId('weekly')).toHaveText(/^This week: 11 candles/);
});
