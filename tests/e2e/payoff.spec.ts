import { expect, test, type Locator } from '@playwright/test';

type Box = { top: number; bottom: number; left: number; right: number };

const rect = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Req 4.21, 4.24
test('lighting a candle washes the stage in one warm bloom, and the haunted room keeps a little color', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  const scene = page.locator('svg.scene').first();
  expect(await scene.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--restore')))).toBeCloseTo(0.08, 5);
  await expect(page.getByTestId('strike-bloom')).toHaveCount(0);

  await page.getByRole('button', { name: 'Light a candle' }).click();
  const bloom = page.getByTestId('strike-bloom');
  await expect(bloom).toHaveCount(1);
  await expect(bloom).toHaveCSS('animation-name', 'strike-bloom');
  await expect(bloom).toHaveCSS('animation-duration', '0.6s');
  await expect(bloom).toHaveCSS('animation-iteration-count', '1');
  await expect(bloom).toHaveCSS('mix-blend-mode', 'screen');
});

// Req 4.21
test('with reduced motion the bloom is a plain fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Light a candle' }).click();
  await expect(page.getByTestId('strike-bloom')).toHaveCSS('animation-name', 'strike-fade');
});

// Req 4.22, 4.23
test('the restored frame is clear: no caption or ghost line covers the portrait or the fireplace', async ({ browser }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.clock.install();
    await page.goto('/?demo=1');
    await page.getByRole('button', { name: 'Light a candle' }).click();
    await page.clock.runFor(21_000);
    const banner = page.getByTestId('restored-banner');
    const line = page.getByTestId('ghost-line');
    await expect(banner).toBeVisible();
    await expect(line).toContainText('A page of my book came back');
    // The ghost waits for the sweep before it speaks.
    await expect(line).toHaveCSS('animation-delay', '2.5s');

    // Measure the settled frame: the caption's letter-spacing eases in over 1.6 s.
    await banner.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    const scene = page.locator('svg.scene').first();
    const [portrait, fire, caption, words] = await Promise.all([rect(scene.locator('.portrait')), rect(scene.locator('.fire .flame.f2')), rect(banner.locator('.restored-name')), rect(line)]);
    expect(overlaps(caption, portrait), `caption over the portrait at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(overlaps(caption, fire), `caption over the fire at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(overlaps(words, portrait), `ghost line over the portrait at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(overlaps(words, fire), `ghost line over the fire at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(overlaps(words, caption), `ghost line over the caption at ${viewport.width}x${viewport.height}`).toBe(false);
    await context.close();
  }
});

// Req 4.25
test('the candle warms the room minute by minute: the light pool grows with the session and stays lit once restored', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=1');
  const scene = page.locator('svg.scene').first();
  const pool = scene.getByTestId('light-pool');
  const session = () => scene.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--session')));
  // Read where the pool is heading, not where its 1.5 s ease has got to in real time.
  await page.addStyleTag({ content: '.scene .light-pool { transition: none !important; }' });
  const opacity = async () => parseFloat(await pool.evaluate((el) => getComputedStyle(el).opacity));
  expect(await session()).toBe(0);
  expect(await opacity()).toBe(0);

  await page.getByRole('button', { name: 'Light a candle' }).click();
  await expect(scene.locator('.candle-burning .flame-group')).toHaveCSS('animation-name', 'ignite, candle-flicker');
  await page.clock.runFor(5_000);
  const early = await opacity();
  await page.clock.runFor(10_000);
  const late = await opacity();
  expect(await session()).toBeGreaterThan(0.7);
  expect(early).toBeGreaterThan(0);
  expect(late).toBeGreaterThan(early + 0.2);

  await page.clock.runFor(6_000);
  await expect(page.getByTestId('restored-banner')).toBeVisible();
  expect(await opacity()).toBeCloseTo(0.45, 2);
});

// Req 4.26
test('a haunted room has dark edges and the odd flash of lightning; a restored room and reduced motion have none', async ({ browser }) => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await page.clock.install();
    await page.goto('/?demo=1');
    const scene = page.locator('svg.scene').first();
    const lightning = scene.getByTestId('lightning');
    await expect(scene.locator('.haunt-vignette')).toHaveCount(1);
    expect(parseFloat(await scene.locator('.haunt-vignette').evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.75);
    if (reducedMotion === 'reduce') {
      await expect(lightning).toHaveCSS('animation-name', 'none');
      await expect(lightning).toHaveCSS('opacity', '0');
    } else {
      await expect(lightning).toHaveCSS('animation-name', 'lightning');
      await expect(lightning).toHaveCSS('animation-duration', '19s');
    }
    await page.getByRole('button', { name: 'Light a candle' }).click();
    await page.clock.runFor(21_000);
    await expect(page.getByTestId('restored-banner')).toBeVisible();
    await expect(lightning).toHaveCount(0);
    await expect(scene.locator('.haunt-vignette')).toHaveCount(0);
    await context.close();
  }
});

// Req 4.27
test('every room after the Parlor has its own set dressing, and the mantel candles never move', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.keyboard.press('h');
  const preview = page.locator('.room-preview svg.scene');
  const candles = () => preview.locator('.candle').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
  await page.getByRole('button', { name: /^The Parlor/ }).click();
  await expect(preview.locator('.room-dressing')).toHaveCount(0);
  const parlorCandles = await candles();
  const rooms: ReadonlyArray<readonly [string, string]> = [
    ['The Library', 'library'],
    ['The Conservatory', 'conservatory'],
    ['The Music Room', 'music-room'],
    ['The Nursery', 'nursery'],
    ['The Observatory', 'observatory'],
  ];
  for (const [name, id] of rooms) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(preview).toHaveAttribute('data-room', id);
    for (const layer of ['back', 'front']) await expect(preview.getByTestId(`dressing-${layer}`)).toHaveAttribute('data-room', id);
    expect(await candles()).toEqual(parlorCandles);
  }
});
