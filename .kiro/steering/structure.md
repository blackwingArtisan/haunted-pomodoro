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
    wisps.ts       Will-o'-wisps: one light per return from a wandering, never removed
    streak.ts      The Hearth: forgiving streak math
    model.ts       App model, settings, tasks, reducer, cues, demo timer lengths
    snapshot.ts    Serialize, defensive parse, merge of two copies
    house-file.ts  Export envelope and the import decision (size, format, version, forward-only merge)
    notice.ts      Wording of the phase-end notification from one change's cues
    favicon.ts     Favicon frames: the candle's 24 wax steps, the ghost's face, the break candle
    tab-title.ts   The tab title and formatClock, from the absolute end time
    follow.ts      The follow window's state machine and what the window shows (pipView)
    story.ts       Ottilie's lines (return lines, follow lines), the journal, the diary and the weekly reflection
  adapters/store/  HouseStore port: local (localStorage) and cloudflare (sync Worker)
  adapters/notify.ts  Notifier port: browser Notification API and a no-op default
  adapters/favicon.ts  FaviconPainter: draws each frame once on a 32 by 32 canvas, caches it, restores the static icon
  adapters/pip/    PipWindow port: Document Picture-in-Picture adapter, the window's document (content.ts), colors, fake, no-op
  app/             HouseController (holds the model, persists, emits cues, shows phase-end notifications through the Notifier), GhostFollower in follow.ts (reads the model; drives the icon, the title and the follow window; never dispatches) and the demo seed
  audio/sound.ts   Web Audio synthesized sound effects and ambient wind
  audio/levels.ts  Pure level measurements (peak, RMS, tail) of rendered samples
  audio/render.ts  Renders each sound offline and judges it against the level limits
  sound-check/     The /sound-check.html page: waveform, levels and a Play button per sound
  ui/              Scene.tsx (the SVG room and ghost), Unmasked.tsx (the plain view with the costume off), panels.tsx (plaque, ledger, hearth, dialogs, settings with export and import), icons.tsx
  App.tsx          Wiring: ticker, Page Visibility, keyboard shortcuts, cues to sound and announcements, the follower's start gesture and sync
  styles.css       Tokens, layout, scene animation, reduced-motion overrides
worker/            Optional Cloudflare Worker for sync (Workers KV)
sound-check.html   Second Vite entry for the sound check page
public/            Manifest and icons
scripts/           trace.mjs (criteria to tests), record-media.mjs (README GIF and preview image)
scripts/kiro/      guard.mjs (PreToolUse guard) and open-tasks.mjs (SessionStart task list) for Kiro hooks
tests/unit/        Vitest
tests/e2e/         Playwright
docs/kiro/         Hook commands run by hand, with their output
.kiro/steering/    Always: product, tech, structure. File match: scene-art (src/ui, styles, App), audio (src/audio, sound check)
.kiro/specs/       haunted-focus-timer, house-sync and ghost-follows-you: EARS requirements, design, tasks, traceability (tags for the newer specs are qualified, e.g. `// Req ghost-follows-you:2.3`)
.kiro/hooks/       v1 hook files: save, stop, PreToolUse guard, PostTaskExec trace, SessionStart task list, Manual demo-ready check
.kiro/agents/      ghost-reviewer: a read-only copy reviewer for tone and the never-punish rule
.kiro/settings/    mcp.json: Playwright MCP and Context7, pinned versions
```

## Conventions
- File names are kebab-case for modules, PascalCase for React components.
- New domain behavior goes in `src/core` with a unit test before any UI is wired to it.
- UI strings live next to the component that shows them. Use sentence case and a kind tone.
- Test ids (`data-testid`) are only added where a role or label cannot identify the element.
