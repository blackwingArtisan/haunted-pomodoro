---
inclusion: always
---
# Tech stack and engineering rules

## Stack
- TypeScript everywhere, `strict` with `noUncheckedIndexedAccess`. Node 20.19+ for tooling.
- React 19 single-page app built with Vite. No UI framework; plain CSS with design tokens (custom properties) in `src/styles.css`.
- The scene is hand-drawn inline SVG (`src/ui/Scene.tsx`). Restoration is driven by CSS custom properties (`--restore`, `--lit`, `--hearth`) so a single number moves saturation, cobweb opacity and portrait tilt together.
- Fonts are self-hosted through `@fontsource` (IM Fell English SC, Cinzel, Cormorant Garamond), so the app works offline.
- PWA: `public/manifest.webmanifest` and a service worker generated at build time by a small Vite plugin in `vite.config.ts` that precaches every built asset.
- Tests: Vitest for unit tests (node environment), Playwright for end-to-end tests against the production build served by `vite preview`.
- Deploy target (free): Cloudflare Pages (static `dist/`). Optional sync Worker on Cloudflare Workers + KV free tier. Not deployed from this repository.

## Architecture rules
- `src/core/` is pure: no DOM, no `Date.now()`, no storage. Every function that depends on time takes `now` (or a `Clock`) as an argument.
- The timer is a state machine (`src/core/timer.ts`): `step(state, action, now, config)` returns `{ state, effects }`. The app reducer (`src/core/model.ts`) turns effects into domain changes (light a candle, log the day) and **cues** for the UI (sounds, announcements, ghost lines).
- A tick that changes nothing must return the same object, so the controller does not persist or re-render needlessly.
- Anything read from storage or the network is untrusted: `parseModel` rebuilds a valid model field by field and never throws.

## Adapters
Every external service sits behind an interface with a free local default.

| Port | Local (default) | Real (written, type-checked, not called by default) | Selected by |
|---|---|---|---|
| `HouseStore` | `LocalHouseStore` (localStorage) | `CloudflareHouseStore` (Worker + Workers KV, last-writer-wins with a merge on 409) | `VITE_HOUSE_STORE=local\|cloudflare`, `VITE_SYNC_URL` |
| Sound | Web Audio synthesis in the browser | none needed | `settings.muted`, `settings.volume` |

The real adapter is unit tested against the Worker handler through a stubbed `fetch`; no test touches the network.

## Testing rules
- Unit tests for every rule in `src/core` (timer transitions, distraction counting, streak math across days with an injectable clock, house progress, persistence round-trip, merge).
- End-to-end tests drive the real app in Chromium with Playwright's fake clock. Visibility changes are simulated by overriding `document.visibilityState` and dispatching `visibilitychange`.
- Chromium is launched with `--disable-audio-output`.
- Every commit passes `npm run typecheck`, `npm test` and `npm run test:e2e` from a clean checkout.
