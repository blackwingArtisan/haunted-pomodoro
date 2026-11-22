import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blockReason } from '../../scripts/kiro/guard.mjs';
import { openTasks, report } from '../../scripts/kiro/open-tasks.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const guard = join(root, 'scripts/kiro/guard.mjs');

/** Runs the PreToolUse guard the way Kiro does: the pending tool call as JSON on stdin. */
function runGuard(toolName: string, toolInput: Record<string, unknown>) {
  const event = { hook_event_name: 'PreToolUse', cwd: root, session_id: 'unit-test', tool_name: toolName, tool_input: toolInput };
  const run = spawnSync(process.execPath, [guard], { input: JSON.stringify(event), encoding: 'utf8' });
  return { status: run.status, stderr: run.stderr };
}

const shell = (command: string) => blockReason({ cwd: root, tool_name: 'execute_bash', tool_input: { command } });

// Each case that starts a Node process gets room for a busy machine.
describe('Kiro PreToolUse guard (scripts/kiro/guard.mjs)', { timeout: 20_000 }, () => {
  it('blocks npm install with exit code 2 and tells the agent why', () => {
    const result = runGuard('execute_bash', { command: 'npm install canvas-confetti' });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/adds, removes or upgrades a dependency/);
  });

  it('blocks git push and deploys', () => {
    expect(runGuard('execute_bash', { command: 'git push origin main' }).status).toBe(2);
    expect(shell('git -C . push')).toMatch(/git push/);
    expect(shell('npx wrangler pages deploy dist --project-name haunted-pomodoro')).toMatch(/deploys are for a person/);
    expect(shell('npx wrangler deploy')).toMatch(/deploys/);
  });

  it('blocks every way of changing dependencies', () => {
    for (const command of ['npm i left-pad', 'npm add zod', 'npm update', 'npm uninstall react', 'yarn add zod', 'pnpm add zod', 'cd app && npm install']) {
      expect(shell(command), command).not.toBeNull();
    }
    expect(shell('echo "{}" > package.json')).toMatch(/package\.json/);
    expect(shell("sed -i '' 's/1/2/' package-lock.json")).toMatch(/package-lock\.json/);
  });

  it('blocks a file tool writing package.json or package-lock.json, by relative or absolute path', () => {
    const write = runGuard('fs_write', { command: 'create', path: 'package.json', file_text: '{}' });
    expect(write.status).toBe(2);
    expect(write.stderr).toMatch(/package\.json pins the dependencies/);
    expect(blockReason({ cwd: root, tool_name: 'str_replace', tool_input: { path: join(root, 'package-lock.json'), old_str: 'a', new_str: 'b' } })).not.toBeNull();
  });

  it('allows ordinary work: tests, builds, the locked install, git commit and source edits', () => {
    for (const command of ['npm ci', 'npm test', 'npm run check', 'npx playwright test', 'git status && git commit -m "Fix"', 'cat package.json', 'npm run trace -- --check']) {
      expect(shell(command), command).toBeNull();
    }
    expect(runGuard('fs_write', { command: 'create', path: 'src/core/house.ts', file_text: 'export {};' }).status).toBe(0);
    expect(blockReason({ cwd: root, tool_name: 'fs_write', tool_input: { path: 'docs/package.json.md' } })).toBeNull();
  });

  it('reads the kiro-cli 3.5 input shapes: fs_write { path, text }, str_replace { path, oldStr, newStr }, execute_bash { command }', () => {
    const lock = join(root, 'package-lock.json');
    expect(runGuard('fs_write', { path: join(root, 'package.json'), text: '{}' }).status).toBe(2);
    expect(runGuard('str_replace', { path: lock, oldStr: 'a', newStr: 'b' }).status).toBe(2);
    expect(runGuard('execute_bash', { command: 'pnpm add zod' }).status).toBe(2);
    expect(runGuard('fs_write', { path: join(root, 'src/core/house.ts'), text: 'export {};' }).status).toBe(0);
    expect(runGuard('str_replace', { path: join(root, 'src/App.tsx'), oldStr: 'a', newStr: 'b' }).status).toBe(0);
  });

  it('blocks a call it cannot read rather than letting it through', () => {
    const run = spawnSync(process.execPath, [guard], { input: 'not json', encoding: 'utf8' });
    expect(run.status).toBe(2);
  });
});

describe('Kiro SessionStart task list (scripts/kiro/open-tasks.mjs)', () => {
  it('lists only unchecked tasks, with their ids', () => {
    const md = ['- [x] 1. Done', '- [ ] 2. Open task (Req 1.1)', '  - [ ] 2.1 Open sub-task', '  - [x] 2.2 Done sub-task'].join('\n');
    expect(openTasks(md)).toEqual([
      { id: '2', text: 'Open task (Req 1.1)' },
      { id: '2.1', text: 'Open sub-task' },
    ]);
  });

  it('reports every spec in the repository', () => {
    const text = report(join(root, '.kiro/specs'));
    expect(text).toMatch(/^Open spec tasks: \d+/);
    expect(text).toContain('haunted-focus-timer:');
    expect(text).toContain('house-sync:');
  });
});
