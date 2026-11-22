# Kiro session 2: hook matchers and the ghost-follows-you spec

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive
- Command (repo root, stdin closed): `PW_PORT=3873 kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools=fs_read,fs_write,run_command,@context7 --output-format stream-json "<prompt>" </dev/null` (not `--trust-all-tools`)
- When: 2026-11-22, 21:22:04 to 21:33:23 UTC (11 min 19 s wall time, under a 25-minute cap); exit code 0
- Credits used: 15.37 (kiroween2026 `/usage` read 662.28 before and 689.44 after)
- Finished on its own in 11 min 19 s (exit code 0). 15.37 credits, read from kiro-cli's own `session_usage` event (`--output-format stream-json`). The shared account balance moved more because other Kiro work was running at the same time.
- Hook fix. Kiro changed the four PostFileSave matchers (`core-tests`, `test-on-save`, `a11y-motion-guard`, `never-punish-guard`) from a leading `^` to `(^|/)`, because kiro-cli tests them against absolute paths. It left the PreToolUse matchers alone, since they match tool names. It found that `guard.mjs` already reads `path` and `command`, so it did not change the script; it added a test for the `{path, text}`, `{path, oldStr, newStr}` and `{command}` payloads in `kiro-guard.test.ts`, and a test in `kiro-config.test.ts` that runs each save matcher against absolute paths and fails if any starts with `^`. It reran `npm run trace`, which refreshed one line of `traceability.md`.
- The spec, `.kiro/specs/ghost-follows-you/`: 13 requirements, 99 EARS criteria, 24 tasks with 20 sub-tasks, split into Session A (tasks 1 to 12, core and adapters) and Session B (tasks 13 to 24, app, settings and docs), and 10 open questions with recommended defaults. Kiro found that `scripts/trace.mjs` reads only the first spec and `kiro-config.test.ts` reads none, and added task 11 to extend both.
- MCP, on the record: `@context7/resolve-library-id` once (it resolved `/wicg/document-picture-in-picture`) and `@context7/query-docs` three times, for `requestWindow` and its options, the errors it rejects with, `pagehide` and the one-window-per-tab rule. Kiro cited them under Sources in design.md. Context7 gave no browser support list, so Kiro marked its browser-support and headless-behavior notes as unverified.
- Hooks, on the record from kiro-cli's `hook_update` events, all completed: "Guard dependencies, pushes and deploys" (PreToolUse) 28 times, "Run unit tests on core save" 2 times, "Open tasks at session start" once and "Full check on stop" once. These are the first hook runs inside a Kiro session recorded for this repository.
- Kiro's counts: typecheck clean and 160 unit tests (158 before). The stop hook ran the full check, including Playwright, on `PW_PORT=3873`.

## Prompt

```text
You are working in the Haunted Pomodoro repository (a focus timer in a haunted house; TypeScript, React, Vite, Vitest, Playwright with axe; a pure core in src/core with the clock passed in, and ports in src/adapters). Read the steering files in .kiro/steering first and follow them, especially product.md's never-punish rule. Then read .kiro/specs/haunted-focus-timer/requirements.md, design.md and tasks.md, src/core/timer.ts, clock.ts, model.ts and story.ts, src/app/controller.ts, src/adapters/notify.ts, src/App.tsx, src/ui/Scene.tsx and the tests that cover them, and scripts/trace.mjs, so the new spec names the real modules.

First, fix the workspace hooks so they fire. The PostFileSave hooks in .kiro/hooks/*.json use matchers such as `^src/core/...`, but kiro-cli tests a matcher against the absolute file path, so a pattern anchored with `^src/` never matches. Replace each such leading `^` with `(^|/)` (for example `(^|/)(src/core|src/adapters)/.*\.ts$`) and keep everything else. Also check the PreToolUse guard script: kiro-cli 3.5 sends `fs_write` input as `{ path, text }` and `str_replace` input as `{ path, oldStr, newStr }` (paths absolute), and `execute_bash` as `{ command }`; make sure the script reads those names. Extend tests/unit/kiro-config.test.ts so it checks each PostFileSave matcher against an absolute path to a file it is meant to cover, and run `npm run typecheck && npm test`.

Then, before you write the spec, look up the Document Picture-in-Picture API with the Context7 MCP server (resolve the library, then query its docs for documentPictureInPicture.requestWindow, its options, the window it returns, the pagehide event and the browsers that support it), and cite what you used in design.md. If Context7 is not available in this session, say so plainly and use what you know, marked as unverified.

Write a new Kiro spec for one headline feature, "The ghost follows you", into .kiro/specs/ghost-follows-you/: requirements.md, design.md and tasks.md. Apart from the hook fix above, do not change any code in this session.

The feature ("the only focus timer that haunts your other apps"): while a focus candle is lit and the person switches away from the tab, the ghost comes with them, gently.
(a) An animated favicon and title: the tab's favicon is drawn on a canvas as a candle that burns down with the session's progress, and while the page is hidden it turns into the ghost's face; the title shows the time left. Back on the tab, the favicon returns to the candle. Under reduced motion the favicon still updates but does not animate between frames.
(b) An opt-in "Let her follow me" setting, off by default. When it is on and the person presses "Light a candle" (a user gesture, which requestWindow needs), the app opens a small always-on-top Document Picture-in-Picture window with the ghost and the time left. The ghost floats over the app they switched to and fades when they return to the tab; closing the window is never counted against them, and the session continues. Where the API is missing (Firefox, Safari), the setting explains that and the favicon and title are the fallback.
Both sit behind a new port in src/adapters/pip (a PipWindow port with a browser adapter and a fake for tests) and pure, clock-driven helpers in src/core (for example the favicon frame for a given progress and visibility, and the follow state machine), with fake-clock unit tests. Nothing calls the network.

requirements.md: an introduction, a glossary (follow window, favicon frame and any new terms), user stories, and numbered acceptance criteria in strict EARS form (WHEN / WHILE / IF ... THEN / WHERE ... THE SYSTEM SHALL ...), one testable behavior each, in the same numbering and heading style as haunted-focus-timer/requirements.md so scripts/trace.mjs can read it. Cover the favicon frames, the title, visibility changes, the setting and its default, opening only on a user gesture, the window's contents and fade, closing the window, missing-API fallback, reduced motion, accessibility (the setting is a labelled control, zero axe violations, no information only in the favicon), the never-punish rule, persistence of the setting, and determinism.

design.md: overview, the exact files to add or change, the port interface and data models in TypeScript, the state machine with a mermaid diagram, how the favicon is drawn and how often (and why that cost is low), error handling (requestWindow rejects, the window is closed, the tab is restored), at least three correctness properties, the testing strategy (unit tests with a fake clock and a fake PipWindow, Playwright tests for the favicon and the setting, and how the PiP window is tested given headless browser limits), and open questions with your recommended default.

tasks.md: a numbered "- [ ]" checklist in the same format as haunted-focus-timer/tasks.md, where every task names the criteria it satisfies. Split it into two groups with headings: "Session A: core and adapters" (pure helpers, the pip port, the browser and fake adapters, the favicon renderer, unit tests) and "Session B: app, settings and docs" (wiring into the controller and App, the setting, the PiP window contents, README and docs, Playwright tests with axe). Check whether scripts/trace.mjs and tests/unit/kiro-config.test.ts read every spec folder; if not, add a Session A task to extend them.

Rules: edit files only with the file write and replace tools, never with sed, python, shell redirection or heredocs; work only inside this repository; do not add, remove or upgrade npm dependencies; do not run npm install; do not run git; do not deploy or call any network service other than the Context7 lookup. Keep wording professional and use invented sample data only. Leave README.md and KIRO-LOG.md alone in this session.

Finish with a short summary: the hook matchers you changed and the test result, the three files, the number of requirements, criteria and tasks, what Context7 returned, and the open questions.
```

## Session output

Kiro's narration and tool calls as printed by kiro-cli. Tool status lines and client log lines are removed, and local paths are shortened; nothing else is edited.

```text
[hook] Open tasks at session start (.kiro/hooks/open-tasks-on-start.json#hook-0, runCommand): completed
I'll start by reading the steering files, hooks and guard script.
[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
[tool] Replace in File
[tool] Replace in File
[tool] Replace in File
[tool] Replace in File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Replace in File
[tool] Read File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Run unit tests on core save (.kiro/hooks/test-on-save.json#hook-0, runCommand): completed
Guard already reads `path` and `command`; I'll add a test that pins the kiro-cli 3.5 input shapes.
[tool] Replace in File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Run unit tests on core save (.kiro/hooks/test-on-save.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
Hooks and tests are done. Now the specs and code the new spec must reference.
[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
Now the Context7 lookup for the Document Picture-in-Picture API.
[tool] Tool Load
[tool] Tool Load
[tool] @context7/resolve-library-id
[tool] @context7/query-docs
[tool] @context7/query-docs
[tool] @context7/query-docs

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
Research is done. Writing `requirements.md` first.
[tool] Write File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
[tool] Write File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Replace in File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
[tool] Replace in File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Replace in File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Write File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
The hooks are fixed and `npm run typecheck && npm test` passes. The new spec is in `.kiro/specs/ghost-follows-you/`.

**Hook matchers.** I replaced the leading `^` with `(^|/)` in four PostFileSave hooks:
- `a11y-motion-guard.json`: `(^|/)src/(styles\.css|ui/.*\.tsx|App\.tsx)$`
- `core-tests.json`: `(^|/)(src/core|src/adapters|src/app|src/audio|worker)/.*\.ts$`
- `test-on-save.json`: the same, plus `tests/unit`
- `never-punish-guard.json`: `(^|/)src/core/(house|streak|snapshot|model|house-file|wisps)\.ts$`

The `^(execute_bash|…)$` matchers on the PreToolUse hooks match tool names, so I left them alone.

**Guard script.** `guard.mjs` already read `path` and `command`, and it only checks the path, so I didn't change it. I added a test for the `{path, text}`, `{path, oldStr, newStr}` and `{command}` shapes in `kiro-guard.test.ts`. In `kiro-config.test.ts` I added a test that runs each save matcher against absolute paths that should and shouldn't match, and that fails if any matcher starts with `^`.

**Test result.** Typecheck is clean and 160 of 160 unit tests pass. Adding tests made `traceability.md` stale, so I ran `npm run trace` to regenerate it. That file is the only change beyond the hook JSON, the two test files and the spec. I didn't run Playwright. `npm test` runs automatically from the test-on-save hook, so it will fire on future saves.

**Counts.** The spec has 13 requirements, 99 criteria and 24 tasks with 20 sub-tasks (44 checkboxes). Every criterion is named by a task, and every EARS line starts correctly.

| Session | Tasks |
|---|---|
| Session A | 1 to 12 |
| Session B | 13 to 24 |

**Context7.** It was available. It resolved `/wicg/document-picture-in-picture` (reputation High, 158 snippets), and I ran three queries. It returned:
- the `requestWindow(options)` signature
- the options (`width`, `height`, `disallowReturnToOpener`, `preferInitialWindowPlacement`)
- the rejection table (`NotSupportedError`, `NotAllowedError` without transient activation, `RangeError` for half a size)
- `pagehide` on the returned window, the `enter` event and `documentPictureInPicture.window`
- one window per tab, and support being implementation-defined

These are cited in `design.md` under Sources. Context7 gave no browser list. Chromium desktop 116+ with no Firefox or Safari, stylesheets not carrying over, timer throttling in the window, headless behaviour and Page Visibility for partly covered tabs are from memory and marked unverified.

**Other findings.**
- `trace.mjs` reads only `haunted-focus-timer`, and `kiro-config.test.ts` reads no spec folder. Task 11 extends both. Because both specs number from 1, tags for this spec carry a prefix (`// Req ghost-follows-you:2.3`).
- Erase keeps settings today, so criterion 12.5 says the setting is kept rather than reset.

**Open questions** (recommended default first):
1. Show the ghost's face the moment the page is hidden, not after the 3 s grace. Recommended: at once.
2. Keep the window open and dimmed on return, not closed. Recommended: stay open.
3. Whether the window's own timer is unthrottled while the opener tab is hidden. Recommended: use the window's own `setInterval`, and check by hand in headed Chrome.
4. Use Page Visibility only for "switched away", not `blur`.
5. With the setting on and no API, keep the saved value and show the switch disabled.
6. Only a new focus session started by a gesture opens the window, not Resume.
7. No buttons in the window in v1.
8. Size hint 280×200, with `disallowReturnToOpener` false.
9. Whether a data-URL favicon updates in Safari. Recommended: ship it everywhere, since the static icon is the fallback.
10. The tag prefix for trace tags versus offsetting requirement numbers. Recommended: the prefix.
[hook] Full check on stop (.kiro/hooks/e2e-on-stop.json#hook-0, runCommand): completed

[run] success (end_turn)
```
