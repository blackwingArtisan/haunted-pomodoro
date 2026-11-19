import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
