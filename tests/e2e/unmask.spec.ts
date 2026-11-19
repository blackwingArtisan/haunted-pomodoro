import { expect, test, type Page } from '@playwright/test';
import { setTabHidden } from './helpers';

/** Everything the person's state shows outside the scene: the timer plaque, the ledger and the Hearth. */
async function stateText(page: Page) {
  const read = (selector: string) => page.locator(selector).first().innerText();
  return {
    phase: await page.getByTestId('phase').innerText(),
    digits: await page.getByTestId('digits').innerText(),
    wanderings: await page.getByTestId('wanderings').innerText(),
    primary: await page.getByTestId('primary').innerText(),
    ledger: await read('section.ledger'),
    hearth: await read('section.hearth'),
    title: await page.title(),
  };
}

// Req 7.21, 7.22
test('unmask takes the costume off live and puts it back, with the timer, tasks and history unchanged', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await page.clock.runFor(4_000);
  await setTabHidden(page, true);
  await page.clock.runFor(2_500);
  await setTabHidden(page, false);
  await page.clock.runFor(200);
  await page.getByRole('button', { name: 'Pause' }).click();

  const before = await stateText(page);
  expect(before.wanderings).toBe('Wandered off 1 time');

  // Costume off: the scene is gone and a plain Pomodoro shows the same numbers.
  await page.getByTestId('unmask').click();
  await expect(page.getByTestId('unmask')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('svg.scene')).toHaveCount(0);
  await expect(page.getByTestId('plain-stage')).toBeVisible();
  await expect(page.getByTestId('room-title')).toHaveText('Focus timer');
  await expect(page.getByTestId('plain-distractions-this-session')).toContainText('1');
  await expect(page.getByTestId('plain-distractions-this-session')).toContainText('In costume: the ghost drifting closer');
  await expect(page.getByTestId('plain-distractions-today')).toContainText("the will-o'-wisps");
  await expect(page.getByTestId('plain-sessions-toward-this-goal')).toContainText('0 of 1');
  await expect(page.getByTestId('plain-streak')).toContainText('4 days');
  const bar = page.getByRole('progressbar', { name: 'Session progress' });
  const percent = Number(await bar.getAttribute('aria-valuenow'));
  expect(percent).toBeGreaterThan(0);
  expect(percent).toBeLessThan(100);
  expect(await stateText(page)).toEqual(before);

  // Costume back on with the U key: the same room, the same state.
  await page.keyboard.press('u');
  await expect(page.getByTestId('unmask')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('svg.scene')).toHaveCount(1);
  await expect(page.getByTestId('room-title')).toHaveText('The Parlor');
  await expect(page.getByTestId('wisps')).toHaveAttribute('data-count', '1');
  expect(await stateText(page)).toEqual(before);

  // The session carries on in either view: unmask, resume, finish, and the room is restored underneath.
  await page.keyboard.press('u');
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId('plain-goals-finished')).toContainText('1');
  await page.keyboard.press('u');
  await expect(page.locator('svg.scene').first()).toHaveAttribute('data-restored', 'true');
});

// Req 7.22
test('the plain view passes the same accessibility basics: named progress bar, no sideways scroll on a phone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/?demo=1');
  await page.getByTestId('unmask').click();
  await expect(page.getByRole('progressbar', { name: 'Session progress' })).toHaveAttribute('aria-valuenow', '0');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await context.close();
});
