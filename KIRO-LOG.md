# Kiro log

What Kiro was asked to do on this project, what it produced, and what it cost. Every call is listed, including any that fail.

**TL;DR**
- **Kiro specced and built the headline feature, "The ghost follows you"** (sessions 2 to 7, 2026-11-22): a candle favicon that burns down and turns into the ghost when you switch tabs, and an opt-in Document Picture-in-Picture window that floats over your other apps. 4,550 added lines in 46 files across five commits, with no developer edits to Kiro's code. Unit tests 158 to 348, Playwright 60 to 84, every one of the spec's 100 criteria named by a test.
- **Kiro's own reviewer caught what the tests did not.** The read-only `ghost-reviewer` agent found that the app commented on the window closing (which criterion 11.5 forbids), that the icon could show the ghost while the title did not say so, and two README browser claims the code did not back. The next session fixed all five findings and brought spec, code and tests into line.
- **The hooks now fire inside Kiro, on the record:** 472 hook runs over sessions 2 to 7, after Kiro fixed matchers that could never match the absolute paths kiro-cli tests.
- **Kiro caught a spec that disagreed with the code.** House-sync 4.1 said the Worker answers 404 for a wrong method; the Worker answers 405. Kiro corrected the criterion rather than the code.
- **Kiro refused to take the checklist on trust.** It unchecked two tasks no test backed (9, the Hearth panel's values; 11, the ambient wind wiring) and logged every gap it found as an open task: 24 to 30 here, 3.1 and 8 to 10 in house-sync.
- **Kiro built two features with their tests in one pass:** house export and import, and the opt-in phase-end notification (kiro-cli v3, 11 min 44 s, 16.02 credits). Afterwards: typecheck clean, Vitest 101 of 101, Playwright 23 of 23.
- **Kiro tightened every acceptance criterion into EARS form** and converted the one old-format hook to `v1`.
- Disclosure: the steering, the first two specs and the first hooks were drafted with Claude Code (Anthropic's coding agent) in Kiro's formats before the first Kiro session; "Before the Kiro pass" says exactly what.
- Work done since then without Kiro is listed under "Work outside Kiro" with its commits, so nothing here is credited to Kiro that it did not do.

## Kiro features at a glance

| Feature | First real use | Session | Evidence |
|---|---|---|---|
| Specs: review against the code | Rewrote all criteria in EARS form; corrected house-sync 4.1 from 404 to 405; unchecked tasks 9 and 11 because no test backed them; opened tasks 24 to 30 and house-sync 3.1 and 8 to 10 | Kiro pass 1, 2026-11-19 | `cdabc10`: `.kiro/specs/*/requirements.md`, `tasks.md` |
| Specs: spec-driven build | Export and import (Requirement 11) and the phase-end notification (Requirement 10): criteria, design note and sub-tasks first, then code and tests | Kiro pass 1 | `cdabc10`: `src/core/house-file.ts`, `src/adapters/notify.ts`, `tests/unit/house-file.test.ts`, `tests/unit/notifications.test.ts`, `tests/e2e/house-file.spec.ts` |
| Steering (always included) | Read `product.md`, `tech.md` and `structure.md` first, followed the forward-only rule in the import merge, and updated all three for its features | Kiro pass 1 | `cdabc10`: `.kiro/steering/` |
| Hooks: format | Checked every hook against the `v1` format and converted the IDE-format hook into `core-tests.json` | Kiro pass 1 | `cdabc10`: `.kiro/hooks/` |
| Hooks: firing inside Kiro | Session 2 fixed the four save-hook matchers (`^src/` never matched the absolute path kiro-cli tests; now `(^|/)src/`). From then on, kiro-cli's `hook_update` events show every hook type firing: the PreToolUse guard 330 times, save hooks and agent guards 129, the SessionStart hook 7 times (twice in session 5, where the agent carries its own copy) and the Stop hook 6 times, once per session | Sessions 2 to 7 | Each session's transcript in [`docs/kiro-sessions/`](docs/kiro-sessions/); `tests/unit/kiro-config.test.ts` checks every matcher against absolute paths |
| Steering (file match) | Not on the record: sessions 3, 4 and 6 edited `src/ui/`, but the transcripts do not show which steering files kiro-cli loaded | Sessions 3, 4 and 6 | `.kiro/steering/scene-art.md`, `audio.md` |
| MCP: Context7 | Kiro resolved `/wicg/document-picture-in-picture` and queried it three times for `requestWindow`, its options, its errors and `pagehide`, then cited it in design.md and marked what Context7 did not cover as unverified | Session 2 | [session 2 transcript](docs/kiro-sessions/2026-11-22-session-2-ghost-follows-you-spec.md); `.kiro/specs/ghost-follows-you/design.md`, Sources |
| Custom agent: `ghost-reviewer` | Ran read-only (tools `read` and `shell`) as task 23's copy review and returned five findings, all fixed in the next session | Sessions 5 and 6 | [session 5 transcript](docs/kiro-sessions/2026-11-22-session-5-ghost-reviewer.md), `.kiro/agents/ghost-reviewer.json` |

Commits whose subject ends "by Kiro" hold Kiro's work (`git log --grep "by Kiro"`), and their messages say what, if anything, the developer added. Earlier commits are not rewritten; this log attributes them.

## Sessions 2 to 7 (kiro-cli v3): the ghost follows you

While a focus candle is lit and the person switches away, the ghost comes with them, gently: the tab icon burns down and becomes the ghost's face, the title keeps the time, and with the opt-in "Let her follow me" setting a small always-on-top Document Picture-in-Picture window shows the ghost over the other app. Closing it is never counted against anyone. Kiro wrote the spec and then built it. Every session ran headless with a 25-minute cap and `--trust-tools` listing only the tools named (never `--trust-all-tools`), with `PW_PORT=3873`. The developer committed only after typecheck, Vitest and Playwright passed from a fresh clone.

| Session | What Kiro did | Minutes | Credits | Hook runs on the record | MCP | Tests after |
|---|---|---|---|---|---|---|
| [2](docs/kiro-sessions/2026-11-22-session-2-ghost-follows-you-spec.md) | Fixed the save-hook matchers and tested them and the guard's payloads; wrote `.kiro/specs/ghost-follows-you/` (13 requirements, 99 EARS criteria, 24 tasks, 10 open questions) | 11.3 | 15.37 | 32 | Context7: 1 resolve, 3 queries | 160 unit, 60 e2e |
| [3](docs/kiro-sessions/2026-11-22-session-3-ghost-follows-core.md) | Session A: favicon frames, tab title, follow state machine, the setting, the `PipWindow` port with browser and fake adapters, the canvas painter, `trace.mjs` for every spec | 16.5 | 21.25 | 180 | none | 244 unit, 60 e2e |
| [4](docs/kiro-sessions/2026-11-22-session-4-ghost-follows-app.md) | Session B: the window renderer, `GhostFollower`, the setting in Settings, `App.tsx` wiring, 24 Playwright tests with axe, README section and docs | 21.1 | 20.42 | 146 | none | 347 unit, 84 e2e |
| [5](docs/kiro-sessions/2026-11-22-session-5-ghost-reviewer.md) | Task 23 as the read-only `ghost-reviewer` agent: five findings | 2.5 | 1.34 | 3 | none | (no edits) |
| [6](docs/kiro-sessions/2026-11-22-session-6-review-fixes.md) | Fixed all five findings; new criterion 3.8 (the title says "Ottilie is here" whenever the icon shows the ghost); criteria 4.5, 7.3 and design.md brought into line | 10.2 | 8.79 | 92 | none | 348 unit, 84 e2e |
| [7](docs/kiro-sessions/2026-11-22-session-7-clock-flake.md) | Fixed a flaky session-4 test found by the developer's fresh-clone check: the installed page clock still ticked with real time. A paused-clock helper, plus two axe-timing fixes the repeat runs exposed; tests only | 15.0 | 1.56 | 19 | none | 348 unit, 84 e2e; the two files 120 of 120 with `--repeat-each=5` |

- **Credits.** 68.73 for sessions 2 to 7, each figure kiro-cli's own end-of-session `session_usage` count. With Kiro pass 1's 16.02, the seven logged Kiro sessions used 84.75 credits. The shared account balance moved more over the same windows, because other Kiro work drew on it.
- **Developer changes.** None to Kiro's code. The developer wrote the prompts, the session transcripts and this section.
- **Findings Kiro reported along the way.** Headless Chromium has its own `documentPictureInPicture`, so the Playwright stand-in is installed with `Object.defineProperty`; at exactly 1/24 of a session floating-point rounding still gives wax step 0, and the tests pin that boundary; in session 6, one full run had two failures (an axe contrast check and a favicon test) that passed when rerun. A later fresh-clone run on a busy machine failed one exact-time test from session 4; session 7 traced it to the unpaused page clock and fixed it, and the developer's own repeat run in a fresh clone passed 120 of 120. Commits from session 4 to session 6 carry that timing-sensitive test; each passed its own fresh-clone check.
- **Rule slips Kiro disclosed.** One temporary debug test written with a heredoc in session 4, then deleted.
- **Still open.** Task 22, a manual check in a headed desktop Chrome or Edge, which a person records in `docs/FEATURES.md`. Until then the README makes no browser-version claim.

## Before the Kiro pass
The steering files (`.kiro/steering/product.md`, `tech.md`, `structure.md`), the two specs (`.kiro/specs/haunted-focus-timer/` and `.kiro/specs/house-sync/`, each with EARS requirements, a design and a task list) and the agent hooks (`.kiro/hooks/`) were drafted with Claude Code in Kiro's formats before any Kiro session, alongside the first working build. Kiro had not been run on this repository at that point.

The first build implements tasks 1 to 16 of `haunted-focus-timer` and tasks 1 to 6 of `house-sync`. Open tasks (`[ ]`) are left for the Kiro pass.

Hooks drafted:
- `test-on-save.json`: runs the unit suite when core, adapter, worker or unit-test files are saved.
- `never-punish-guard.json`: an agent prompt that restates the forward-only progress rule after edits to house, streak, merge or reducer code.
- `a11y-motion-guard.json`: an agent prompt that checks reduced motion, labels and focus after UI edits.
- `e2e-on-stop.json`: runs `npm run check` (types, unit, Playwright) before a turn ends.
- `core-tests.kiro.hook`: the same core-test rule in the Kiro IDE hook format (converted and removed in the Kiro pass).

Hook formats: the four `.json` files were drafted in the `v1` format and `core-tests.kiro.hook` in the older IDE format. The Kiro pass checked every file against the current `v1` format, converted the IDE file and deleted it; see "Kiro pass 1 (kiro-cli v3): spec review, export and import, notifications" below.

Later changes made before the Kiro pass (tasks 21 and 22, also with Claude Code): the sound check page with measured level limits, and the first-view layout fit. Task 23, a listening review of each sound, is open.

## Kiro pass 1 (kiro-cli v3): spec review, export and import, notifications

- **When:** 2026-11-19, 03:56 to 04:08 UTC (11 min 44 s wall time, under a 25-minute cap; exit code 0).
- **Command** (repo root, stdin closed):
  `kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools=fs_read,fs_write,run_command "<prompt>" </dev/null`
- **Credits used:** 16.02 of the 4,000 `kiroween2026` hackathon credits (`/usage` read 141.19 before the call and 157.21 after).
- **What Kiro did:** reviewed both specs against the code and tests, rewrote the criteria in EARS form (and corrected
  house-sync 4.1, which said 404 where the Worker answers 405), wrote house export and import (`src/core/house-file.ts`
  and the settings controls), the opt-in phase-end notification (`src/adapters/notify.ts`, `src/core/notice.ts`, the
  controller), their unit tests and a new Playwright file, converted the IDE-format hook, updated the README and
  steering, and ran `npm run typecheck` and `npm test` itself.
- **After the call (by hand):** Vitest 101 of 101 (69 before the pass). Playwright: the new export, erase and import
  test failed in 3 of 4 full-suite runs and passed in isolation. The cause was the test reopening settings with the
  "," shortcut within about a second of an erase or an import, when the shortcut is sometimes ignored. The test was
  changed to open settings with the toolbar Settings button, as a person would with a pointer; it then passed
  10 of 10 repeated runs, and the full suite passed 23 of 23 (20 before the pass). The shortcut timing is recorded as
  open task 31. Before the call the maintainer made the end-to-end port overridable with `PW_PORT`, so local runs can
  avoid a busy port.

### Prompt

Quoted as sent, except that one internal role name is shown as [the maintainer] and one heading name is shown in its current form.

> You are working in the Haunted Pomodoro repository (a focus timer in a haunted house; TypeScript, React 19, Vite, Web Audio, Vitest, Playwright with axe-core; an optional Cloudflare Worker for sync in worker/). Read .kiro/steering/product.md, tech.md and structure.md first and follow them, especially the forward-only progress rule (nothing removes a lit candle or a restored room except an explicit erase) and the rule that core functions take the time as an argument instead of reading Date.now(). Work only inside this repository. Do not add, remove or upgrade any npm dependency, do not run npm install, do not use git or wrangler, and do not deploy or call any network service. Keep wording professional and use invented sample data only.
>
> Do these four jobs in order.
>
> 1. Spec review. For each spec in .kiro/specs/ (haunted-focus-timer and house-sync), read requirements.md, design.md and tasks.md and compare them with the code in src/ and worker/ and the tests in tests/. Tighten every acceptance criterion into strict EARS form (WHEN / WHILE / IF ... THEN / WHERE ... THE SYSTEM SHALL ...), one testable behavior per criterion, keeping existing numbering so task references stay valid (append new criteria at the end of a requirement). Mark a task [x] only if code and a test really implement it. Add a new unchecked task for every gap you find, with its requirement numbers. Leave task 23 (a listening review by a person) unchecked.
>
> 2. Implement two open tasks of haunted-focus-timer. For each, first add EARS acceptance criteria to requirements.md (a new requirement or criteria appended to an existing one), a short design note to design.md and sub-tasks under the task in tasks.md with requirement numbers; then build it with tests; then check it off.
>    a. Task 20, export and import the house as a JSON file. In settings, an "Export house" button downloads the current snapshot as a JSON file (use the existing snapshot serializer in src/core/snapshot.ts, with a format version, and a file name like haunted-house-YYYY-MM-DD.json from the injected clock). An "Import house" file input reads a chosen file, parses it with the existing defensive parser, and merges it with the current house through the existing merge (the house with the higher houseScore wins, so an import can never remove a lit candle or a restored room). A damaged, foreign or oversized file (over 1 MB) is refused with a clear message and changes nothing. In demo mode, export and import are disabled with a short reason. Keep both controls keyboard accessible and labelled, and keep zero axe violations. Add Vitest tests for the export payload and the import decision (valid file merges forward, older house never lowers progress, damaged JSON, wrong format version, too large) as pure functions, and one Playwright test in tests/e2e that exports after a demo-length session in a normal (non-demo) house, erases, imports the file and sees the candle back. Use the existing helpers in tests/e2e/helpers.ts.
>    b. Task 19, optional phase-end notification. Add a setting "Notify me when a phase ends while this tab is hidden", off by default. Turning it on asks for notification permission only at that moment (never on load); if permission is denied, the setting turns itself off and says why. WHEN a focus or break phase ends AND the document is hidden AND the setting is on AND permission is granted, show one notification naming the phase that ended and what comes next; never notify while the tab is visible, never more than once per phase end, and never in demo mode unless the setting is on. Put the browser API behind a small adapter (for example src/adapters/notify.ts with a port and a no-op default) so the controller logic is testable with a fake. Add Vitest tests with a fake notifier for: off by default, hidden plus granted notifies once, visible does not, denied turns the setting off, and no duplicate on late ticks.
>    Keep `npm run typecheck` green. Update README.md and the steering files where these change what they say.
>
> 3. Hooks. Kiro's current hook format is .kiro/hooks/<name>.json with "version": "v1" and a "hooks" array (fields: name, description, trigger in PascalCase such as PostFileSave or Stop, matcher regex against the file path, action with type "command" + command or type "agent" + prompt, timeout in seconds, enabled). Check every file in .kiro/hooks/ against that format and fix anything invalid; add "enabled": true where it is missing. core-tests.kiro.hook is in the older IDE format ("when"/"then", fileEdited, askAgent): convert what it adds beyond test-on-save.json into the current format (either fold it into test-on-save.json or make core-tests.json), then delete the .kiro.hook file. Extend a guard's matcher to the new export/import and notification files where it fits. Update KIRO-LOG.md's hook list and the README so they describe the hooks as they now are.
>
> 4. KIRO-LOG.md. Replace the "Hook formats" paragraph and the "## Kiro pass" "Pending." paragraph with the truth in one or two plain sentences each, pointing to the new section, then append a new section "## Kiro pass 1 (kiro-cli v3): spec review, export and import, notifications" that lists: each spec change (criteria tightened, tasks checked, tasks added), each source and test file you changed and why, the hook changes, and anything you could not do. Leave a line "Credits used: TO BE FILLED" for [the maintainer] to fill in.
>
> When you finish, run `npm run typecheck` and `npm test` and fix any failures you caused. Do not run the Playwright suite yourself; [the maintainer] will (note that the Stop hook runs `npm run check`, which includes Playwright; that is expected).

One non-interactive session, four jobs in order: spec review, tasks 19 and 20, hooks, this log. `npm run typecheck` passes and `npm test` passes (101 tests in 10 files, two of them new). Kiro did not run Playwright in this session, as the prompt asked; the full suite was run straight after it and passed 23 of 23 (see "After the call").

### Spec changes
`haunted-focus-timer/requirements.md`
- Every criterion rewritten in strict EARS form (WHEN, WHILE, WHERE, IF ... THEN, or the ubiquitous form). Numbering kept; where one criterion held several behaviors, the first stays and the others are appended at the end of the requirement.
- Appended criteria: Requirement 1 (11 to 19), 2 (4 to 9), 3 (8 to 15), 4 (8 to 15), 5 (4 to 8), 6 (6 to 9), 7 (7 to 14), 8 (4 to 6), 9 (3 to 6).
- New Requirement 10 (phase-end notification, 13 criteria) and Requirement 11 (export and import, 15 criteria).
`haunted-focus-timer/design.md`: added Phase-end notification and Export and import sections, the `notifyPhaseEnd` setting, and updated requirement references.
`haunted-focus-timer/tasks.md`
- Tasks 19 and 20 got sub-tasks 19.1 to 19.5 and 20.1 to 20.5 with requirement numbers, and were checked once built and tested. Task 15 (erase with confirmation) stays checked because `tests/e2e/house-file.spec.ts` now exercises both "Keep it" and "Erase the house"; before this session no test covered it.
- Unchecked after review: task 9 (the Hearth panel's values are not read by any test) and task 11 (volume and mute are tested, the ambient wind wiring is not). Sub-tasks 9.1 and 11.1 describe the missing tests.
- New unchecked tasks: 24 (scene progress maths into core, Req 4.8, 4.9), 25 (reload during a running session, Req 1.2, 1.9), 26 (title restore and announcements, Req 3.15, 7.9, 7.10, 7.14), 27 (visible focus, Req 7.7), 28 (ghost calls off, Req 3.8, 3.9), 29 (ledger delete, clear, choose, Req 2.4 to 2.6), 30 (notifications through a service worker where `new Notification` is not allowed, Req 10.6).
- Task 23 (listening review) left unchecked.
`house-sync/requirements.md`: strict EARS, with criteria appended (1.4 to 1.9, 2.4, 2.5, 3.5, 4.5 to 4.9). The old 4.1 said the Worker answers 404 for everything but GET and PUT; the code answers 405 for a wrong method on a valid path, so the criteria now say that.
`house-sync/tasks.md`: task 3 unchecked because nothing tests the 256 KB limit; new tasks 3.1 (limit counts UTF-16 units, not bytes, and is untested), 8 (a pulled copy overwrites changes made while the pull was in flight, because `App.tsx` calls `controller.replace`), 9 (the push debounce lives in `App.tsx` and is untested), 10 (assert merged `updatedAt`). Task 7 left as it was. `design.md` has a short notes section.

### Source and test files
- `src/core/model.ts`: added `settings.notifyPhaseEnd` (default false, coerced with `=== true`). Why: the notification setting must survive saves and read as off in older saves.
- `src/core/notice.ts` (new): pure wording of the phase-end notification from one change's cues.
- `src/adapters/notify.ts` (new): `Notifier` port, no-op default and browser adapter.
- `src/app/controller.ts`: takes a `Notifier` and `isHidden`; notifies once per phase end when hidden, granted and on; `setNotifyPhaseEnd` is the only place permission is requested; `reconcileNotifications` turns the setting off with a reason when the browser denies.
- `src/core/house-file.ts` (new): export envelope, file name, and `decideImport` (size, JSON, format, version, shape, parse, `mergeModels`).
- `src/ui/panels.tsx`: settings now has a Notifications fieldset and an always-visible "Your data" fieldset with "Export house", "Import house" and the erase control; export and import are disabled in demo mode with a reason. `SettingsForm` takes an `actions` object.
- `src/App.tsx`: wires the notifier, the download, the import and the permission flow; reconciles the setting at start-up.
- `src/styles.css`: layout for the data controls and disabled state.
- `tests/unit/house-file.test.ts` (new), `tests/unit/notifications.test.ts` (new): export payload, valid import, older house never lowers progress, damaged JSON, foreign file, wrong version, too large; fake-notifier tests for off by default, hidden and granted, visible, denied, late ticks, demo, and the browser adapter.
- `tests/e2e/house-file.spec.ts` (new): export after a one-minute session, erase (keep and confirm), import, damaged file; demo controls disabled. `tests/e2e/a11y.spec.ts`: axe scan of settings in a normal house. Both pass in the full suite run after the session.
- `README.md` and the three steering files updated for export, import, notifications and the hook list.

### Hooks
- Checked all five files against the current format. The four `.json` files were valid `v1`; added `"enabled": true` to each, and a `timeout` to the two agent hooks that lacked one.
- Converted `core-tests.kiro.hook` into `core-tests.json` (agent hook, `PostFileSave`): it adds the rule to fix code rather than tests unless the requirement says the test is wrong, and to cite the requirement number. It reads the result of `test-on-save.json` instead of running the suite a second time. Deleted `core-tests.kiro.hook`.
- `test-on-save.json` matcher now includes `src/app`. `never-punish-guard.json` matcher and prompt now include `src/core/house-file.ts` and the rule that an import merges forward only. `a11y-motion-guard.json` prompt names the export, import and notification controls.
- `e2e-on-stop.json` runs `npm run check`, which includes Playwright; that is expected.

### Not done
- Kiro did not run Playwright or the build itself; both were run after the session (23 of 23).
- Nothing was checked in a real browser: the permission prompt, a real notification and a real download.
- The notification uses `new Notification`, which some mobile browsers refuse; task 30 covers a service-worker path.
- If a throttled tab completes several phases on successive catch-up ticks, each completion notifies once; they are not merged.
- Task 23 (listening review) needs a person.
- The spec gaps above (tasks 9.1, 11.1, 24 to 30, house-sync 3.1 and 8 to 10) are recorded, not fixed.

## Work outside Kiro

Everything below was written without a Kiro session, with Claude Code, tested with the same Vitest and Playwright suites, and recorded in the task list like Kiro's work. None of it is counted in the Kiro credits above.

| Commits | Tasks | What changed |
|---|---|---|
| `8205972` | none | README leads with forgiveness and its sources; records corrected to the real pass counts |
| `7acad72` | 32 | Phone layout: the ghost's words as a caption under the scene, a one-line demo banner, an axe scan at 390 px |
| `4cf9a52` | 33 | The restoration as the hero moment: a fully haunted demo parlor, one-candle demo rooms, the restoration sweep |
| `b3c8552` | 34 | The ghost's story: journal pages, return lines, the Hearth diary and the weekly reflection |
| `48e55ae` | 35 | House map exterior first, and ghosted candle outlines for the Hearth's unlit days |
| `3ed0840` | 36 | README GIF, link-preview image and Open Graph tags, recorded from the real demo |
| `ee7327e` | 37 (38 opened) | `npm run trace`: every acceptance criterion mapped to the tests that name it |
| `cddb2e0` | 39 (40 opened) | `npm run smoke` for a deployed copy |
| `aa13873` | 41, 42 | A clear payoff frame and a warm strike bloom; phone first view and 24 px targets |
| `0ecfcc1` | none | Kiro configuration: MCP servers, four new hooks, two file-match steering files and the `ghost-reviewer` agent (below) |
| `8437451` | 43 | Will-o'-wisps: each return from a wandering leaves a light in the room, never removed |
| `f7c3338` | 44 | Unmask: the same state as a plain Pomodoro, with a test that the state is identical |
| `8172d3c` | 31, 45 | `?demo=finale`; the "," shortcut fixed (task 31, opened by Kiro pass 1): a dialog's late `close` event swallowed a shortcut pressed straight after Escape |

### Kiro configuration added outside a Kiro session
- `.kiro/settings/mcp.json`: Playwright MCP (`@playwright/mcp@0.0.84`, headless and isolated) and Context7 (`@upstash/context7-mcp@4.5.0`).
- Hooks: `guard-dependencies-and-pushes.json` (PreToolUse; `scripts/kiro/guard.mjs` exits 2 on a dependency change, an edit to `package.json` or `package-lock.json`, `git push` or a deploy), `trace-after-task.json` (PostTaskExec; `npm run trace -- --check`), `open-tasks-on-start.json` (SessionStart; `scripts/kiro/open-tasks.mjs`) and `demo-ready.json` (Manual; `npm run demo-ready`).
- Steering: `scene-art.md` (file match on `src/ui/**`, `src/styles.css`, `src/App.tsx`) and `audio.md` (file match on `src/audio/**` and the sound check).
- Agent: `.kiro/agents/ghost-reviewer.json`, a read-only reviewer of copy against the never-punish rule, with the guard and the task list as its own hooks.
- Schema check: trigger names, matcher rules, exit-code behavior and agent fields were checked against the v3.5.0 agent engine that ships with kiro-cli. Exit code 2 blocks only on PreToolUse, PreTaskExec, PermissionRequest, UserPromptSubmit and PreCompact, so the PostTaskExec trace hook reports to the agent and cannot block. `tests/unit/kiro-config.test.ts` checks every hook, agent, steering and MCP file, and `tests/unit/kiro-guard.test.ts` runs the guard the way Kiro does.
- Before session 2 these hooks had not fired in a Kiro session; `docs/kiro/hook-checks.txt` records each hook command run by hand with the event Kiro sends, and its output. They have fired inside Kiro since session 2: see "Sessions 2 to 7" above for the counts.

Later work outside Kiro is listed in [`CHANGELOG.md`](CHANGELOG.md) and in the task list.
