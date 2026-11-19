import { expect, test } from '@playwright/test';

// Req 7.3, 7.9, 8.4, 8.5, 8.6, 11.1, 11.2, 11.3, 11.8, 11.15
test('export, erase and import brings the lit candle back, and a damaged file changes nothing', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.goto('/');
  const scene = page.locator('svg.scene').first();
  const dialog = page.getByRole('dialog', { name: 'Settings' });

  // A demo-length session in a normal house: one minute of focus lights one candle.
  await page.keyboard.press(',');
  await dialog.getByRole('spinbutton', { name: /^Focus/ }).fill('1');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('digits')).toHaveText('01:00');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await page.clock.runFor(61_000);
  await expect(page.getByTestId('phase')).toHaveText('Short break');
  await expect(page.getByTestId('announcer')).toContainText('Session complete');
  await expect(page.getByTestId('announcer')).toHaveText(/Short break (started|is ready)/);
  await expect(scene).toHaveAttribute('aria-label', /1 of 4 candles lit/);

  // Export from settings.
  await page.keyboard.press(',');
  await expect(dialog).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export house' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^haunted-house-\d{4}-\d{2}-\d{2}\.json$/);
  const saved = testInfo.outputPath('house.json');
  await download.saveAs(saved);

  // Erase: "Keep it" changes nothing, "Erase the house" starts again from zero candles.
  await dialog.getByRole('button', { name: 'Erase all data…' }).click();
  await dialog.getByRole('button', { name: 'Keep it' }).click();
  await expect(scene).toHaveAttribute('aria-label', /1 of 4 candles lit/);
  await dialog.getByRole('button', { name: 'Erase all data…' }).click();
  await dialog.getByRole('button', { name: 'Erase the house' }).click();
  await expect(dialog).toBeHidden();
  await expect(scene).toHaveAttribute('aria-label', /0 of 4 candles lit/);

  // Import the file: the candle comes back. The "," shortcut works straight after the erase closes settings.
  await page.keyboard.press(',');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Import house').setInputFiles(saved);
  await expect(dialog.getByRole('status').filter({ hasText: 'House imported' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(scene).toHaveAttribute('aria-label', /1 of 4 candles lit/);

  // A damaged file is refused with a message and the candle stays.
  await page.keyboard.press(',');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Import house').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format": "haunted') });
  await expect(dialog.getByRole('status').filter({ hasText: 'not valid JSON' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(scene).toHaveAttribute('aria-label', /1 of 4 candles lit/);
});

// Req 11.13
test('export and import are switched off in the demo house, with a reason', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.keyboard.press(',');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('button', { name: 'Export house' })).toBeDisabled();
  await expect(dialog.getByLabel('Import house')).toBeDisabled();
  await expect(dialog).toContainText('Export and import are off in the demo house');
});
