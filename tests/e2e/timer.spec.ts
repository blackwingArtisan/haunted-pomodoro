import { expect, test } from '@playwright/test';

test('tasks, settings and a paused session survive a reload', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  // Add a task from the keyboard.
  await page.keyboard.press('n');
  await expect(page.locator('#new-task')).toBeFocused();
  await page.keyboard.type('Index the field recordings');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tasks')).toContainText('Index the field recordings');
  await expect(page.getByLabel('Working on')).toHaveValue(/.+/);

  // Shorter focus length.
  await page.locator('#new-task').blur();
  await page.keyboard.press(',');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('spinbutton', { name: /^Focus/ }).fill('15');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('digits')).toHaveText('15:00');

  // Space starts, time passes, Space pauses.
  await page.keyboard.press('Space');
  await page.clock.runFor(65_000);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('phase')).toContainText('paused');
  await expect(page.getByTestId('digits')).toHaveText('13:55');

  await page.reload();
  await expect(page.getByTestId('tasks')).toContainText('Index the field recordings');
  await expect(page.getByTestId('digits')).toHaveText('13:55');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();

  // Reset and skip from the keyboard.
  await page.keyboard.press('r');
  await expect(page.getByTestId('digits')).toHaveText('15:00');
  await page.keyboard.press('s');
  await expect(page.getByTestId('phase')).toHaveText('Short break');
});

test('mute and volume controls are reachable and remembered', async ({ page }) => {
  await page.goto('/');
  const mute = page.getByRole('button', { name: /Mute/ });
  await mute.click();
  await expect(page.getByRole('button', { name: /Turn sound on/ })).toBeVisible();
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: /Mute/ })).toBeVisible();
  await page.getByLabel('Volume').first().fill('30');
  await page.reload();
  await expect(page.getByLabel('Volume').first()).toHaveValue('30');
});

test('the house map lists every room and the shortcut list opens with ?', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('h');
  const house = page.getByRole('dialog', { name: 'The House' });
  await expect(house.getByRole('button', { name: /The Observatory/ })).toBeVisible();
  await expect(house.getByRole('button', { name: /The Parlor/ })).toHaveAttribute('aria-pressed', 'true');
  await house.getByRole('button', { name: /The Library/ }).click();
  await expect(house.locator('figcaption')).toContainText('Books whisper');
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toContainText('Light a candle, pause or resume');
});

test('first visit explains the house once', async ({ page }) => {
  await page.goto('/');
  const intro = page.getByTestId('intro');
  await expect(intro).toContainText('Four candles');
  await intro.getByRole('button', { name: 'Enter the house' }).click();
  await expect(intro).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Haunted Pomodoro' })).toBeVisible();
  await expect(page.getByTestId('intro')).toBeHidden();
});
