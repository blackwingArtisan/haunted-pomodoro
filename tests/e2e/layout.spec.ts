import { expect, test, type Page } from '@playwright/test';

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
