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

test('demo mode fits a phone screen without sideways scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/?demo=1');
  await expect(page.getByTestId('primary')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await context.close();
});
