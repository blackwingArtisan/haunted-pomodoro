#!/usr/bin/env node
/**
 * PreToolUse guard for Kiro (.kiro/hooks/guard-dependencies-and-pushes.json and the ghost-reviewer agent).
 *
 * Kiro passes the pending tool call as JSON on stdin: { hook_event_name, cwd, session_id, tool_name, tool_input }.
 * Exit code 2 blocks the call and stderr goes back to the agent as the reason. This guard blocks:
 *   1. shell commands that add, remove or upgrade a dependency (npm install|i|add|update|uninstall,
 *      yarn add|remove|upgrade, pnpm add|remove|update). `npm ci` installs the locked tree and is allowed.
 *   2. writes to package.json or package-lock.json, by a file tool or by a shell redirect.
 *   3. `git push`, and deploys (`wrangler deploy`, `wrangler pages deploy`).
 * Everything else exits 0. The same rules run in tests/unit/kiro-guard.test.ts.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHELL_TOOLS = new Set(['execute_bash', 'execute_pwsh', 'shell', 'run_command']);
const DEPENDENCY_FILES = /(^|\/)(package\.json|package-lock\.json)$/;
const DEPENDENCY_COMMAND = /\b(npm|pnpm)\s+(install|i|add|update|up|upgrade|uninstall|remove|rm)\b|\byarn\s+(add|remove|upgrade|up)\b/;
const PUSH_COMMAND = /\bgit\s+(?:(?:-C|-c|--git-dir|--work-tree)\s+\S+\s+|-\S+\s+)*push\b/;
const DEPLOY_COMMAND = /\bwrangler\s+(?:pages\s+)?deploy\b/;
const WRITES_DEPENDENCY_FILE = /(>|\btee\b|\bcp\b|\bmv\b|\bsed\s+-i)[^\n|;&]*\bpackage(-lock)?\.json\b/;

function commandOf(input) {
  if (!input || typeof input !== 'object') return '';
  return typeof input.command === 'string' ? input.command : '';
}

function pathOf(cwd, input) {
  if (!input || typeof input !== 'object') return null;
  const path = input.path ?? input.file_path ?? input.filePath;
  if (typeof path !== 'string' || path === '') return null;
  const full = isAbsolute(path) ? path : resolve(cwd, path);
  return relative(cwd, full).split(sep).join('/');
}

/** Returns why a pending tool call must be blocked, or null when it may run. */
export function blockReason(event) {
  const cwd = typeof event?.cwd === 'string' ? event.cwd : process.cwd();
  const tool = typeof event?.tool_name === 'string' ? event.tool_name : '';
  const input = event?.tool_input ?? {};

  if (SHELL_TOOLS.has(tool)) {
    const command = commandOf(input);
    if (DEPENDENCY_COMMAND.test(command)) {
      return 'Blocked: this command adds, removes or upgrades a dependency. Dependencies are pinned and changed by a person; use the packages already in package.json (npm ci is allowed).';
    }
    if (WRITES_DEPENDENCY_FILE.test(command)) {
      return 'Blocked: this command writes package.json or package-lock.json. Dependencies are changed by a person.';
    }
    if (PUSH_COMMAND.test(command)) {
      return 'Blocked: git push is for a person, after review. Commit locally and say what is ready.';
    }
    if (DEPLOY_COMMAND.test(command)) {
      return 'Blocked: deploys are for a person. Build and test locally (npm run check) and say what is ready.';
    }
    return null;
  }

  const path = pathOf(cwd, input);
  if (path && DEPENDENCY_FILES.test(path)) {
    return `Blocked: ${path} pins the dependencies and is changed by a person. Use the packages already installed.`;
  }
  return null;
}

function main() {
  let event;
  try {
    event = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    process.stderr.write('Blocked: the hook could not read the pending tool call.\n');
    process.exit(2);
  }
  const reason = blockReason(event);
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
