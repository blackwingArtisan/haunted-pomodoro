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
- A phase completes at its exact `endsAt`, and the next phase is timed from that moment, so a late tick never shortens a break (Req 1.2).
- Absences are settled on `visible`, on `pause` and at the end of focus (Req 3.3 to 3.5).

### App reducer (`src/core/model.ts`)
- `reduceApp(model, action, now, configFor)` wraps the timer and owns tasks, settings and the day log.
- `configFor` maps settings to timer lengths; demo mode passes `demoConfigFor` (Req 9.1).
- Returns cues: `candleLit`, `candleSnuffed`, `sessionComplete`, `roomRestored`, `breakStarted`, `breakOver`, `ghostWoke`, `ghostReturned`, `phase`.

### House (`src/core/house.ts`)
- Stored as `{ candlesLit, roomsRestored }`; the current room, house number and rooms in this house are derived (Req 4.5).
- `houseScore` gives total candles, used when merging copies so progress never goes backward (Req 4.6).

### Streak (`src/core/streak.ts`)
- `computeStreak(activeDays, today, graceDays = 1)` returns current, best, litToday, warmUntil and activeDays. Day arithmetic uses UTC day numbers from local day keys, so daylight-saving changes cannot break it (Req 5.1 to 5.3).

### Scene (`src/ui/Scene.tsx`)
- One SVG (1200 x 700 viewBox): wallpaper pattern per room, window with moon and a bare tree, fireplace whose fire follows the streak, a portrait whose pupils follow the pointer, four candles, a room prop (clock, books, fern, piano, rocking horse, telescope), cobwebs and the ghost.
- CSS custom properties: `--restore` (0 to 1) drives saturation, brightness, sepia, cobweb opacity and portrait tilt; `--lit` drives candle warmth; `--hearth` drives the fire.
- The ghost has four spots (in the window, by the window, beside the clock, center stage) and moods (asleep, watching, awake, calling). CSS transitions move it; reduced motion jumps instead.

### Controller and wiring (`src/app/controller.ts`, `src/App.tsx`)
- `HouseController` runs the reducer, persists only real changes and emits cues.
- `App` runs a 250 ms ticker, listens to `visibilitychange`, maps keys to actions, and turns cues into sounds, live-region announcements and ghost lines.

### Sound (`src/audio/sound.ts`)
- `SoundEngine` creates the AudioContext on the first gesture. Effects: candle, snuff, chime (inharmonic bell partials), restored (arpeggio), breath (filtered noise swell), moan (filtered sawtooth with vibrato), rattle (bandpassed noise clicks), ambient wind (brown noise, LFO-swept lowpass, low drone).

### Offline (`vite.config.ts`)
- A build plugin emits `sw.js` with a hashed cache name and the list of built assets. Pages are network first with the cached shell as fallback; assets are cache first.

## Data model
```ts
interface AppModel {
  version: 1;
  settings: Settings;          // lengths, auto-start, volume, mute, ambient, ghost calls, motion
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
- Unit: timer transitions and edge cases, distraction counting, streak math across days, DST and month ends with a manual clock, house progress, reducer effects, persistence round-trip, defensive parsing, merge, Worker handler and the Cloudflare store against a stubbed fetch.
- End-to-end (Playwright, production build, fake clock): the full demo arc (start, hide the tab, ghost calls, return, finish, room restored, break, next room); demo isolation; tasks, settings and a paused session across a reload; keyboard shortcuts; mute and volume; house map; offline reload; reduced motion; phone width.
