import type { Page } from '@playwright/test';

/**
 * Installs Playwright's fake clock and stops it. `clock.install` alone leaves the clock ticking with
 * real time, so on a slow machine the page clock moves between `runFor` and the assertion. Paused,
 * the page clock moves only when a test calls `runFor`, so exact times are deterministic.
 */
export async function installPausedClock(page: Page, time = new Date('2025-06-02T09:00:00')): Promise<void> {
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1_000));
}

/** Pretends the person switched tabs (or came back), the way the Page Visibility API reports it. */
export async function setTabHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (isHidden ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => isHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
