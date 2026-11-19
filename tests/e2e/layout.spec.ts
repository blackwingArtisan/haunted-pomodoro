import { expect, test, type Page } from '@playwright/test';
import { setTabHidden } from './helpers';

/** Bottom edge of an element, in viewport pixels. */
async function bottomOf(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().bottom);
}

const firstViews = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

for (const viewport of firstViews) {
  for (const path of ['/', '/?demo=1']) {
    // Req 7.6
    test(`the room and the whole timer fit the first view at ${viewport.width}x${viewport.height} on ${path}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(path);
      const primary = page.getByTestId('primary');
      await expect(primary).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId('digits')).toBeInViewport({ ratio: 1 });
      expect(await bottomOf(page, '.proscenium')).toBeLessThanOrEqual(viewport.height);
      expect(await bottomOf(page, '.plaque')).toBeLessThanOrEqual(viewport.height);
      await context.close();
    });
  }
}

// Req 7.13
test('demo mode fits a phone screen without sideways scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/?demo=1');
  await expect(page.getByTestId('primary')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await context.close();
});

// Req 7.15, 7.17
test('on a phone the demo banner is one line and the ghost speaks in a caption under the scene', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/?demo=1');
  const banner = page.locator('.demo-banner');
  await expect(banner.getByRole('button', { name: 'Leave the demo' })).toBeVisible();
  // One line: the text block is no taller than one line box.
  const text = await banner.locator('.demo-text').evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }));
  expect(text.height).toBeLessThanOrEqual(text.line * 1.2);

  await page.getByTestId('primary').click();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId('restored-banner')).toBeVisible();
  const line = page.getByTestId('ghost-line');
  await expect(line).toBeVisible();
  const box = (selector: string) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
  const [caption, scene, restored] = await Promise.all([box('[data-testid="ghost-line"]'), box('.proscenium'), box('[data-testid="restored-banner"]')]);
  expect(caption.top).toBeGreaterThanOrEqual(scene.bottom);
  expect(caption.top).toBeGreaterThanOrEqual(restored.bottom);
  expect(caption.left).toBeGreaterThanOrEqual(0);
  expect(caption.right).toBeLessThanOrEqual(390);
  await context.close();
});

// Req 7.18, 7.19
test('a first visit on a phone: one-line masthead, a labelled demo button and a one-line introduction above the room', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.tagline')).toBeHidden();
  const title = await page.locator('.brand h1').evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) }));
  expect(title.height).toBeLessThanOrEqual(title.line * 1.3);
  const demo = page.getByRole('button', { name: 'Try the 30 s demo' });
  await expect(demo).toBeVisible();
  expect(await demo.evaluate((el) => (el.querySelector('span') as HTMLElement).getBoundingClientRect().width)).toBeGreaterThan(60);
  const strip = page.getByTestId('intro-strip');
  await expect(strip).toBeVisible();
  await expect(strip.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#intro-title');
  const [stripBox, roomBox] = await Promise.all([strip.boundingBox(), page.getByTestId('room-title').boundingBox()]);
  expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(roomBox!.y);
  expect(stripBox!.height).toBeLessThanOrEqual(44);
  // Once the guide is dismissed, the strip goes too.
  await page.getByRole('button', { name: 'Enter the house' }).click();
  await expect(strip).toBeHidden();
  await context.close();
});

// Req 7.19
test('the one-line introduction is for phones only; desktops show the full guide beside the room', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('intro')).toBeVisible();
  await expect(page.getByTestId('intro-strip')).toBeHidden();
});

// Req 7.20
test('task checkboxes and footer links are at least 24 px tall, and the house map windows are decorative', async ({ page }) => {
  await page.goto('/?demo=1');
  const heights = await page.locator('.task input[type="checkbox"], .footer-links a').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThanOrEqual(5);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(24);
  await page.keyboard.press('h');
  const windows = page.locator('.facade-window');
  await expect(windows).toHaveCount(6);
  for (const w of await windows.all()) await expect(w).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.room-btn')).toHaveCount(6);
});

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const boxOf = (page: Page, selector: string): Promise<Box> => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().toJSON() as Box);
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Req 7.25
test('on a desktop the stage gets the screen and the timer sits beside it, never over the payoff frame', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/?demo=1');
  const scene = await boxOf(page, '.proscenium');
  expect(scene.width).toBeGreaterThanOrEqual(1440 * 0.6);
  expect(scene.bottom).toBeLessThanOrEqual(900);
  const plaque = await boxOf(page, '.plaque');
  expect(plaque.left).toBeGreaterThanOrEqual(scene.right);
  await expect(page.getByTestId('primary')).toBeInViewport({ ratio: 1 });

  await page.getByTestId('primary').click();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId('restored-banner')).toBeVisible();
  const caption = await boxOf(page, '[data-testid="restored-banner"]');
  expect(overlaps(caption, await boxOf(page, '.plaque'))).toBe(false);
  expect(caption.bottom).toBeLessThanOrEqual(scene.bottom);
  await context.close();
});

// Req 7.26
test('on a phone the stage is full-bleed and 280 px tall, the toolbar has words, and Skip is short but fully named', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/?demo=1');
  const scene = await boxOf(page, '.proscenium');
  expect(Math.round(scene.width)).toBe(390);
  expect(Math.round(scene.height)).toBe(280);
  const toolbar = page.getByRole('navigation', { name: 'House tools' });
  for (const name of ['House', 'Settings', 'Keys']) await expect(toolbar.getByText(name, { exact: true })).toBeVisible();
  const skip = page.getByRole('button', { name: 'Skip to break' });
  await expect(skip).toBeVisible();
  // The words a sighted user sees: everything but the screen-reader-only text.
  const shown = await skip.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.sr-only').forEach((n) => n.remove());
    return (copy.textContent ?? '').trim();
  });
  expect(shown).toBe('Skip');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByTestId('primary').click();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId('restored-banner')).toBeVisible();
  expect(overlaps(await boxOf(page, '[data-testid="restored-banner"]'), await boxOf(page, '.plaque'))).toBe(false);
  await context.close();
});

// Req 7.27
test('small capitals are at least 13 px, and the ghost speaks clear of the portrait and the clock face', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/?demo=1');
  const sizes = await page.evaluate(() =>
    ['.room-number', '.unmask-toggle', '.phase-label', '.working-on label', '.tool'].map((s) => [s, parseFloat(getComputedStyle(document.querySelector(s)!).fontSize)] as const),
  );
  for (const [selector, size] of sizes) expect(size, selector).toBeGreaterThanOrEqual(13);

  // Every spot the ghost can float to: one, two and three wanderings.
  await page.getByTestId('primary').click();
  for (let n = 1; n <= 3; n++) {
    await page.clock.runFor(1_000);
    await setTabHidden(page, true);
    await page.clock.runFor(2_500);
    await setTabHidden(page, false);
    await page.clock.runFor(3_000);
    const line = await boxOf(page, '[data-testid="ghost-line"]');
    expect(overlaps(line, await boxOf(page, '.scene .portrait')), `wandering ${n}: portrait`).toBe(false);
    expect(overlaps(line, await boxOf(page, '.scene .clock-hands')), `wandering ${n}: clock face`).toBe(false);
    const stage = await boxOf(page, '.proscenium');
    expect(line.left).toBeGreaterThanOrEqual(stage.left);
    expect(line.right).toBeLessThanOrEqual(stage.right);
  }
  await context.close();
});
