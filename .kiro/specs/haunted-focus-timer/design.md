# Design: Haunted focus timer

## Overview
A React single-page app with a pure domain core. Time, storage and the DOM sit at the edges so every rule can be unit tested with an injected clock.

```
 Page Visibility ─┐            ┌──────────────── src/core (pure) ───────────────┐
 keyboard/clicks ─┼─ actions ─▶│ reduceApp ──▶ step (timer) ──▶ effects          │
 250 ms ticker ───┘            │     │                          │                │
                               │     ├─ lightCandle (house)     │                │
                               │     └─ day log, tasks ◀────────┘                │
                               └──────────┬───────────────────────────┬──────────┘
                                          │ model                     │ cues
                               HouseController ── persist ──▶ HouseStore (local | cloudflare)
                                          │                           │
                                     React (Scene, plaque,      SoundEngine, live region,
                                      ledger, hearth)            ghost lines, tab title
```

## Components

### Timer state machine (`src/core/timer.ts`)
- State: `phase` (focus, short, long), `status` (idle, running, paused), `durationMs`, `remainingMs`, `endsAt`, `completedInCycle`, `distractions`, `awayMs`, `hiddenSince`, `ghostWoke`.
- Actions: `start`, `pause`, `resume`, `toggle`, `skip`, `reset`, `tick`, `hidden`, `visible`, `configure`.
- Effects: `focusStarted`, `focusCompleted`, `focusAbandoned`, `breakStarted`, `breakCompleted`, `ghostWoke`, `distracted`, `phaseChanged`.
- A phase completes at its exact `endsAt`, and the next phase is timed from that moment, so a late tick never shortens a break (Req 1.2, 1.18).
- Absences are settled on `visible`, on `pause` and at the end of focus (Req 3.3 to 3.5).
- Only a natural completion emits `focusCompleted` or `breakCompleted`; skip and reset do not, which is what keeps them out of phase-end notifications (Req 10.10).

### App reducer (`src/core/model.ts`)
- `reduceApp(model, action, now, configFor)` wraps the timer and owns tasks, settings and the day log.
- `configFor` maps settings to timer lengths; demo mode passes `demoConfigFor` (Req 9.1). `Settings.notifyPhaseEnd` is a boolean that `normalizeSettings` coerces with `=== true`, so an older save without it reads as off (Req 10.1).
- Returns cues: `candleLit`, `candleSnuffed`, `sessionComplete`, `roomRestored`, `breakStarted`, `breakOver`, `ghostWoke`, `ghostReturned`, `phase`.

### House (`src/core/house.ts`)
- Stored as `{ candlesLit, roomsRestored }`; the current room, house number and rooms in this house are derived (Req 4.5, 4.14).
- `houseScore` gives total candles, used when merging copies so progress never goes backward (Req 4.6; house-sync Req 3.3; Req 11.4).

### Streak (`src/core/streak.ts`)
- `computeStreak(activeDays, today, graceDays = 1)` returns current, best, litToday, warmUntil and activeDays. Day arithmetic uses UTC day numbers from local day keys, so daylight-saving changes cannot break it (Req 5.1 to 5.3).

### Scene (`src/ui/Scene.tsx`)
- One SVG (1200 x 700 viewBox): wallpaper pattern per room, window with moon and a bare tree, fireplace whose fire follows the streak, a portrait whose pupils follow the pointer, four candles, a room prop (clock, books, fern, piano, rocking horse, telescope), cobwebs and the ghost.
- CSS custom properties: `--restore` (0 to 1) drives saturation, brightness, sepia, cobweb opacity and portrait tilt; `--lit` drives candle warmth; `--hearth` drives the fire.
- The ghost has four spots (in the window, by the window, beside the clock, center stage) and moods (asleep, watching, awake, calling). CSS transitions move it; reduced motion jumps instead.

### Controller and wiring (`src/app/controller.ts`, `src/App.tsx`)
- `HouseController` runs the reducer, persists only real changes and emits cues. It also takes a `Notifier` and an `isHidden()` function (see Phase-end notification).
- `App` runs a 250 ms ticker, listens to `visibilitychange`, maps keys to actions, and turns cues into sounds, live-region announcements and ghost lines.

### Phase-end notification (`src/adapters/notify.ts`, `src/core/notice.ts`, `src/app/controller.ts`)
- Port: `Notifier { permission(), requestPermission(), show(title, body) }`. `noopNotifier` is the default and reports `unsupported`. `createBrowserNotifier()` wraps `Notification` with one tag, so a new notice replaces the old one. Tests pass a fake notifier.
- `phaseEndNotice(cues, endedPhase)` (pure) returns the title and body from the cues of one change. It returns null unless the cues contain `sessionComplete` or `breakOver`, so skip and reset never notify. The ended phase is the timer phase before the change.
- After each dispatch with cues, the controller notifies when the setting was on before the change, `isHidden()` is true, and permission is `granted`. One dispatch produces at most one notice, and a tick that changes nothing produces no cues, so late ticks cannot repeat a notice (Req 10.6 to 10.10).
- `setNotifyPhaseEnd(true)` is the only caller of `requestPermission()`, and only when permission is still `default` (Req 10.2, 10.3). Any answer other than `granted` leaves the setting off and returns the reason (Req 10.4). `reconcileNotifications()` runs at start-up and when a notice would fire; it turns the setting off with a reason if permission is `denied` or `unsupported`, and stays silent for `default` (Req 10.5, 10.13).
- Demo mode has no special case: it uses the same conditions with the saved setting (Req 10.11).
- If several phases end while the tab is throttled, each catch-up tick that completes a phase can notify once for that phase; they are not merged.

### Export and import (`src/core/house-file.ts`, settings in `src/ui/panels.tsx`, wiring in `src/App.tsx`)
- File shape: `{ format: "haunted-pomodoro-house", formatVersion: 1, exportedAt, snapshot }`, where `snapshot` is the output of `serializeModel`. The name is `haunted-house-YYYY-MM-DD.json` from `dayKey(now)` (Req 11.1, 11.2).
- `decideImport(text, current, now)` returns `{ ok: true, model, movedForward, message }` or `{ ok: false, reason, message }`. Order of checks: size in UTF-8 bytes (1 MiB limit), JSON, format name, format version, snapshot shape, then `parseModel` and `mergeModels(current, imported)` (Req 11.3 to 11.11). Because the merge keeps the higher `houseScore`, the larger day counts and the local timer, an import cannot lower progress (Req 11.4 to 11.6). The result's `updatedAt` is raised to `now` so a later sync pushes it.
- The page checks `file.size` with `importSizeProblem` before reading, so a large file is never loaded (Req 11.7). A refusal never touches the controller.
- The page hands the merged model to `controller.replace`, which persists it.
- Settings shows both controls in every mode; in demo mode they are disabled and `aria-describedby` points at the reason (Req 11.13). The result text is in a `role="status"` paragraph and is also sent to the live region (Req 11.15).

### Story and voice (`src/core/story.ts`)
- The ghost is Ottilie Vane, the house's last owner, whose book *A Lamp for Every Window* was left unfinished. `JOURNAL_PAGES` holds one page per room in room order and `JOURNAL_FINALE` the last page. `journalFor(house)` unlocks the first `roomsInThisHouse` pages and reports `finished` once any whole house is restored (Req 12.1 to 12.3).
- `returnLine(roomId, count)`: a room-specific line for the first return, then three pools (second, third, later) indexed by the room, 15 lines in all (Req 12.4).
- `diaryLine(days, today, roomId)` looks back up to 14 days for the latest day with a session; `weeklyReflection(days, today)` sums the last seven days against the seven before and only mentions the earlier count when wanderings went down (Req 12.5, 12.6).
- A unit test checks every line against a list of shaming words, so the never-punish rule covers the copy too (Req 12.7). Everything is data and pure functions; no network, no randomness (Req 12.8).

### Sound (`src/audio/sound.ts`)
- `SoundEngine` creates the AudioContext on the first gesture. Effects: candle, snuff, chime (inharmonic bell partials), restored (arpeggio), breath (filtered noise swell), moan (filtered sawtooth with vibrato), rattle (bandpassed noise clicks), ambient wind (brown noise, LFO-swept lowpass, low drone).

### Offline (`vite.config.ts`)
- A build plugin emits `sw.js` with a hashed cache name and the list of built assets. Pages are network first with the cached shell as fallback; assets are cache first.

## Data model
```ts
interface AppModel {
  version: 1;
  settings: Settings;          // lengths, auto-start, volume, mute, ambient, ghost calls, phase-end notification, motion
  tasks: Task[];               // id, title, estimate, spent, done, createdAt
  activeTaskId: string | null;
  days: Record<DayKey, DayLog>; // sessions, focusMs, distractions
  house: HouseState;           // candlesLit, roomsRestored
  timer: TimerState;
  updatedAt: number;
}
```
Stored as one JSON document under `haunted-pomodoro/v1`.

## Error handling
- Storage reads and writes are wrapped; a blocked or full store falls back to memory and the timer keeps running (Req 8.3).
- `parseModel` clamps numbers, drops malformed tasks and day keys, de-duplicates task ids, and resets an impossible timer (running without an end time) to idle.

## Testing strategy
- Unit: timer transitions and edge cases, distraction counting, streak math across days, DST and month ends with a manual clock, house progress, reducer effects, persistence round-trip, defensive parsing, merge, export and import decisions, the notifier port with a fake, Worker handler and the Cloudflare store against a stubbed fetch.
- End-to-end (Playwright, production build, fake clock): the full demo arc (start, hide the tab, ghost calls, return, finish, room restored, break, next room); demo isolation; tasks, settings and a paused session across a reload; keyboard shortcuts; mute and volume; house map; offline reload; reduced motion; phone width; export, erase and import of a house file.
