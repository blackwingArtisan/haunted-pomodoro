# Kiro session 7: a flaky clock test made deterministic

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive
- Command (repo root, stdin closed): `PW_PORT=3873 kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools=fs_read,fs_write,run_command --output-format stream-json "<prompt>" </dev/null` (not `--trust-all-tools`)
- When: 2026-11-22, 22:42:14 to 22:57:15 UTC (15 min 1 s wall time, under a 25-minute cap); exit code 0
- Credits used: 1.56 (kiroween2026 `/usage` read 798.79 before and 811.02 after)
- Finished on its own in 15 min 1 s (exit code 0). 1.56 credits, read from kiro-cli's own `session_usage` event.
- Why this session ran: the developer's fresh-clone check of the next commit failed one test Kiro wrote in session 4, "a refused window leaves the timer running...", which read 24:51 where it expected 24:55. It had passed every earlier run.
- Cause, as Kiro found it: `page.clock.install()` installs a fake clock that still ticks with real time, so on a slow machine real time passed between `runFor(5_000)` and the assertion.
- What Kiro changed (tests only, no app change): a helper `installPausedClock` in `tests/e2e/helpers.ts` that installs the clock and then pauses it, used by both ghost-follows spec files; `page.clock.resume()` before the window's axe scan, which waits on page timers; and `openSettings` now waits for the dialog's fade-in before the axe scans, after two contrast failures showed up in the repeat runs. No assertion was loosened.
- Proof, as Kiro reported: `--repeat-each=5 --workers=4` over the two spec files passed 120 of 120 after the last change (earlier attempts in the session had 5 and then 2 failures, which led to the second and third changes); then `PW_PORT=3873 npm run check` passed with 348 unit tests and 84 end-to-end tests.
- Hooks, on the record, all completed: "Guard dependencies, pushes and deploys" 17 times, "Open tasks at session start" once and "Full check on stop" once.
- MCP: none called.

## Prompt

```text
Fix a flaky end-to-end test in the Haunted Pomodoro repository. Read .kiro/steering/tech.md first.

In a fresh-clone run on a busy machine, `tests/e2e/ghost-follows-window.spec.ts` "a refused window leaves the timer running and says where the ghost went instead" failed once and passed on every other run. The failure:

    Locator:  getByTestId('digits')
    Expected: "24:55"
    Received: "24:51"
    3 x "24:54", then 3 x "24:53", 2 x "24:52", then "24:51"
    at: await page.clock.runFor(5_000); await expect(page.getByTestId('digits')).toHaveText('24:55');

The readings kept falling while the assertion waited, so the page clock was still advancing with real time after `runFor`. Find why (look at how the tests in tests/e2e/ghost-follows-window.spec.ts and tests/e2e/ghost-follows.spec.ts install and drive `page.clock`, and at Playwright's clock API: `install`, `pauseAt`, `runFor`, `setFixedTime`), and make every exact-time assertion in those two files deterministic, so that real time passing during a slow run cannot change what they read. Keep what each test checks; do not loosen an assertion into a range unless the criterion it tags allows it, and say so if you do.

Then prove it: run `PW_PORT=3873 npx playwright test tests/e2e/ghost-follows-window.spec.ts tests/e2e/ghost-follows.spec.ts --repeat-each=5 --workers=4` and report the pass count, and finish with `PW_PORT=3873 npm run check` once.

Rules: edit files only with the file write and replace tools, never with sed, python, shell redirection or heredocs. Change only test files unless you find the app itself is wrong, and say so if you do. Always set PW_PORT=3873; never use the default port. Do not run git. Do not add, remove or upgrade npm dependencies and do not run npm install. Do not call any network service.

Finish with a short summary: the cause, the change, the repeat-run pass count, and the unit and end-to-end test counts.
```

## Session output

Kiro's narration and tool calls as printed by kiro-cli. Tool status lines and client log lines are removed, and local paths are shortened; nothing else is edited.

```text
[hook] Open tasks at session start (.kiro/hooks/open-tasks-on-start.json#hook-0, runCommand): completed

[tool] Read File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
[tool] Read File
[tool] Read File

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

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Replace in File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Replace in File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
[tool] Replace in File

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command

[hook] Guard dependencies, pushes and deploys (.kiro/hooks/guard-dependencies-and-pushes.json#hook-0, runCommand): completed

[tool] Run Command
The flake is fixed: the repeat run passed 120 of 120, and `PW_PORT=3873 npm run check` passed, with 348 unit tests and 84 end-to-end tests. I did not run `check` before the changes, so I can't say which of the 84 end-to-end tests the other specs account for.

**Cause:** `page.clock.install()` only installs the fake clock. It keeps ticking with real time, and `runFor` adds to that. On a slow machine, real time kept passing between `runFor(5_000)` and the assertion, so the digits read 24:51 instead of 24:55. Playwright's `pauseAt` stops that.

**Change (tests only, no app change):**
- **Clock helper:** I added `installPausedClock(page, time?)` to `tests/e2e/helpers.ts`. It runs `install` and then `pauseAt(time + 1 s)`. Both spec files now use it instead of `page.clock.install(...)`. No assertion was loosened into a range, and each test still checks the same exact values.
- **Axe scan in the window spec:** the "window has no axe violations" test hung on the paused clock, because axe uses page timers that never fire. I added `await page.clock.resume()` just before the scan.
- **Settings dialog in `ghost-follows.spec.ts`:** two axe tests failed once during the repeat runs with colour-contrast violations. These tests don't use the clock. axe was scanning while the dialog was still fading in (0.35 s). `openSettings` now waits for the dialog's one-off animations to finish, as `a11y.spec.ts` already does.

**Verification:**
- **Repeat run:** the command you gave (`--repeat-each=5 --workers=4`) passed 120 of 120 after the last change. Earlier runs of that command each had failures (5 from the paused-clock axe hang, then 2 from the dialog fade-in) until the fixes above.
- **Full check:** `PW_PORT=3873 npm run check` passed with 348 unit tests across 28 files and 84 end-to-end tests.
[hook] Full check on stop (.kiro/hooks/e2e-on-stop.json#hook-0, runCommand): completed

[run] success (end_turn)
```
