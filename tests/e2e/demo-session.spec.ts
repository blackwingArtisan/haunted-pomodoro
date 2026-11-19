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

  // Finish the session: the fourth candle restores the room.
  await page.clock.runFor(15_000);
  await expect(page.getByTestId('restored-banner')).toContainText('The Parlor');
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
