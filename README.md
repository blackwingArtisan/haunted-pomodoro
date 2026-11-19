# Haunted Pomodoro

**A focus timer that lives in a haunted house: every focus session lights a candle, wandering off wakes the ghost, and finished sessions restore the house room by room.**

Built for Kiroween 2026 (Costume Contest) by Stubborn Otter Software.

| Haunted | You wandered off | Restored |
|---|---|---|
| ![The parlor, still haunted, with cobwebs and a staring portrait](docs/screenshots/haunted.jpg) | ![The ghost has drifted closer and says: there you are, I kept your candle lit](docs/screenshots/ghost.jpg) | ![The parlor restored: warm colors, the portrait asleep, the Restored banner](docs/screenshots/restored.jpg) |

## Who it is for
- Students and knowledge workers who use Pomodoro timers but drift away from them, or drift into other tabs.
- People who respond to a gentle nudge better than to site blockers or guilt.
- Anyone who wants their focus history to stay on their own device.

## What works today
- **A real Pomodoro timer.** Configurable focus, short and long breaks, long break every N sessions, auto-start options, pause, resume, skip and reset. Time is kept as an absolute end time, so background tabs never drift, and a reload resumes exactly where you were.
- **Candles and rooms.** Starting focus lights a candle that melts as the session runs while the room's color returns and the cobwebs thin. Four finished candles restore a room: the portrait stops staring and closes its eyes, the cobwebs fall, the clock starts ticking. Six rooms per house, each with its own prop (grandfather clock, library, conservatory, piano, rocking horse, telescope).
- **The ghost.** Switch tabs during focus (Page Visibility API) and the ghost wakes after a short grace period, drifts closer, rattles the room and changes the tab title to call you back. Come back and it says something kind. Wanderings are counted per session and per day.
- **Breaks let the house breathe.** The room slowly swells and the curtains sway; the UI turns ghost-green.
- **The Hearth.** A streak that forgives one missed day between active days and never takes away a restored room. Fourteen-day candle chart, today's minutes, wanderings, best streak.
- **Task ledger.** Add tasks with planned candles, pick the active one, see candles spent, mark done, clear finished.
- **Sound, synthesized live.** Candle strike, bell chime, restoration arpeggio, ghost moan, rattle, break breath and optional ambient wind, all generated with Web Audio. Volume slider and mute on the main screen.
- **Keyboard first.** Space, R, S, N, M, A, H, comma and ?. All controls are native, labelled and focus-visible; changes are announced in a live region.
- **Reduced motion.** Follows the system setting, or choose reduced or full theatre in settings.
- **Works offline.** Installable PWA with a generated service worker; fonts are self-hosted.
- **Private by default.** Everything lives in localStorage. Optional sync to a Cloudflare Worker is written and tested against a stub, and off unless configured.
- **Demo mode.** `/?demo=1` runs a 20 second focus and a 10 second break in a house whose parlor is one candle from restored, without touching your own data.

## Run it
```bash
npm install
npm run dev        # http://localhost:3180
npm run build && npm run preview   # production build with the service worker, http://localhost:3181
```
Open `http://localhost:3180/?demo=1` for the 30 second demo.

## Test it
```bash
npm run typecheck
npm test           # Vitest unit tests
npx playwright install chromium   # once
npm run test:e2e   # Playwright against the production build on port 3182
npm run check      # all three
```
The end-to-end suite uses Playwright's fake clock to run the whole demo arc: light a candle, hide the tab, watch the ghost call, come back, finish the session, see the parlor restored, breathe through the break, and arrive in the library. It also covers reload persistence, keyboard shortcuts, sound controls, the house map, offline reload, reduced motion and a phone-width layout.

## Architecture
```
src/core        pure domain logic: timer state machine, house, streak, reducer, snapshot/merge
src/adapters    HouseStore port: local (localStorage) and cloudflare (sync Worker)
src/app         HouseController (model + persistence + cues), demo seed
src/audio       Web Audio sound engine
src/ui          SVG scene, plaque, ledger, hearth, dialogs
worker/         optional Cloudflare Worker (Workers KV) for sync
```
The core never reads the clock or touches the DOM: `step(state, action, now, config)` returns the next timer state and effects, and `reduceApp` turns those effects into candles, task credit, day logs and UI cues. The scene is one hand-drawn SVG whose restoration is driven by a single CSS custom property (`--restore`), so color, cobwebs and the portrait's tilt move together.

## Adapters: local and real
| Port | Local (default, used by the app and tests) | Real (written and type-checked, not called by default) | Switch |
|---|---|---|---|
| House store | `LocalHouseStore`: one JSON document in localStorage | `CloudflareHouseStore` + `worker/sync-worker.ts`: Workers KV, merge on conflict | `VITE_HOUSE_STORE=cloudflare` and `VITE_SYNC_URL` (see `.env.example`) |
| Sound | Web Audio synthesis | none needed | settings |

## Deploy (free)
The app is a static site: deploy `dist/` to Cloudflare Pages (free tier). The optional sync Worker deploys with `wrangler deploy` using `worker/wrangler.toml.example` and a free KV namespace. Nothing is deployed from this repository.

## Built with Kiro
- `.kiro/steering/`: product rules (never punish, honest timer, local data, accessible theatre), tech stack and structure.
- `.kiro/specs/haunted-focus-timer/` and `.kiro/specs/house-sync/`: EARS requirements, design and task lists mapped to requirement numbers.
- `.kiro/hooks/`: unit tests on core saves, a never-punish guard, an accessibility and motion guard, a full check on stop, and an IDE-format core-tests hook.
- [`KIRO-LOG.md`](KIRO-LOG.md) records what was drafted before Kiro ran and every Kiro call since.

## License
MIT, see [LICENSE](LICENSE).
