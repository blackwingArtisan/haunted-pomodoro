# Kiro log

What Kiro was asked to do on this project, what it produced, and what it cost. Every call is listed, including any that fail.

## Before the Kiro pass
The steering files (`.kiro/steering/product.md`, `tech.md`, `structure.md`), the two specs (`.kiro/specs/haunted-focus-timer/` and `.kiro/specs/house-sync/`, each with EARS requirements, a design and a task list) and the agent hooks (`.kiro/hooks/`) were drafted by hand in Kiro's formats before any Kiro session, alongside the first working build. Kiro had not been run on this repository at that point.

The first build implements tasks 1 to 16 of `haunted-focus-timer` and tasks 1 to 6 of `house-sync`. Open tasks (`[ ]`) are left for the Kiro pass.

Hooks drafted:
- `test-on-save.json`: runs the unit suite when core, adapter, worker or unit-test files are saved.
- `never-punish-guard.json`: an agent prompt that restates the forward-only progress rule after edits to house, streak, merge or reducer code.
- `a11y-motion-guard.json`: an agent prompt that checks reduced motion, labels and focus after UI edits.
- `e2e-on-stop.json`: runs `npm run check` (types, unit, Playwright) before a turn ends.
- `core-tests.kiro.hook`: the same core-test rule in the Kiro IDE hook format.

## Kiro pass
Pending. A Kiro session will review the steering and the specs against the code, then implement the open tasks. Each call will be recorded here with its prompt, the files it produced and the credits shown.
