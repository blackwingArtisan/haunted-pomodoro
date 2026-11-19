// Records the README hero GIF, the README screenshots and the 1200x630 link-preview image from the real
// demo, so all of them can be remade whenever the scene changes. Needs a production build and ffmpeg on the PATH.
// Run: npm run media   (builds first; serves dist/ on MEDIA_PORT, default 3183)
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.MEDIA_PORT ?? 3183);
const BASE = `http://localhost:${PORT}`;
const root = new URL('..', import.meta.url).pathname;
const gifOut = join(root, 'docs/media/hero.gif');
const ogOut = join(root, 'public/og-image.png');
const shotsDir = join(root, 'docs/screenshots');

/** Pretends the person switched tabs (or came back), the way the Page Visibility API reports it. */
async function setTabHidden(page, hidden) {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (isHidden ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => isHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/**
 * Film only: a small browser tab drawn over the stage's top corner, showing the page's real title and
 * icon, so the haunting in the tab reads without sound. It follows the title with a MutationObserver,
 * because the film runs on Playwright's fake clock.
 */
async function addTabInset(page) {
  await page.evaluate(() => {
    const stage = document.querySelector('.proscenium');
    if (!stage) return;
    const tab = document.createElement('div');
    tab.className = 'film-tab';
    tab.setAttribute('aria-hidden', 'true');
    tab.style.cssText =
      'position:absolute;z-index:40;left:5%;top:5%;display:flex;align-items:center;gap:10px;padding:9px 18px 9px 12px;border-radius:11px 11px 0 0;background:#2b2a33;color:#f2f1f7;font:600 21px/1.2 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.55);max-width:62%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    const icon = document.createElement('img');
    icon.src = '/icon.svg';
    icon.width = 22;
    icon.height = 22;
    const text = document.createElement('span');
    tab.append(icon, text);
    stage.append(tab);
    const show = () => {
      text.textContent = document.title;
      tab.style.background = document.title.startsWith('Come back') ? '#3b2f52' : '#2b2a33';
    };
    show();
    new MutationObserver(show).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
  });
}

/** Saves a full-window screenshot as a README JPEG through ffmpeg (quality 3 of 31). */
async function still(page, work, name) {
  // Kept apart from the film's restored.png, which the link-preview image is cut from.
  const png = join(work, `still-${name}.png`);
  await page.screenshot({ path: png });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '3', join(shotsDir, `${name}.jpg`)]);
}

/** The README stills: haunted, the ghost after a wandering, restored, the costume off, and the finale. */
async function recordStills(browser, work) {
  const viewport = { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(`${BASE}/?demo=1`);
  await page.waitForTimeout(3_200);
  await page.mouse.move(720, 300);
  await page.waitForTimeout(400);
  await still(page, work, 'haunted');
  await page.getByTestId('primary').click();
  await page.clock.runFor(5_000);
  await setTabHidden(page, true);
  await page.clock.runFor(2_500);
  await setTabHidden(page, false);
  await page.clock.runFor(300);
  await page.waitForTimeout(1_600);
  await still(page, work, 'ghost');
  await page.clock.runFor(4_000);
  // The costume change: the drapes close, the view swaps on a timer, and they open again.
  await page.keyboard.press('u');
  await page.clock.runFor(1_200);
  await page.waitForTimeout(1_600);
  await still(page, work, 'costume-off');
  await page.keyboard.press('u');
  await page.clock.runFor(1_200);
  await page.waitForTimeout(1_200);
  // Run the focus just past its end (the fake clock also moves during the real waits above), then let the
  // sweep play in real time; the 10-second break leaves room on a busy machine.
  await page.clock.runFor(3_600);
  await page.waitForTimeout(4_000);
  await page.getByTestId('restored-banner').waitFor();
  await still(page, work, 'restored');
  await context.close();

  const finale = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const last = await finale.newPage();
  await last.clock.install();
  await last.goto(`${BASE}/?demo=finale`);
  await last.waitForTimeout(3_200);
  await last.getByTestId('primary').click();
  await last.clock.runFor(21_000);
  await last.waitForTimeout(1_000);
  await last.clock.runFor(5_000);
  await last.waitForTimeout(1_500);
  await still(last, work, 'finale');
  await finale.close();

  // The week's postcard, saved from the Hearth in the week demo.
  const week = await browser.newContext({ viewport, acceptDownloads: true });
  const hearth = await week.newPage();
  await hearth.goto(`${BASE}/?demo=week`);
  const [download] = await Promise.all([hearth.waitForEvent('download'), hearth.getByRole('button', { name: 'Save this week’s postcard' }).click()]);
  const card = join(work, 'postcard.png');
  await download.saveAs(card);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', card, '-q:v', '3', join(shotsDir, 'postcard.jpg')]);
  await week.close();
}

async function waitForServer(url, ms = 20_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No server at ${url}`);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
const work = await mkdtemp(join(tmpdir(), 'haunted-media-'));
try {
  await waitForServer(BASE);
  const browser = await chromium.launch({ args: ['--disable-audio-output'] });
  const viewport = { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport, recordVideo: { dir: work, size: viewport }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const filmStart = Date.now();
  await page.clock.install();
  await page.goto(`${BASE}/?demo=1`);
  // The drapes part over the title card, then a beat on the fully haunted parlor.
  await page.waitForTimeout(3_000);
  await page.mouse.move(720, 300);
  await addTabInset(page);
  await page.waitForTimeout(600);
  await page.getByTestId('primary').click();
  // The 20-second session, compressed: one second of demo time every 140 ms of film.
  const burn = async (seconds) => {
    for (let i = 0; i < seconds; i++) {
      await page.clock.runFor(1_000);
      await page.waitForTimeout(140);
    }
  };
  await burn(4);
  // Wander off: the ghost wakes and calls. Come back: it says something kind and leaves a wisp.
  await setTabHidden(page, true);
  await page.clock.runFor(2_500);
  await page.waitForTimeout(900);
  await setTabHidden(page, false);
  await page.clock.runFor(200);
  await page.waitForTimeout(1_800);
  // Run the rest of the focus to just past its end, so the still lands early in the 10-second break.
  await burn(14);
  // The restoration sweep, the banner and the embers, in real time.
  await page.waitForTimeout(3_200);
  const filmSeconds = (Date.now() - filmStart) / 1000;
  const box = await page.locator('.proscenium').boundingBox();
  // For the still, hide the ghost's words and the tab inset so the restored room is unobstructed.
  await page.addStyleTag({ content: '[data-testid="ghost-line"], .film-tab { visibility: hidden !important; }' });
  await page.waitForTimeout(100);
  await page.locator('.proscenium').screenshot({ path: join(work, 'restored.png') });
  await context.close();
  await recordStills(browser, work);
  await browser.close();

  const video = (await readdir(work)).find((f) => f.endsWith('.webm'));
  if (!video || !box) throw new Error('No recording was made');
  // The whole stage: the timer sits beside it now, so nothing covers the rug.
  const even = (n) => Math.round(n / 2) * 2;
  const crop = `crop=${even(box.width)}:${even(box.height)}:${Math.round(box.x)}:${Math.round(box.y)}`;
  // Skip the first 0.4 s of blank page and stop before the still; 10 fps, GIF_WIDTH px wide (default 800), one shared palette.
  const gifWidth = Number(process.env.GIF_WIDTH ?? 800);
  const filters = `${crop},fps=10,scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  const length = Math.max(1, filmSeconds - 0.6).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.4', '-t', length, '-i', join(work, video), '-filter_complex', filters, '-loop', '0', gifOut]);
  // 1200x630: the top of the restored stage, scaled to 1200 wide, with the Restored banner near the bottom.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(work, 'restored.png'), '-vf', 'scale=1200:-1:flags=lanczos,crop=1200:630:0:(ih-630)*0.35', ogOut]);
  console.log(`Wrote ${gifOut}, ${ogOut} and the stills in ${shotsDir}`);
} finally {
  server.kill();
  await rm(work, { recursive: true, force: true });
}
