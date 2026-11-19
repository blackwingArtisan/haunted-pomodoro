---
inclusion: always
---
# Repository structure

```
src/
  core/            Pure domain logic, no DOM
    clock.ts       Clock interface, system clock, manual clock for tests
    dates.ts       Local day keys and DST-safe day arithmetic
    timer.ts       Timer state machine (focus, short break, long break, pause, skip, reset, distractions)
    house.ts       Rooms, candles per room, restoration progress
    streak.ts      The Hearth: forgiving streak math
    model.ts       App model, settings, tasks, reducer, cues, demo timer lengths
    snapshot.ts    Serialize, defensive parse, merge of two copies
  adapters/store/  HouseStore port: local (localStorage) and cloudflare (sync Worker)
  app/             HouseController (holds the model, persists, emits cues) and the demo seed
  audio/sound.ts   Web Audio synthesized sound effects and ambient wind
  audio/levels.ts  Pure level measurements (peak, RMS, tail) of rendered samples
  audio/render.ts  Renders each sound offline and judges it against the level limits
  sound-check/     The /sound-check.html page: waveform, levels and a Play button per sound
  ui/              Scene.tsx (the SVG room and ghost), panels.tsx (plaque, ledger, hearth, dialogs), icons.tsx
  App.tsx          Wiring: ticker, Page Visibility, keyboard shortcuts, cues to sound and announcements
  styles.css       Tokens, layout, scene animation, reduced-motion overrides
worker/            Optional Cloudflare Worker for sync (Workers KV)
sound-check.html   Second Vite entry for the sound check page
public/            Manifest and icons
scripts/           make-icons.mjs renders the PNG icons from icon.svg
tests/unit/        Vitest
tests/e2e/         Playwright
.kiro/             Steering, specs and hooks for Kiro
```

## Conventions
- File names are kebab-case for modules, PascalCase for React components.
- New domain behavior goes in `src/core` with a unit test before any UI is wired to it.
- UI strings live next to the component that shows them. Use sentence case and a kind tone.
- Test ids (`data-testid`) are only added where a role or label cannot identify the element.
