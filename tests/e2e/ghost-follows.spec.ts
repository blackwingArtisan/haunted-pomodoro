import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installPausedClock, setTabHidden } from './helpers';

const icon = (page: Page) => page.locator('link[rel="icon"]').getAttribute('href');
const light = (page: Page) => page.getByRole('button', { name: 'Light a candle' }).click();
const STEP_MS = (25 * 60_000) / 24;

test.describe('favicon and title', () => {
  // Req ghost-follows-you:1.1, 1.2, 1.4, 1.6, 2.1, 2.2, 2.3
  test('the icon is static at rest, a candle that steps, the ghost while hidden, the candle on return', async ({ page }) => {
    await installPausedClock(page);
    await page.goto('/');
    await expect.poll(() => icon(page)).toBe('/icon.svg');

    await light(page);
    await expect.poll(async () => (await icon(page))?.startsWith('data:image/png')).toBe(true);
    const full = await icon(page);

    // Less than a step: the same icon. A little over one step: a new one.
    await page.clock.runFor(STEP_MS / 2);
    expect(await icon(page)).toBe(full);
    await page.clock.runFor(STEP_MS / 2 + 2_000);
    const stepped = await icon(page);
    expect(stepped).not.toBe(full);

    // Away: the ghost's face, at once. Back: the candle for the current step.
    await setTabHidden(page, true);
    const face = await icon(page);
    expect(face).not.toBe(stepped);
    await page.clock.runFor(1_000);
    expect(await icon(page)).not.toBe(face);
    await setTabHidden(page, false);
    expect(await icon(page)).toBe(stepped);
  });

  // Req ghost-follows-you:1.5, 1.6
  test('a break shows the break frame and a reset brings back the static icon', async ({ page }) => {
    await installPausedClock(page);
    await page.goto('/');
    await light(page);
    await page.keyboard.press('s');
    await expect(page.getByTestId('phase')).toHaveText('Short break');
    await page.getByRole('button', { name: 'Begin break' }).click();
    await expect.poll(async () => (await icon(page))?.startsWith('data:image/png')).toBe(true);
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect.poll(() => icon(page)).toBe('/icon.svg');
  });

  // Req ghost-follows-you:9.1, 9.2
  test('with reduced motion the hidden icon stays still and the wax still steps', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installPausedClock(page);
    await page.goto('/');
    await light(page);
    const full = await icon(page);
    await page.clock.runFor(STEP_MS + 2_000);
    const stepped = await icon(page);
    expect(stepped).not.toBe(full);
    await setTabHidden(page, true);
    const face = await icon(page);
    for (let i = 0; i < 3; i++) {
      await page.clock.runFor(1_000);
      expect(await icon(page)).toBe(face);
    }
  });

  // Req ghost-follows-you:3.1, 3.2, 3.3, 3.4, 3.6, 3.8
  test('the title shows the time, calls the person back while away and returns to the timer title', async ({ page }) => {
    await installPausedClock(page);
    await page.goto('/');
    await expect(page).toHaveTitle('Haunted Pomodoro');
    await light(page);
    await page.clock.runFor(10_000);
    await expect(page).toHaveTitle('24:50 · Focus · Haunted Pomodoro');
    await setTabHidden(page, true);
    await expect(page).toHaveTitle('Ottilie is here · 24:50 · Focus · Haunted Pomodoro');
    await page.clock.runFor(5_000);
    await expect(page).toHaveTitle('Come back… 24:45 left · Haunted Pomodoro');
    await setTabHidden(page, false);
    await expect(page).toHaveTitle(/^24:4\d · Focus · Haunted Pomodoro$/);
    expect(await page.title()).not.toMatch(/\d+ (time|times)|streak|wander/i);
  });
});

/** Opens Settings and returns the dialog. */
async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  // The dialog fades in over 0.35 s; axe must measure colors after that, not part-way through.
  await dialog.evaluate((el) => Promise.all(el.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  return dialog;
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const removeApi = () => {
  // Runs before the app: the browser has no Document Picture-in-Picture.
  delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture;
};
const standIn = () => {
  // A stand-in that never opens anything: only the presence of the API matters here.
  Object.defineProperty(window, 'documentPictureInPicture', {
    configurable: true,
    value: { requestWindow: () => Promise.reject(new DOMException('Not in this test', 'NotAllowedError')), window: null },
  });
};

test.describe('the setting', () => {
  // Req ghost-follows-you:4.1, 10.1, 10.2, 12.1
  test('is off by default, reached by Tab, toggled with Space and remembered after a reload', async ({ page }) => {
    await page.addInitScript(standIn);
    await page.goto('/');
    const dialog = await openSettings(page);
    const sw = dialog.getByRole('switch', { name: 'Let her follow me' });
    await expect(sw).not.toBeChecked();
    await expect(sw).toBeEnabled();
    await expect(sw).toHaveAttribute('aria-describedby', /follow-hint/);
    await expect(dialog.locator('#follow-hint')).toContainText('Off by default');
    await expect(dialog.getByRole('status').filter({ hasText: /^$/ }).first()).toBeAttached();

    // Tab from the switch before it, until the switch has focus.
    await dialog.getByRole('switch', { name: /Notify me/ }).focus();
    await page.keyboard.press('Tab');
    await expect(sw).toBeFocused();
    await page.keyboard.press('Space');
    await expect(sw).toBeChecked();
    // Turning it on opens nothing.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('phase')).toHaveText('Focus');

    await page.reload();
    const again = await openSettings(page);
    await expect(again.getByRole('switch', { name: 'Let her follow me' })).toBeChecked();
  });

  // Req ghost-follows-you:4.5, 10.3
  test('has no axe violations where the browser has the API', async ({ page }) => {
    await page.addInitScript(standIn);
    await page.goto('/');
    const dialog = await openSettings(page);
    await expect(dialog.locator('#follow-hint')).toContainText('A small window floats over other apps');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  // Req ghost-follows-you:4.4, 10.3, 12.4
  test('is disabled with its explanation where the API is missing, keeps its saved value and has no axe violations', async ({ page }) => {
    await page.addInitScript(standIn);
    await page.goto('/');
    let dialog = await openSettings(page);
    await dialog.locator('label.switch', { hasText: 'Let her follow me' }).click();
    await page.addInitScript(removeApi);
    await page.reload();
    dialog = await openSettings(page);
    const sw = dialog.getByRole('switch', { name: 'Let her follow me' });
    await expect(sw).toBeDisabled();
    await expect(sw).toBeChecked();
    await expect(dialog.locator('#follow-note')).toContainText('icon and title instead');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
    // The saved value was not rewritten: with the API back, it is still on.
    const saved = await page.evaluate(() => Object.values(localStorage).join(''));
    expect(saved).toContain('"ghostFollows":true');
  });

  // Req ghost-follows-you:12.5
  test('an erase keeps the setting as it was', async ({ page }) => {
    await page.addInitScript(standIn);
    await page.goto('/');
    let dialog = await openSettings(page);
    await dialog.locator('label.switch', { hasText: 'Let her follow me' }).click();
    await dialog.getByRole('button', { name: /Erase all data/ }).click();
    await dialog.getByRole('button', { name: 'Erase the house' }).click();
    dialog = await openSettings(page);
    await expect(dialog.getByRole('switch', { name: 'Let her follow me' })).toBeChecked();
  });
});
