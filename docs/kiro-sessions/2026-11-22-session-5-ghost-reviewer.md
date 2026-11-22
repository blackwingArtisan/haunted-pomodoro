# Kiro session 5: copy review as the ghost-reviewer agent (task 23)

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive
- Command (repo root, stdin closed): `PW_PORT=3873 kiro-cli chat --v3 --no-interactive --trust-workspace --agent ghost-reviewer --trust-tools=fs_read,run_command --output-format stream-json "<prompt>" </dev/null` (not `--trust-all-tools`)
- When: 2026-11-22, 22:18:41 to 22:21:10 UTC (2 min 29 s wall time, under a 25-minute cap); exit code 0
- Credits used: 1.34 (kiroween2026 `/usage` read 769.93 before and 772.69 after)
- Finished on its own in 2 min 29 s (exit code 0). 1.34 credits, read from kiro-cli's own `session_usage` event.
- Run as the read-only custom agent `ghost-reviewer` (`--agent ghost-reviewer`, tools `read` and `shell` only), for spec task 23. It made no edits.
- Findings, as the agent reported them: (1) the "window closed" note in `src/app/follow.ts` comments on closing the window, which criterion 11.5 forbids, and an existing Playwright test expects it; (2) the README said every state the icon shows is also in the title, but between the ghost's face appearing and the ghost waking the title shows only the clock; (3) the README's browser-version claims are not backed by the code or a recorded check; (4) two follow lines read as surveillance; (5) the setting's hint brings up closing. Verdict: fix 1 to 3 before shipping.
- The findings were passed verbatim to the next Kiro session, which fixed them (session 6).
- Hooks, on the record, all completed: "Open tasks at session start" twice (the workspace hook and the agent's copy) and "Full check on stop" once.
- MCP: none (the agent does not load mcp.json).

## Prompt

```text
Review the copy of the new "The ghost follows you" feature (task 23 of .kiro/specs/ghost-follows-you/tasks.md) against the never-punish rule and the tone section of .kiro/steering/product.md. Read: FOLLOW_LINES and followLine in src/core/story.ts; the tab titles in src/core/tab-title.ts; the window's text in src/adapters/pip/content.ts; the announcements and notes in src/app/follow.ts; "The ghost" section of Settings in src/ui/panels.tsx (the "Let her follow me" switch, its hint and its status notes); and the README section "The ghost follows you". Also read requirements 11.2, 11.4 and 11.5 in .kiro/specs/ghost-follows-you/requirements.md.

Flag any line that shames, scolds, counts a loss, mentions leaving or closing as a failure, threatens to take something away, puts information only in the favicon, or makes a claim the code does not back (check the README's browser claims against src/adapters/pip/browser.ts). For each finding give the file, the line number, the problem and a replacement in the ghost's voice: gothic, warm, a little funny, short, sentence case. If a line is fine, do not list it. You may run `npm test -- story` to confirm the tone tests pass. Do not edit files and do not run git.

End with a numbered list of findings (or "No findings") and a one-line verdict.
```

## Session output

Kiro's narration and tool calls as printed by kiro-cli. Tool status lines and client log lines are removed, and local paths are shortened; nothing else is edited.

```text
[hook] Open tasks at session start (.kiro/hooks/open-tasks-on-start.json#hook-0, runCommand): completed

[hook] Open tasks at session start (ghost-reviewer#hook-0, runCommand): completed

[tool] Read File
[tool] Read File
[tool] Read File
[tool] Read File
[tool] Grep Search
[tool] Grep Search
[tool] Read File
[tool] Read File
[tool] Grep Search
[tool] Grep Search
[tool] Grep Search
[tool] Grep Search
[tool] Grep Search
[tool] Grep Search
[tool] Grep Search
I read all the files and didn't run `npm test -- story`. Everything else was checked by reading, and I made no edits.

1. **`src/app/follow.ts:37`** (`FOLLOW_NOTES.closed`). Requirement 11.5 says the ghost must not comment on the closing, and this note does. It says "The small window closed." and then sets off an announcement and a Settings note. It also treats a normal action as an event worth reporting. The app should say nothing when the person closes the window. If the note stays for the screen reader's sake, it should be neutral: `'Your candle is still burning.'`. The better fix is to drop the `closed` note and its `announce` effect.

2. **`README.md:34`**. The claim "every state it shows is also in the title or on the page" isn't backed. `src/core/favicon.ts:32` switches to the ghost's face whenever a focus session is running and the tab is hidden. `src/core/tab-title.ts:21` only says "Come back…" once `ghostWoke` is set. In the gap before the ghost wakes, the icon shows a ghost while the title shows only the clock. This also matters for the "no information only in the favicon" rule. Replacement: "The icon is drawn from code on a canvas, so nothing is fetched. The time left is always in the title as well, so the icon never carries anything alone." The `tab-title.ts` change is to make the title say something at the same moment as the face. For example, `Ottilie is watching · 24:10 · Focus` could stand in until `ghostWoke`. This is a code change, not a copy change.

3. **`README.md:40`**. "found in desktop Chrome and Edge (from version 116)" isn't backed by `src/adapters/pip/browser.ts`. That file only checks `Boolean(env.documentPictureInPicture)` and has no version check. Claims that Firefox and Safari lack the API are also outside what the code can show. Replacement: "The window uses the Document Picture-in-Picture API, which the browser either offers or doesn't. Where it's missing, the switch is disabled with a note and the icon and the title still follow you. Desktop Chrome and Edge have offered it since version 116." The version sentence is acceptable only if it comes from a recorded manual check (task 22). Otherwise cut it.

4. **`src/core/story.ts:121` and `:123`**. "I am right here, over your shoulder." and "Work well. I will keep watch." read as surveillance in a floating window that follows you. That is the one place the ghost shouldn't sound like a monitor, and it works against "lonely, not hostile". Replacements:
   - Line 121: `'I am right here, humming by the window.'`
   - Line 123: `'Work well. I will keep the lamp.'`

5. **`src/ui/panels.tsx:334`** (`FOLLOW_HINT`). "Closing it never affects your session." is accurate and kind, but it brings up closing in the setting's own hint. That makes closing sound like something that could go wrong. This one is optional. A warmer positive form is: `'Off by default. A small window floats over other apps while a candle burns. Close it whenever you like; the candle burns on.'`

**Verdict:** Not ready to ship. Fix 1 to 3 first (a note that breaks 11.5, and two README claims the code doesn't back). The remaining items are polish.
[hook] Full check on stop (.kiro/hooks/e2e-on-stop.json#hook-0, runCommand): completed
The full check passed: typecheck, 347 unit tests and the Playwright run as far as the output shows. The e2e output was cut off at test 25, so I can't confirm the last 59 tests.

The passing check doesn't change my findings. It also doesn't cover them, because the tone tests don't read the notes in `FOLLOW_NOTES`, the README claims or the favicon and title mismatch.

Finding 1 would break an existing test. `tests/e2e/ghost-follows-window.spec.ts:153` is named "closing it leaves the session running, says so, …". It expects the closed note, so removing or neutralising that note means changing the test as well. Requirement 11.5 conflicts with the "says so" part of that test, so the spec or the test should be settled first.
[run] success (end_turn)
```
