---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**", "src/styles.css", "src/App.tsx"]
---
# Scene art and the stage

Loaded whenever the scene, the panels, the stylesheet or the app shell is in play. The scene is the costume; these rules keep it legible, kind and accessible.

## How the scene is drawn
- One hand-written SVG in `src/ui/Scene.tsx`, `viewBox="0 0 1200 700"` with `preserveAspectRatio="xMidYMid slice"`, inside a 12:7 proscenium. No raster images, no third-party art.
- Restoration is one number: the CSS custom property `--restore` (0 haunted to 1 restored) drives color, cobwebs, the portrait's tilt and the haunted cast together. Never add a second, competing restoration variable. A haunted room keeps at least `RESTORE_FLOOR` (0.08) of its color.
- `--lit` (mantel candlesticks lit) drives candle warmth and `--hearth` (streak) drives the fire. The mantel always shows four candlesticks (`src/ui/candles.ts`), drawn at `CANDLE_SCALE`.
- Colors come from the tokens on `:root` in `src/styles.css`: `--candle` and `--ember` for warmth, `--ecto` for the ghost, `--brass` for frames and type, `--velvet` for drapes. New colors become tokens first.

## The payoff frame is sacred
- When a room is restored, nothing may cover the portrait or the fireplace. The Restored caption sits on the rug; the ghost's words sit beside the window and wait 2.5 s for the sweep to finish. `tests/e2e/payoff.spec.ts` measures this at 1440x900 and 1280x720; keep it green.
- The timer plaque overlaps the stage by 24 px at most.
- At 720 px and narrower the ghost speaks in a caption under the scene, never over it.

## Motion
- Every new animation needs a reduced-motion path under `[data-motion='reduced']`. Animations are switched off there; anything that carries meaning becomes a still or a plain opacity fade.
- Nothing animates in reaction to a wandering except the ghost drifting closer, a short rattle and the ghost-green vignette. No animation ever takes something away.

## Accessibility
- The scene is `role="img"` with a label that states the room, candles lit and the ghost's mood. Decorative parts are `aria-hidden`.
- Interactive elements are native buttons, inputs or links with an accessible name, at least 24 px tall, with a visible focus ring.
- Text keeps WCAG AA contrast on the dark theme; the axe scans in `tests/e2e/a11y.spec.ts` must report zero A/AA violations at desktop and 390 px.
