import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installPausedClock, setTabHidden } from './helpers';

/**
 * Headless Chromium has no real Document Picture-in-Picture window. This stand-in is installed before
 * the app runs. Like a browser, its requestWindow rejects with NotAllowedError unless the page has
 * transient user activation. It puts a titled iframe on the page and hands back that iframe's window,
 * so the app's real adapter and real renderer write into a real document.
 */
function installStandIn(page: Page, reject: boolean) {
  return page.addInitScript((rejectAll) => {
    const w = window as unknown as Record<string, unknown>;
    w.__pipRequests = 0;
    let current: { win: Window; frame: HTMLIFrameElement } | null = null;
    const closeCurrent = () => {
      if (!current) return;
      const { win, frame } = current;
      current = null;
      win.dispatchEvent(new Event('pagehide'));
      frame.remove();
    };
    w.__closePip = closeCurrent;
    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: {
      requestWindow() {
        (w.__pipRequests as number)++;
        if (!navigator.userActivation.isActive) return Promise.reject(new DOMException('Needs a user gesture', 'NotAllowedError'));
        if (rejectAll) return Promise.reject(new DOMException('Not here', 'NotSupportedError'));
        closeCurrent();
        const frame = document.createElement('iframe');
        frame.id = 'pip-standin';
        frame.title = 'Floating window';
        frame.style.cssText = 'position:fixed;right:8px;bottom:8px;width:280px;height:200px;border:0;z-index:9999';
        document.body.append(frame);
        const win = frame.contentWindow!;
        win.close = closeCurrent;
        current = { win, frame };
        return Promise.resolve(win);
      },
      window: null,
      },
    });
  }, reject);
}

const light = (page: Page) => page.getByRole('button', { name: 'Light a candle' }).click();
const pipFrame = (page: Page) => page.frameLocator('#pip-standin');
const frameCount = (page: Page) => page.locator('#pip-standin').count();
const requests = (page: Page) => page.evaluate(() => (window as unknown as { __pipRequests: number }).__pipRequests);
const ghostOpacity = (page: Page) => pipFrame(page).locator('svg.ghost').evaluate((el) => Number(getComputedStyle(el).opacity));
const closeFromOutside = (page: Page) => page.evaluate(() => (window as unknown as { __closePip(): void }).__closePip());

async function turnOnFollowing(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.locator('label.switch', { hasText: 'Let her follow me' }).click();
  await expect(dialog.getByRole('switch', { name: 'Let her follow me' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

async function start(page: Page, opts: { follow?: boolean; reject?: boolean; reduced?: boolean } = {}) {
  const { follow = true, reject = false, reduced = false } = opts;
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await installStandIn(page, reject);
  await installPausedClock(page);
  await page.goto('/');
  if (follow) await turnOnFollowing(page);
}

test.describe('the follow window', () => {
  // Req ghost-follows-you:4.2, 4.6, 5.1, 5.4, 5.5, 5.10, 6.1, 6.2, 6.7, 10.6
  test('opens only on "Light a candle", with the time, a line and a timer role', async ({ page }) => {
    await start(page);
    // Turning the setting on opened nothing, and ticks do not ask.
    await page.clock.runFor(3_000);
    expect(await frameCount(page)).toBe(0);
    expect(await requests(page)).toBe(0);

    await light(page);
    await expect(page.locator('#pip-standin')).toHaveCount(1);
    expect(await requests(page)).toBe(1);
    await expect(page.getByTestId('phase')).toHaveText('Focus');
    await expect(page.getByTestId('primary')).toContainText('Pause');
    const timer = pipFrame(page).getByRole('timer', { name: 'Time left' });
    await expect(timer).toHaveText(/^\d\d:\d\d$/);
    await expect(pipFrame(page).locator('.line')).not.toBeEmpty();
    await expect(pipFrame(page).locator('svg.ghost')).toHaveAttribute('aria-hidden', 'true');

    // The same time as the title, to the second; ticks never ask for another window.
    await page.clock.runFor(10_000);
    await expect(timer).toHaveText('24:50');
    await expect(page).toHaveTitle('24:50 · Focus · Haunted Pomodoro');
    expect(await requests(page)).toBe(1);
  });

  // Req ghost-follows-you:6.3, 6.4, 6.6, 8.8
  test('shows the ghost at full strength while away, fades on return and stays open', async ({ page }) => {
    await start(page);
    await light(page);
    await expect.poll(() => ghostOpacity(page)).toBeCloseTo(0.25, 2);
    await setTabHidden(page, true);
    await expect.poll(() => ghostOpacity(page)).toBeCloseTo(1, 2);
    await setTabHidden(page, false);
    await expect.poll(() => ghostOpacity(page)).toBeCloseTo(0.25, 2);
    await expect(page.locator('#pip-standin')).toHaveCount(1);
    // The time and the line are never faded.
    const timerOpacity = await pipFrame(page).getByRole('timer').evaluate((el) => getComputedStyle(el).opacity);
    expect(timerOpacity).toBe('1');
  });

  // Req ghost-follows-you:9.3, 9.4, 9.5, 9.6
  test('under reduced motion the fade is at once and the ghost is still', async ({ page }) => {
    await start(page, { reduced: true });
    await light(page);
    await setTabHidden(page, true);
    await expect.poll(() => ghostOpacity(page)).toBe(1);
    await setTabHidden(page, false);
    await expect.poll(() => ghostOpacity(page)).toBe(0.25);
    const ghost = pipFrame(page).locator('svg.ghost');
    expect(await ghost.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
    expect(await ghost.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    // Paused is still said in words.
    await page.getByTestId('primary').click();
    await expect(pipFrame(page).locator('.phase')).toContainText('Paused');
  });

  // Req ghost-follows-you:6.8
  test('says Paused and freezes the time', async ({ page }) => {
    await start(page);
    await light(page);
    await page.clock.runFor(5_000);
    await page.getByTestId('primary').click();
    await expect(pipFrame(page).locator('.phase')).toContainText('Paused');
    const frozen = await pipFrame(page).getByRole('timer').textContent();
    await page.clock.runFor(20_000);
    await expect(pipFrame(page).getByRole('timer')).toHaveText(frozen!);
    expect(await requests(page)).toBe(1);
  });

  // Req ghost-follows-you:5.7
  test('resuming a paused session asks for no new window', async ({ page }) => {
    await start(page);
    await light(page);
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    expect(await requests(page)).toBe(1);
  });

  // Req ghost-follows-you:7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 10.5
  test('closing it leaves the session running, says nothing, does not reopen, and the next session opens one', async ({ page }) => {
    await start(page);
    await light(page);
    await expect(page.locator('#pip-standin')).toHaveCount(1);
    await expect(page.getByTestId('announcer')).toHaveText('The ghost is following you in a small window.');
    await page.clock.runFor(10_000);
    await closeFromOutside(page);
    await expect(page.locator('#pip-standin')).toHaveCount(0);
    // Closing is not commented on (Req 7.3, 11.5): the live region keeps the opening note.
    await expect(page.getByTestId('announcer')).toHaveText('The ghost is following you in a small window.');
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('digits')).toHaveText('24:40');
    await expect(page.getByTestId('primary')).toContainText('Pause');
    expect(await frameCount(page)).toBe(0);
    expect(await requests(page)).toBe(1);

    // The setting is still on; the next session lit with a gesture opens a new window.
    await page.getByRole('button', { name: 'Reset' }).click();
    await light(page);
    await expect(page.locator('#pip-standin')).toHaveCount(1);
    expect(await requests(page)).toBe(2);
  });

  // Req ghost-follows-you:7.7
  test('a session that ends or is skipped closes the window', async ({ page }) => {
    await start(page);
    await light(page);
    await expect(page.locator('#pip-standin')).toHaveCount(1);
    await page.keyboard.press('s');
    await expect(page.locator('#pip-standin')).toHaveCount(0);
    await expect(page.getByTestId('phase')).toHaveText('Short break');
  });

  // Req ghost-follows-you:8.1, 8.2, 8.3, 8.8, 10.5
  test('a refused window leaves the timer running and says where the ghost went instead', async ({ page }) => {
    await start(page, { reject: true });
    await light(page);
    await expect(page.getByTestId('announcer')).toContainText('could not open here');
    expect(await frameCount(page)).toBe(0);
    await page.clock.runFor(5_000);
    await expect(page.getByTestId('digits')).toHaveText('24:55');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(await requests(page)).toBe(1);
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('#follow-note')).toContainText('icon and title instead');
  });

  // Req ghost-follows-you:4.7
  test('in demo mode the setting works the same way', async ({ page }) => {
    await start(page);
    await page.goto('/?demo=1');
    await light(page);
    await expect(page.locator('#pip-standin')).toHaveCount(1);
    await expect(pipFrame(page).getByRole('timer', { name: 'Time left' })).toHaveText('00:20');
  });

  // Req ghost-follows-you:4.8
  test('the setting never turns itself on and nothing asks the person to turn it on', async ({ page }) => {
    await start(page, { follow: false });
    await light(page);
    await page.clock.runFor(25 * 60_000 + 1_000);
    await page.reload();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('main')).not.toContainText(/Let her follow me/);
    await expect(page.getByTestId('announcer')).not.toContainText(/follow/i);
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('switch', { name: 'Let her follow me' })).not.toBeChecked();
  });

  // Req ghost-follows-you:5.1, 5.4
  test('with the setting off, nothing is requested', async ({ page }) => {
    await start(page, { follow: false });
    await light(page);
    await page.clock.runFor(5_000);
    expect(await requests(page)).toBe(0);
    expect(await frameCount(page)).toBe(0);
  });

  // Req ghost-follows-you:5.5, 12.6
  test('a reload leaves no window and requests none', async ({ page }) => {
    await start(page);
    await light(page);
    await expect(page.locator('#pip-standin')).toHaveCount(1);
    await page.reload();
    await page.clock.runFor(2_000);
    expect(await frameCount(page)).toBe(0);
    expect(await requests(page)).toBe(0);
    await expect(page.getByTestId('primary')).toContainText('Pause');
  });

  // Req ghost-follows-you:10.3, 10.6, 10.7
  test('the window has no axe violations', async ({ page }) => {
    await start(page);
    await light(page);
    await expect(pipFrame(page).getByRole('timer')).toBeVisible();
    // axe schedules its own page timers; they never fire on a paused clock, so let it run for the scan.
    await page.clock.resume();
    const results = await new AxeBuilder({ page }).include('#pip-standin').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  // Req ghost-follows-you:13.7
  test('makes no request beyond the app’s own assets', async ({ page }) => {
    const seen: string[] = [];
    page.on('request', (r) => seen.push(r.url()));
    await start(page);
    await light(page);
    await page.clock.runFor(30_000);
    await setTabHidden(page, true);
    await page.clock.runFor(5_000);
    await setTabHidden(page, false);
    const outside = seen.filter((u) => !/^(data:|about:|blob:)/.test(u) && new URL(u).origin !== new URL(page.url()).origin);
    expect(outside).toEqual([]);
  });
});

/** What the person keeps: tasks, days and house from the saved copy, without the settings. */
async function kept(page: Page) {
  return page.evaluate(() => {
    const raw = Object.values(localStorage).find((v) => v.includes('"days"'));
    const m = JSON.parse(raw!) as Record<string, unknown>;
    const snap = (m.snapshot ?? m) as Record<string, unknown>;
    // The fake clock also moves with real time between steps, so time away is compared to the second.
    const days = JSON.parse(JSON.stringify(snap.days), (k, v: unknown) => (k === 'awayMs' && typeof v === 'number' ? Math.round(v / 1000) : v)) as unknown;
    return { days, house: snap.house, tasks: snap.tasks };
  });
}

async function theSteps(page: Page, withWindow: boolean) {
  await light(page);
  await page.clock.runFor(10_000);
  await setTabHidden(page, true);
  await page.clock.runFor(8_000);
  await setTabHidden(page, false);
  await page.clock.runFor(5_000);
  if (withWindow) await closeFromOutside(page);
  await page.clock.runFor(5_000);
}

const BLAME = /\d+ (time|times)\b|wander|lost|missed|streak|away|failed|shame/i;

test.describe('never punish', () => {
  // Req ghost-follows-you:11.1, 11.2, 11.3, 11.5, 7.2
  test('opening, hiding, showing and closing the window change nothing the person kept', async ({ page, browser }) => {
    await start(page, { follow: true });
    await theSteps(page, true);
    // Closing adds no note: nothing the live region says mentions the window closing (Req 11.5).
    await expect(page.getByTestId('announcer')).not.toContainText(/closed/i);
    const withFollowing = await kept(page);
    const countWith = await page.getByTestId('wanderings').innerText();

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const other = await ctx.newPage();
    await start(other, { follow: false });
    await theSteps(other, false);
    const without = await kept(other);
    const countWithout = await other.getByTestId('wanderings').innerText();
    await ctx.close();

    expect(withFollowing).toEqual(without);
    expect(countWith).toBe(countWithout);
  });

  // Req ghost-follows-you:11.2
  test('the title, the window and the notes never name a count or a loss', async ({ page }) => {
    await start(page);
    await light(page);
    await page.clock.runFor(5_000);
    await setTabHidden(page, true);
    await page.clock.runFor(8_000);
    const frameText = await pipFrame(page).locator('main').innerText();
    await setTabHidden(page, false);
    await page.clock.runFor(2_000);
    expect(frameText).not.toMatch(BLAME);
    expect(await pipFrame(page).locator('main').innerText()).not.toMatch(BLAME);
    await expect(page.getByTestId('announcer')).not.toContainText(/lost|failed|missed/i);
  });
});
