# Submission copy

**Name:** Haunted Pomodoro

**First line:** Forest kills your tree when you look away. This ghost keeps your candle lit.

**Tagline:** A real Pomodoro timer wearing a haunted house. Focus by candlelight, restore the house room by room, and never lose what you earned.

**Category:** Costume Contest

**Elevator paragraph:** Most focus apps punish distraction: the tree dies, the pet is sad, the streak breaks. Haunted Pomodoro does the opposite. Every focus session lights a candle; wander to another tab and a lonely ghost wakes, drifts closer and calls you back, then thanks you for returning. It doesn't count your distractions; it counts your comebacks, and nothing is ever taken away, because self-forgiveness, not guilt, is what research links to less procrastination next time (Wohl, Pychyl and Bennett, 2010). Finish four candles and a room is restored: the color comes back, the cobwebs fall, the portrait finally closes its eyes. It runs offline, keeps every byte on your device, and was specified, guarded and reviewed with Kiro steering, EARS specs and hooks.

## How we used Kiro

**Kiro caught what we missed.** In its first session Kiro read both specs against the code and found house-sync criterion 4.1 promising a 404 for a wrong HTTP method, while the Worker answers 405. It corrected the spec, because the code was right. It also unchecked two tasks we had marked done, the Hearth panel's values and the ambient wind wiring, because no test backed them, and opened a task for every gap it found (24 to 30, plus four in house-sync).

**Specs.** Three specs live in `.kiro/specs/`: `haunted-focus-timer` (timer, house, ghost and story), `house-sync` (optional sync) and `ghost-follows-you`, which Kiro wrote itself. Kiro rewrote every acceptance criterion of the first two in strict EARS form, and every criterion added since follows it. `npm run trace` maps each of the 301 criteria to the tests that name it; 264 are covered: all 100 of `ghost-follows-you`, 164 of the timer's 173 (each of the other nine is an open task) and none yet of house-sync's 28, whose tests carry no criterion tags.

**Spec-driven building.** In the same session Kiro built two features from its own criteria: exporting and importing the house as a file, and an opt-in notification when a phase ends in a hidden tab. Each got EARS criteria, a design note and sub-tasks before any code. The session took 11 min 44 s and 16.02 credits; afterwards Vitest went from 69 to 101 tests and Playwright from 20 to 23, all passing.

**Kiro built the headline feature.** In six more headless sessions (68.73 credits) Kiro specced and built "The ghost follows you": the candle favicon that turns into the ghost when you switch tabs, and the opt-in floating window. It wrote the spec's 100 EARS criteria, and every one is named by a test; unit tests went from 158 to 348 and Playwright from 60 to 84. The hooks fired 472 times on the record, and the `ghost-reviewer` agent found five copy issues the tests missed, which the next session fixed. Seven logged Kiro sessions in all, 84.75 credits.

**Steering.** Five files. `product.md`, `tech.md` and `structure.md` load in every session; `product.md` makes "Never punish" non-negotiable: nothing removes a lit candle or a restored room. `scene-art.md` and `audio.md` load only when UI or sound files are in play.

**Hooks.** Nine `v1` hooks on six triggers: the unit suite and never-punish and accessibility guards on save, the full check on Stop, a PreToolUse guard that blocks dependency changes, `git push` and deploys with exit code 2, the trace check after each task, the open tasks at session start, and a manual demo-ready check. Unit tests run every command hook the way Kiro does.

**MCP and a custom agent.** Playwright MCP and Context7 are configured at pinned versions, and `ghost-reviewer` is a read-only agent that reviews every line the ghost says against the never-punish rule.

**What was not Kiro.** The first build, the first drafts of the steering and the first two specs, and most of the visual work were written with Claude Code. [KIRO-LOG.md](../KIRO-LOG.md) lists that work commit by commit, next to every Kiro session with its prompt, result and credits. Every commit holding Kiro's work ends its subject with "by Kiro", so `git log --grep "by Kiro"` shows Kiro's share directly.
