import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { traceAll } from '../../scripts/trace.mjs';

// The counts the README and KIRO-LOG.md state are recomputed here from the session transcripts,
// the specs and .kiro/, so a stale number fails the suite instead of reaching a reader.
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const readme = read('README.md');
const log = read('KIRO-LOG.md');
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const credits = (value: number) => value.toFixed(2);

interface SessionRow {
  transcript: string;
  minutes: number;
  credits: number;
  hookRuns: number;
}

/** The rows of the "Sessions 2 to 7" table: | [n](transcript) | what | minutes | credits | hook runs | MCP | tests after | */
function sessionRows(): SessionRow[] {
  return log
    .split('\n')
    .filter((line) => /^\| \[\d+\]\(docs\/kiro-sessions\//.test(line))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim());
      return {
        transcript: /\((docs\/kiro-sessions\/[^)]+)\)/.exec(cells[1]!)![1]!,
        minutes: Number(cells[3]),
        credits: Number(cells[4]),
        hookRuns: Number(cells[5]),
      };
    });
}

const rows = sessionRows();
const passOneCredits = Number(/\*\*Credits used:\*\* ([\d.]+)/.exec(log)![1]);
const sessionCount = rows.length + 1;
const totalCredits = passOneCredits + sum(rows.map((r) => r.credits));

describe('KIRO-LOG session table', () => {
  it('lists every saved transcript once', () => {
    const files = readdirSync(join(root, 'docs/kiro-sessions')).map((f) => `docs/kiro-sessions/${f}`);
    expect(rows.map((r) => r.transcript).sort()).toEqual(files.sort());
  });

  it("matches each transcript's credits, wall time and hook runs", () => {
    for (const row of rows) {
      const transcript = read(row.transcript);
      expect(credits(row.credits), row.transcript).toBe(/Credits used: ([\d.]+)/.exec(transcript)![1]);
      const [, min, sec] = /\((\d+) min (\d+) s wall time/.exec(transcript)!;
      expect(row.minutes, row.transcript).toBe(Math.round((Number(min) * 60 + Number(sec)) / 6) / 10);
      expect(row.hookRuns, row.transcript).toBe(transcript.split('\n').filter((l) => l.startsWith('[hook] ')).length);
    }
  });

  it('states totals that add up', () => {
    expect(log).toContain(`${credits(sum(rows.map((r) => r.credits)))} for sessions 2 to 7`);
    expect(log).toContain(`used ${credits(totalCredits)} credits`);
    expect(log).toContain(`${sum(rows.map((r) => r.hookRuns))} hook runs over sessions 2 to 7`);
  });
});

describe('README counts', () => {
  it('match the Kiro log', () => {
    expect(readme).toContain(`${sessionCount} logged Kiro sessions (${credits(totalCredits)} credits)`);
    expect(readme).toContain(`${sum(rows.map((r) => r.hookRuns))} hook runs on the record`);
  });

  it('match the specs and the trace', () => {
    const { specs } = traceAll(root);
    const total = sum(specs.map((s) => s.result.rows.length));
    const covered = sum(specs.map((s) => s.result.covered));
    expect(readme).toContain(`${specs.length} specs · ${total} EARS criteria, ${covered} traced to tests`);
    expect(readme).toContain(`${covered} of ${total} criteria across the three specs`);
  });

  it('match the .kiro folder', () => {
    const hookFiles = readdirSync(join(root, '.kiro/hooks')).filter((f) => f.endsWith('.json'));
    const hooks = hookFiles.flatMap((f) => (JSON.parse(read(`.kiro/hooks/${f}`)) as { hooks: Array<{ trigger: string }> }).hooks);
    const triggers = new Set(hooks.map((h) => h.trigger));
    const steering = readdirSync(join(root, '.kiro/steering')).filter((f) => f.endsWith('.md'));
    const mcp = Object.keys((JSON.parse(read('.kiro/settings/mcp.json')) as { mcpServers: object }).mcpServers);
    const agents = readdirSync(join(root, '.kiro/agents')).filter((f) => f.endsWith('.json'));
    expect(readme).toContain(
      `${hooks.length} hooks on ${triggers.size} triggers · ${steering.length} steering files · ${mcp.length} MCP servers · ${agents.length} custom agent`,
    );
  });
});
