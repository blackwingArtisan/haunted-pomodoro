import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCriteria, specFolders } from '../../scripts/trace.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const kiro = join(root, '.kiro');
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

// The trigger names Kiro's agent engine (v3.5.0) accepts in a standalone hook file or a custom agent's hooks.
const TRIGGERS = new Set(['SessionStart', 'SessionEnd', 'Stop', 'PreToolUse', 'PostToolUse', 'PreTaskExec', 'PostTaskExec', 'UserPromptSubmit', 'PostFileCreate', 'PostFileSave', 'PostFileDelete', 'Manual']);

interface Hook {
  name: string;
  trigger: string;
  matcher?: string;
  action: { type: 'command'; command: string } | { type: 'agent'; prompt: string };
}

/** A command hook must run something that exists: an npm script or a script file in the repo. */
function expectRunnable(command: string, where: string) {
  const scripts = (readJson(join(root, 'package.json')).scripts ?? {}) as Record<string, string>;
  for (const npm of command.matchAll(/npm (?:run )?([\w:-]+)/g)) {
    const name = npm[1]!;
    if (name === 'test' || name === 'run') continue;
    expect(scripts[name], `${where}: npm script "${name}"`).toBeTypeOf('string');
  }
  for (const file of command.matchAll(/node ([\w./-]+\.mjs)/g)) expect(existsSync(join(root, file[1]!)), `${where}: ${file[1]}`).toBe(true);
}

function expectValidHook(hook: Hook, where: string) {
  expect(hook.name, where).toBeTruthy();
  expect(TRIGGERS.has(hook.trigger), `${where}: trigger ${hook.trigger}`).toBe(true);
  if (hook.matcher !== undefined) expect(() => new RegExp(hook.matcher!), `${where}: matcher`).not.toThrow();
  if (hook.action.type === 'command') expectRunnable(hook.action.command, where);
  else expect(hook.action.prompt.length, where).toBeGreaterThan(40);
}

describe('Kiro configuration', () => {
  const hookFiles = readdirSync(join(kiro, 'hooks')).filter((f) => f.endsWith('.json'));

  it('every hook file is in the v1 format with a known trigger and something runnable', () => {
    expect(hookFiles.length).toBeGreaterThanOrEqual(9);
    for (const file of hookFiles) {
      const doc = readJson(join(kiro, 'hooks', file));
      expect(doc.version, file).toBe('v1');
      const hooks = doc.hooks as Hook[];
      expect(hooks.length, file).toBeGreaterThan(0);
      for (const hook of hooks) expectValidHook(hook, file);
    }
  });

  it('covers the session, tool, task, save, stop and manual triggers', () => {
    const triggers = new Set(hookFiles.flatMap((f) => (readJson(join(kiro, 'hooks', f)).hooks as Hook[]).map((h) => h.trigger)));
    for (const t of ['SessionStart', 'PreToolUse', 'PostTaskExec', 'PostFileSave', 'Stop', 'Manual']) expect(triggers.has(t), t).toBe(true);
  });

  it('every PostFileSave matcher matches an absolute path to a file it is meant to cover', () => {
    // kiro-cli tests the matcher against the absolute path, so a pattern anchored with ^src/ never fires.
    const covered: Record<string, { hits: string[]; misses: string[] }> = {
      'a11y-motion-guard.json': { hits: ['src/styles.css', 'src/App.tsx', 'src/ui/Scene.tsx', 'src/ui/panels.tsx'], misses: ['src/core/timer.ts', 'src/ui/candles.ts', 'docs/src/App.tsx.md'] },
      'core-tests.json': { hits: ['src/core/timer.ts', 'src/adapters/notify.ts', 'src/adapters/store/local.ts', 'src/app/controller.ts', 'src/audio/sound.ts', 'worker/index.ts'], misses: ['src/App.tsx', 'src/ui/Scene.tsx', 'tests/unit/timer.test.ts'] },
      'test-on-save.json': { hits: ['src/core/model.ts', 'src/adapters/notify.ts', 'src/app/controller.ts', 'src/audio/levels.ts', 'worker/index.ts', 'tests/unit/timer.test.ts'], misses: ['src/App.tsx', 'tests/e2e/timer.spec.ts', 'src/core/notes.md'] },
      'never-punish-guard.json': { hits: ['src/core/house.ts', 'src/core/streak.ts', 'src/core/snapshot.ts', 'src/core/model.ts', 'src/core/house-file.ts', 'src/core/wisps.ts', 'src/core/follow.ts', 'src/app/follow.ts'], misses: ['src/core/timer.ts', 'src/core/story.ts', 'src/app/house.ts', 'src/core/favicon.ts', 'src/core/tab-title.ts', 'src/adapters/pip/browser.ts', 'src/ui/follow.ts', 'src/app/follow.tsx'] },
    };
    const seen = new Set<string>();
    for (const file of hookFiles) {
      for (const hook of readJson(join(kiro, 'hooks', file)).hooks as Hook[]) {
        if (hook.trigger !== 'PostFileSave') continue;
        seen.add(file);
        expect(hook.matcher, `${file}: a save hook needs a matcher`).toBeTruthy();
        expect(hook.matcher!.startsWith('^'), `${file}: ${hook.matcher} is anchored to the start of an absolute path`).toBe(false);
        const cases = covered[file];
        expect(cases, `${file}: add the paths this matcher should and should not cover`).toBeDefined();
        const matcher = new RegExp(hook.matcher!);
        for (const path of cases!.hits) expect(matcher.test(join(root, path)), `${file} should match ${join(root, path)}`).toBe(true);
        for (const path of cases!.misses) expect(matcher.test(join(root, path)), `${file} should not match ${join(root, path)}`).toBe(false);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(covered).sort());
  });

  it('the custom agent loads files that exist and its hooks are valid', () => {
    for (const file of readdirSync(join(kiro, 'agents')).filter((f) => f.endsWith('.json'))) {
      const agent = readJson(join(kiro, 'agents', file));
      expect(agent.name, file).toBe(file.replace(/\.json$/, ''));
      expect(String(agent.prompt).length).toBeGreaterThan(100);
      for (const resource of agent.resources as string[]) expect(existsSync(join(root, resource.replace(/^file:\/\//, ''))), resource).toBe(true);
      for (const hook of agent.hooks as Hook[]) expectValidHook(hook, `${file} ${hook.name}`);
    }
  });

  it('MCP servers are pinned to exact versions', () => {
    const servers = readJson(join(kiro, 'settings/mcp.json')).mcpServers as Record<string, { command: string; args: string[] }>;
    expect(Object.keys(servers).sort()).toEqual(['context7', 'playwright']);
    for (const [name, server] of Object.entries(servers)) {
      const pkg = server.args.find((a) => a.startsWith('@'));
      expect(pkg, name).toMatch(/^@[\w-]+\/[\w-]+@\d+\.\d+\.\d+$/);
    }
  });

  it('steering files declare how they are included, and file-match patterns point at real folders', () => {
    for (const file of readdirSync(join(kiro, 'steering'))) {
      const text = readFileSync(join(kiro, 'steering', file), 'utf8');
      const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
      expect(front, file).not.toBeNull();
      const inclusion = /inclusion:\s*(\w+)/.exec(front![1]!)?.[1];
      expect(['always', 'fileMatch', 'manual', 'auto'], file).toContain(inclusion);
      if (inclusion === 'fileMatch') {
        const patterns = JSON.parse(/fileMatchPattern:\s*(\[.*\])/.exec(front![1]!)![1]!) as string[];
        for (const p of patterns) expect(existsSync(join(root, p.replace(/\/\*\*.*$/, ''))), `${file}: ${p}`).toBe(true);
      }
    }
  });
});

describe('spec folders', () => {
  const specsDir = join(kiro, 'specs');

  // Req ghost-follows-you:13.1
  it('every folder under .kiro/specs has requirements.md, design.md and tasks.md', () => {
    const folders = readdirSync(specsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(folders.length).toBeGreaterThanOrEqual(3);
    expect(specFolders(root)).toEqual([...folders].sort());
    for (const folder of folders) {
      for (const file of ['requirements.md', 'design.md', 'tasks.md']) expect(existsSync(join(specsDir, folder, file)), `${folder}/${file}`).toBe(true);
    }
  });

  /** The criteria a task line names in "(Req 4.1, 5.4 to 5.8)" or "(traces Req 1.1 to 13.7)", in the spec's own order. */
  function namedBy(line: string, order: string[]): { named: string[]; missing: string[] } {
    const named: string[] = [];
    const missing: string[] = [];
    for (const group of line.matchAll(/\((?:traces )?Req ([^)]*)\)/g)) {
      for (const part of group[1]!.split(',').map((p) => p.trim()).filter(Boolean)) {
        const [from, to] = part.split(/\s+to\s+/) as [string, string | undefined];
        const start = order.indexOf(from);
        const end = to === undefined ? start : order.indexOf(to);
        if (start < 0) missing.push(from);
        if (end < 0) missing.push(to!);
        if (start >= 0 && end >= start) named.push(...order.slice(start, end + 1));
        else if (start >= 0 && end >= 0) missing.push(part);
      }
    }
    return { named, missing };
  }

  // Req ghost-follows-you:13.1
  it('every task of ghost-follows-you names criteria that exist, and every criterion is named by a task', () => {
    const dir = join(specsDir, 'ghost-follows-you');
    const order = parseCriteria(readFileSync(join(dir, 'requirements.md'), 'utf8')).map((c) => c.id);
    const tasks = readFileSync(join(dir, 'tasks.md'), 'utf8').split('\n').filter((l) => /^\s*- \[[ x]\] \d+(\.\d+)?\.? /.test(l));
    expect(tasks.length).toBeGreaterThanOrEqual(24);
    const covered = new Set<string>();
    for (const line of tasks) {
      const { named, missing } = namedBy(line, order);
      expect(missing, line.slice(0, 60)).toEqual([]);
      expect(named.length, `a task names no criterion: ${line.slice(0, 60)}`).toBeGreaterThan(0);
      for (const id of named) covered.add(id);
    }
    expect(order.filter((id) => !covered.has(id)), 'criteria no task names').toEqual([]);
  });
});
