# Haunted Pomodoro

**Forest kills your tree when you look away. This ghost keeps your candle lit.**

A real Pomodoro timer wearing a haunted house: every focus session lights a candle, wandering off wakes a lonely ghost who counts it without taking anything away, and finished sessions restore the house room by room. Built for Kiroween 2026 (Costume Contest) by Stubborn Otter Software.

| Haunted | You wandered off | Restored |
|---|---|---|
| ![The parlor, still haunted, with cobwebs and a staring portrait](docs/screenshots/haunted.jpg) | ![The ghost has drifted closer and says: there you are, I kept your candle lit](docs/screenshots/ghost.jpg) | ![The parlor restored: warm colors, the portrait asleep, the Restored banner](docs/screenshots/restored.jpg) |

Try it in 30 seconds: `npm install && npm run dev`, then open `http://localhost:3180/?demo=1`.

## Why it matters
We drift constantly: Gloria Mark's logging studies put the average stretch on one screen before switching at about 47 seconds ([Mark, *Speaking of Psychology*, APA](https://www.apa.org/news/podcasts/speaking-of-psychology/attention-spans); [*Attention Span*, 2023](https://texasstandard.org/stories/attention-span-book-gloria-mark/)). Punishing the drift does not help either: among students who had procrastinated most before a first exam, those who forgave themselves for it procrastinated less before the next one ([Wohl, Pychyl and Bennett, 2010, *Personality and Individual Differences* 48(7), 803-808](https://doi.org/10.1016/j.paid.2010.01.029)). So this timer notices every wandering and forgives it.

## Who it is for
- Students and knowledge workers who use Pomodoro timers but drift into other tabs.
- People who quit a focus app because it punished them: a dead tree, a sad pet, a broken streak. If you have ADHD or simply drift a lot, wandering here is counted, never penalised. It is a timer, not a treatment.
- Anyone who wants their focus history to stay on their own device.

*A scenario, for illustration (not a user quote):* picture a student who deleted Forest after the fifth dead tree in a week. Here she wanders off twice, comes back to "There you are. I kept your candle lit.", finishes the session, and the parlor's color comes back anyway.

## Why not Forest?
| | When you look away mid-session | What you keep |
|---|---|---|
| [Forest](https://forestapp.cc/) | "Open another app, and the tree dies." (Forest's own FAQ) | Not that session's tree |
| [Focus Friend](https://apps.apple.com/app/id6742278016) | Stop the timer early and your bean is "really really sad" (its App Store listing) | A really really sad bean |
| **Haunted Pomodoro** | The ghost wakes, drifts closer and says something kind. The wandering is counted; the candle keeps burning. | Everything. No lit candle or restored room is ever taken away, and the Hearth forgives one missed day. |

The rule is written down and enforced, not just promised: [`.kiro/steering/product.md`](.kiro/steering/product.md) makes "Never punish" non-negotiable, and the [`never-punish-guard.json`](.kiro/hooks/never-punish-guard.json) hook re-checks it, and asks for a unit test, whenever house, streak, merge, reducer or import code changes.

## Why this is a costume
This is an entry for the **Costume Contest**: a real, daily-use Pomodoro timer wearing a haunted house. Take the costume off and every part still works as a timer: the candle is the progress bar, the ghost is the distraction counter, the Hearth is the streak, the house map is the long-term record, and breaks are the house breathing. The haunting is the interface itself: leaving the tab *is* what wakes the ghost.

## What works today
- **A real Pomodoro timer.** Configurable focus, short and long breaks, long break every N sessions, auto-start options, pause, resume, skip and reset. Time is kept as an absolute end time, so background tabs never drift, and a reload resumes exactly where you were.
- **Candles and rooms.** The drapes part over a brass title card when the house opens. Starting focus strikes a candle with a warm flare; it melts as the session runs while the room's color returns and the cobwebs thin. Four finished candles restore a room: the portrait stops staring and closes its eyes, the cobwebs fall, the clock starts ticking, and a band of warm light sweeps the wallpaper while the dust bursts off the room. Six rooms per house, each with its own prop (grandfather clock, library, conservatory, piano, rocking horse, telescope).
- **The ghost.** Switch tabs during focus (Page Visibility API) and the ghost wakes after a short grace period, drifts closer (by the third wandering it fills the room and its green glow gathers at the edges), rattles the room and changes the tab title to call you back. Come back and it says something kind. Wanderings are counted per session and per day.
- **A story to restore.** The ghost is the house's last owner, who never finished her book. Each restored room gives back a page of it in the ghost's journal (in the house map); six rooms finish the book, she rests, and a new house begins. She has fifteen things to say when you come back, chosen by the room and how often you have wandered, and none of them scold.
- **Breaks let the house breathe.** The room slowly swells and the curtains sway; the UI turns ghost-green.
- **The Hearth.** A streak that forgives one missed day between active days and never takes away a restored room. Fourteen-day candle chart, today's minutes, wanderings, best streak, a diary line in the ghost's voice ("Yesterday you lit three candles and left me twice. I counted the books while I waited.") and a weekly reflection ("This week: 11 candles, 4 h 35 min focused, 6 wanderings, down from 14."). It mentions wanderings going down, never up.
- **Task ledger.** Add tasks with planned candles, pick the active one, see candles spent, mark done, clear finished.
- **Sound, synthesized live.** Candle strike, bell chime, restoration arpeggio, ghost moan, rattle, break breath and optional ambient wind, all generated with Web Audio. Volume slider and mute on the main screen.
- **Sound check.** `/sound-check.html` renders every sound offline at full volume, draws its waveform, shows its peak, loudness and fade-out, and has a Play button for each. Every sound must peak between -28 and -1 dBFS and fade cleanly; the test suite enforces it. (This check caught a rattle that peaked at only -31 dBFS; it now uses white noise and peaks near -15.)
- **Fits the first view.** On desktop the stage scales with the window height, so the room, the timer and the Light a candle button are all visible at 1280x720 and up, with or without the demo banner.
- **Keyboard first.** Space, R, S, N, M, A, H, comma and ?. All controls are native, labelled and focus-visible; changes are announced in a live region.
- **Reduced motion.** Follows the system setting, or choose reduced or full theatre in settings.
- **Works offline.** Installable PWA with a generated service worker; fonts are self-hosted.
- **Private by default.** Everything lives in localStorage. Optional sync to a Cloudflare Worker is written and tested against a stub, and off unless configured.
- **Export and import.** Settings has "Export house", which downloads `haunted-house-YYYY-MM-DD.json`, and "Import house", which merges a saved file into the current house. The house with more candles wins, so an import never removes a candle or a room. Files over 1 MB, damaged files and files from another format version are refused with a message and change nothing. Both are disabled in demo mode.
- **Optional phase-end notification.** Off by default. "Notify me when a phase ends while this tab is hidden" asks for browser permission when you turn it on, turns itself off with a reason if permission is denied, and shows one notification per phase end only while the tab is hidden.
- **Demo mode.** `/?demo=1` runs a 20 second focus and a 10 second break in a demo house whose fully haunted parlor is restored by a single candle, without touching your own data.

## Beyond Kiroween
Focus apps are a proven market: Forest says more than 60 million people have used it since 2014 ([forestapp.cc](https://forestapp.cc/), checked November 2026). Haunted Pomodoro takes the opposite stance on distraction, and the plan keeps it cheap to run:
- **Free forever:** the whole local timer, house and Hearth, offline, with no account.
- **Sync, $2 a month or $15 a year:** the house on every device, through the Cloudflare Worker adapter that already exists behind the `HouseStore` port.
- **House packs, $3 each:** new houses with their own rooms, props, ghost and story (a lighthouse, a theatre, a ship).
- **Study-hall houses:** one shared house for a class or a team, where everyone's candles restore the same rooms. Body doubling, in the haunting's own language.

## Run it
```bash
npm install
npm run dev        # http://localhost:3180
npm run build && npm run preview   # production build with the service worker, http://localhost:3181
```
Open `http://localhost:3180/?demo=1` for the 30 second demo, and `http://localhost:3180/sound-check.html` to hear and measure every sound.

## Test it
```bash
npm run typecheck
npm test           # Vitest unit tests
npx playwright install chromium   # once
npm run test:e2e   # Playwright against the production build on port 3182 (set PW_PORT to change it)
npm run check      # all three
```
The end-to-end suite uses Playwright's fake clock to run the whole demo arc: light a candle, hide the tab, watch the ghost call, come back, finish the session, see the parlor restored, breathe through the break, and arrive in the library. It also covers reload persistence, keyboard shortcuts, sound controls, the house map, the first-visit guide, offline reload, reduced motion, a phone-width layout, first-view fit at 1280x720, 1366x768 and 1920x1080, level limits for all eight sounds rendered in Chromium's OfflineAudioContext, and export, erase and import of a house file, and axe-core WCAG 2.1 A/AA scans of the main screen, the restored room, settings (demo and normal house), the house map and the sound check page.

## Architecture
```
src/core        pure domain logic: timer state machine, house, streak, reducer, snapshot/merge, house file export and import
src/adapters    HouseStore port (local and cloudflare) and the Notifier port (browser and no-op)
src/app         HouseController (model + persistence + cues), demo seed
src/audio       Web Audio sound engine, offline renderer and level measurements
src/sound-check the /sound-check.html page
src/ui          SVG scene, plaque, ledger, hearth, dialogs
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

## Built with Kiro
- `.kiro/steering/`: product rules (never punish, honest timer, local data, accessible theatre), tech stack and structure.
- `.kiro/specs/haunted-focus-timer/` and `.kiro/specs/house-sync/`: EARS requirements, design and task lists mapped to requirement numbers. Open tasks are listed in the task lists, including gaps found in review.
- `.kiro/hooks/`: five `v1` hook files. `test-on-save.json` runs `npm test` when core, adapter, app, audio, Worker or unit-test files are saved. `core-tests.json` (converted from an older IDE-format file) has the agent fix code, not tests, against the spec. `never-punish-guard.json` restates the forward-only rule after edits to house, streak, snapshot, reducer or house-file code. `a11y-motion-guard.json` checks reduced motion, labels and focus after UI edits. `e2e-on-stop.json` runs `npm run check` (types, unit and Playwright) when a turn ends.
- [`KIRO-LOG.md`](KIRO-LOG.md) records what was drafted before Kiro ran and every Kiro call since, with prompts, results and credits.

## Credits
- Fonts, self-hosted through [Fontsource](https://fontsource.org) and licensed under the [SIL Open Font License 1.1](https://openfontlicense.org):
  - [Cinzel](https://fontsource.org/fonts/cinzel), copyright 2020 The Cinzel Project Authors.
  - [Cormorant Garamond](https://fontsource.org/fonts/cormorant-garamond), copyright 2015 The Cormorant Project Authors.
  - [IM Fell English SC](https://fontsource.org/fonts/im-fell-english-sc), from the Fell Types revival distributed through Google Fonts.
  - The full license text for all three ships with the site at [`public/licenses/fonts.txt`](public/licenses/fonts.txt) (served as `/licenses/fonts.txt`).
- Every illustration and sound was made for this project: the scene is hand-written SVG and the sounds are synthesized in the browser. No third-party images or recordings are used.
- Research cited above: Gloria Mark (UC Irvine) on screen attention; Michael Wohl, Timothy Pychyl and Shannon Bennett on self-forgiveness and procrastination.

## License
The code is MIT, see [LICENSE](LICENSE). The bundled fonts keep their own SIL Open Font License 1.1, listed under Credits.
