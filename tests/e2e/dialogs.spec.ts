import { expect, test } from '@playwright/test';

// Req 7.2
test('a shortcut pressed straight after Escape opens its window every time', async ({ page }) => {
  await page.goto('/?demo=1');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const house = page.getByRole('dialog', { name: 'The House' });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press(',');
    await expect(settings).toBeVisible();
    // No wait between Escape and the next key: the old window's late "close" event must not swallow it.
    await page.keyboard.press('Escape');
    await page.keyboard.press('h');
    await expect(house).toBeVisible();
    await expect(settings).toBeHidden();
    await page.keyboard.press('Escape');
    await page.keyboard.press(',');
    await expect(settings).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();
  }
});

// Req 8.4, 7.2
test('settings open with "," straight after the house is erased', async ({ page }) => {
  await page.goto('/');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await page.keyboard.press(',');
  await settings.getByRole('button', { name: 'Erase all data…' }).click();
  await settings.getByRole('button', { name: 'Erase the house' }).click();
  await page.keyboard.press(',');
  await expect(settings).toBeVisible();
});
