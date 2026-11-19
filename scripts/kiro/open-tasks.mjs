#!/usr/bin/env node
/**
 * Prints the unchecked tasks of every Kiro spec (.kiro/specs/<spec>/tasks.md). The SessionStart hook
 * (.kiro/hooks/open-tasks-on-start.json) runs it, so each Kiro session starts from the real backlog.
 * Always exits 0: the output is context for the agent, not a gate.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The unchecked tasks in one tasks.md, as "id  text" with the text cut to one line. */
export function openTasks(markdown) {
  return markdown
    .split('\n')
    .map((line) => /^\s*- \[ \] (\d+(?:\.\d+)?)\.?\s+(.*)$/.exec(line))
    .filter((m) => m !== null)
    .map((m) => ({ id: m[1], text: m[2].replace(/\s+/g, ' ').trim() }));
}

export function report(root = '.kiro/specs') {
  const specs = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
  const lines = [];
  let total = 0;
  for (const spec of specs) {
    const file = join(root, spec, 'tasks.md');
    if (!existsSync(file)) continue;
    const open = openTasks(readFileSync(file, 'utf8'));
    total += open.length;
    lines.push(`${spec}: ${open.length} open`);
    for (const t of open) lines.push(`  ${t.id}  ${t.text.length > 110 ? `${t.text.slice(0, 107)}...` : t.text}`);
  }
  return [`Open spec tasks: ${total}`, ...lines].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(report(process.argv[2]));
