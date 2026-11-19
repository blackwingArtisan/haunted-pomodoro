# Developing Haunted Pomodoro

How to run, test, build and deploy the app, and how the code is laid out. The [README](../README.md) is the tour; this is the workshop.

## Run it
```bash
npm install
npm run dev        # http://localhost:3180
npm run build && npm run preview   # production build with the service worker, http://localhost:3181
```
Open `http://localhost:3180/?demo=1` for the 30 second demo, `?demo=finale` for the last room and the end of the book, and `http://localhost:3180/sound-check.html` to hear and measure every sound.

Set `SITE_URL` (for example `SITE_URL=https://example.pages.dev npm run build`) so the link-preview tags point at an absolute image URL. `npm run media` rebuilds and re-records the README GIF, the README screenshots and the 1200x630 preview image from the live demo; it needs ffmpeg.


## Test it
```bash
npm run typecheck
npm test           # Vitest unit tests
npx playwright install chromium   # once
npm run test:e2e   # Playwright against the production build on port 3182 (set PW_PORT to change it)
npm run check      # all three
npm run trace      # map every acceptance criterion to its tests
npm run demo-ready # the demo arc, the payoff frame and the axe scans (also a Manual Kiro hook)
LIVE_URL=https://example.pages.dev npm run smoke   # three checks against a deployed copy
```
Each test names the acceptance criteria it checks (`// Req 3.2`), and [`traceability.md`](../.kiro/specs/haunted-focus-timer/traceability.md) lists the tests behind every criterion: 154 of the 163 criteria are named by a test, and the rest are listed by number and open as task 38.

The end-to-end suite uses Playwright's fake clock to run the whole demo arc: light a candle, hide the tab, watch the ghost call, come back, finish the session, see the parlor restored, breathe through the break, and arrive in the library. It also covers reload persistence, keyboard shortcuts, sound controls, the house map, the first-visit guide, offline reload, the link-preview tags and image size, reduced motion, a phone-width layout, first-view fit at 1280x720, 1366x768 and 1920x1080, level limits for all eight sounds rendered in Chromium's OfflineAudioContext, export, erase and import of a house file, will-o'-wisps, the Unmask switch keeping the state identical, the `?demo=finale` ending, shortcuts pressed straight after a window closes, and axe-core WCAG 2.1 A/AA scans of the main screen, the restored room, settings (demo and normal house), the house map, the plain view and the sound check page.


## Architecture
```
src/core        pure domain logic: timer state machine, house, streak, will-o'-wisps, story, reducer, snapshot/merge, house file export and import
src/adapters    HouseStore port (local and cloudflare) and the Notifier port (browser and no-op)
src/app         HouseController (model + persistence + cues), demo seed
src/audio       Web Audio sound engine, offline renderer and level measurements
src/sound-check the /sound-check.html page
src/ui          SVG scene, plaque, ledger, hearth, dialogs, the plain (unmasked) view
scripts/kiro    PreToolUse guard and SessionStart task list run by Kiro hooks
worker/         optional Cloudflare Worker (Workers KV) for sync
```
The core never reads the clock or touches the DOM: `step(state, action, now, config)` returns the next timer state and effects, and `reduceApp` turns those effects into candles, task credit, day logs and UI cues. The scene is one hand-drawn SVG whose restoration is driven by a single CSS custom property (`--restore`), so color, cobwebs and the portrait's tilt move together.


## Adapters: local and real
| Port | Local (default, used by the app and tests) | Real (written and type-checked, not called by default) | Switch |
|---|---|---|---|
| House store | `LocalHouseStore`: one JSON document in localStorage | `CloudflareHouseStore` + `worker/sync-worker.ts`: Workers KV, merge on conflict | `VITE_HOUSE_STORE=cloudflare` and `VITE_SYNC_URL` (see `.env.example`) |
| Sound | Web Audio synthesis | none needed | settings |
| Notifier | no-op (nothing shown) | `createBrowserNotifier`: the browser's Notification API, unit tested with a fake | settings, off by default |


## Deploy (free)
The app is a static site: deploy `dist/` to Cloudflare Pages (free tier). The optional sync Worker deploys with `wrangler deploy` using `worker/wrangler.toml.example` and a free KV namespace.
