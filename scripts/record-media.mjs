// Records the README hero GIF and the 1200x630 link-preview image from the real demo, so both can be
// remade whenever the scene changes. Needs a production build and ffmpeg on the PATH.
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
  await page.waitForTimeout(600);
  await page.getByTestId('primary').click();
  // The 20-second session, compressed: one second of demo time every 140 ms of film.
  for (let i = 0; i < 21; i++) {
    await page.clock.runFor(1_000);
    await page.waitForTimeout(140);
  }
  // The restoration sweep, the banner and the embers, in real time.
  await page.waitForTimeout(3_200);
  const filmSeconds = (Date.now() - filmStart) / 1000;
  const box = await page.locator('.proscenium').boundingBox();
  // For the still, hide the ghost's words so the restored room is unobstructed.
  await page.addStyleTag({ content: '[data-testid="ghost-line"] { visibility: hidden !important; }' });
  await page.waitForTimeout(100);
  await page.locator('.proscenium').screenshot({ path: join(work, 'restored.png') });
  await context.close();
  await browser.close();

  const video = (await readdir(work)).find((f) => f.endsWith('.webm'));
  if (!video || !box) throw new Error('No recording was made');
  // The timer plaque overlaps the bottom of the stage, so keep the top 86 percent of it.
  const crop = `crop=${Math.round(box.width)}:${Math.round(box.height * 0.86)}:${Math.round(box.x)}:${Math.round(box.y)}`;
  // Skip the first 0.4 s of blank page and stop before the still; 10 fps, 560 px wide, one shared palette.
  const filters = `${crop},fps=10,scale=560:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  const length = Math.max(1, filmSeconds - 0.6).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.4', '-t', length, '-i', join(work, video), '-filter_complex', filters, '-loop', '0', gifOut]);
  // 1200x630: the top of the restored stage, scaled to 1200 wide, with the Restored banner near the bottom.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(work, 'restored.png'), '-vf', 'scale=1200:-1:flags=lanczos,crop=1200:630:0:(ih-630)*0.35', ogOut]);
  console.log(`Wrote ${gifOut} and ${ogOut}`);
} finally {
  server.kill();
  await rm(work, { recursive: true, force: true });
}
