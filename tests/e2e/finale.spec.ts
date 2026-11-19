import { expect, test } from '@playwright/test';

// Req 9.7, 9.8, 12.9
test('the finale demo restores the last room, opens the book on its last page and shows a new house down the lane', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=finale');

  const scene = page.locator('svg.scene').first();
  await expect(page.getByTestId('room-title')).toHaveText('The Observatory');
  await expect(page.locator('.room-number')).toHaveText('Room 6 of 6');
  await expect(page.locator('.demo-banner')).toContainText('The last room.');

  // One 20-second focus session restores the Observatory and finishes the house.
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await page.clock.runFor(21_000);
  await expect(scene).toHaveAttribute('data-restored', 'true');
  await expect(page.getByTestId('restored-banner')).toContainText('The Observatory');
  // The heading still belongs to the house just finished while its last room is on show.
  await expect(page.locator('.room-number')).toHaveText('Room 6 of 6');
  await expect(page.getByTestId('ghost-line')).toHaveText('Every room is warm and my book is finished. I can rest now.');
  await expect(page.getByTestId('announcer')).toContainText('The whole house is restored and the book is finished.');
  await expect(page.getByRole('dialog', { name: 'The House' })).toHaveCount(0);

  // Once the sweep has played, the house opens on the last page.
  await page.clock.runFor(5_000);
  const dialog = page.getByRole('dialog', { name: 'The House' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('finale')).toContainText('The book is finished');
  await expect(page.getByTestId('finale')).toContainText('A lamp for every window, and a reader in every chair.');
  await expect(page.getByTestId('finale')).toContainText('A new house waits down the lane');
  await expect(page.getByTestId('journal-finale')).toBeVisible();

  // The new house is dark, and the finished one keeps its lamps lit up the hill.
  await expect(page.locator('svg.facade')).toHaveAttribute('aria-label', 'The house: 0 of 6 rooms restored. Up the hill, the house you finished keeps every window lit');
  await expect(page.getByTestId('finished-house')).toHaveCount(1);
  await expect(dialog).toContainText('1 house fully restored. This is house number 2.');

  // Closing it returns to the room; reopening the house later shows the map without the finale card.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('h');
  await expect(page.getByRole('dialog', { name: 'The House' })).toBeVisible();
  await expect(page.getByTestId('finale')).toHaveCount(0);
  await expect(page.getByTestId('journal-finale')).toBeVisible();
});

// Req 9.8
test('the finale waits for an open window instead of replacing it', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=finale');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await page.clock.runFor(21_000);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.clock.runFor(6_000);
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await expect(page.getByTestId('finale')).toHaveCount(0);
});
