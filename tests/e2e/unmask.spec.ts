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
  expect(before.wanderings).toBe('Came back 1 time');

  // Costume off: the scene is gone and a plain Pomodoro shows the same numbers.
  await page.getByTestId('unmask').click();
  await expect(page.getByTestId('unmask')).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(1_200);
  await expect(page.locator('svg.scene')).toHaveCount(0);
  await expect(page.getByTestId('plain-stage')).toBeVisible();
  await expect(page.getByTestId('room-title')).toHaveText('Focus timer');
  await expect(page.getByTestId('plain-comebacks-this-session')).toContainText('1');
  await expect(page.getByTestId('plain-comebacks-this-session')).toContainText('In costume: the ghost, the comeback counter');
  await expect(page.getByTestId('plain-comebacks-today')).toContainText("the will-o'-wisps");
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
  await page.clock.runFor(1_200);
  await expect(page.locator('svg.scene')).toHaveCount(1);
  await expect(page.getByTestId('room-title')).toHaveText('The Parlor');
  await expect(page.getByTestId('wisps')).toHaveAttribute('data-count', '1');
  expect(await stateText(page)).toEqual(before);

  // The session carries on in either view: unmask, resume, finish, and the room is restored underneath.
  await page.keyboard.press('u');
  await page.clock.runFor(1_200);
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId('plain-goals-finished')).toContainText('1');
  await page.keyboard.press('u');
  await page.clock.runFor(1_200);
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

// Req 7.23
test('unmasking is a costume change: the drapes close, the ghost tugs her sheet, and they open on the plain view', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  await page.clock.runFor(2_500);
  await page.getByTestId('unmask').click();
  const curtain = page.getByTestId('costume-curtain');
  await expect(curtain).toHaveAttribute('data-phase', 'closing');
  await expect(curtain.locator('.costume-sheet')).toHaveCount(1);
  // The house stays on stage until the drapes have closed.
  await expect(page.locator('svg.scene')).toHaveCount(1);
  await page.clock.runFor(600);
  await expect(curtain).toHaveAttribute('data-phase', 'opening');
  await expect(page.getByTestId('plain-stage')).toBeVisible();
  await expect(page.locator('svg.scene')).toHaveCount(0);
  await page.clock.runFor(600);
  await expect(curtain).toHaveCount(0);

  // Costume back on: the same change in reverse, ending on a candle strike.
  await expect(page.getByTestId('strike-bloom')).toHaveCount(0);
  await page.keyboard.press('u');
  await expect(curtain).toHaveAttribute('data-phase', 'closing');
  await page.clock.runFor(600);
  await expect(page.locator('svg.scene')).toHaveCount(1);
  await expect(page.getByTestId('strike-bloom')).toHaveCount(1);
  await page.clock.runFor(600);
  await expect(curtain).toHaveCount(0);
});

// Req 7.23
test('with reduced motion the costume comes off at once, with no drapes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/?demo=1');
  await page.getByTestId('unmask').click();
  await expect(page.getByTestId('plain-stage')).toBeVisible();
  await expect(page.getByTestId('costume-curtain')).toHaveCount(0);
  await page.keyboard.press('u');
  await expect(page.locator('svg.scene')).toHaveCount(1);
  await expect(page.getByTestId('costume-curtain')).toHaveCount(0);
});

// Req 7.24
test('the plain timer drops its costume and sits below the plain view at 1440x900', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/?demo=1');
  await page.getByTestId('unmask').click();
  const plaque = page.locator('.plaque');
  expect(await plaque.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('none');
  await expect(page.getByTestId('digits')).toHaveCSS('text-shadow', 'none');
  const [stage, timer] = await Promise.all([
    page.getByTestId('plain-stage').evaluate((el) => el.getBoundingClientRect().bottom),
    plaque.evaluate((el) => el.getBoundingClientRect().top),
  ]);
  expect(timer).toBeGreaterThanOrEqual(stage);
  // The plain view and the whole timer still fit the first view.
  await expect(page.getByTestId('primary')).toBeInViewport({ ratio: 1 });
  // Tiles are as tall as their content: no tile is more than twice the shortest.
  const heights = await page.locator('.plain-row:not(.is-wide)').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeLessThanOrEqual(Math.min(...heights) * 2);
  expect(Math.max(...heights)).toBeLessThan(140);
  await context.close();
});
