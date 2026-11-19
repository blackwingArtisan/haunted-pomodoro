import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCriteria, parseTests, renderTable, TABLE_PATH, trace, traceRepo } from '../../scripts/trace.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

const SPEC = `# Requirements
## Introduction
1. Not a criterion.
## Requirement 1: Timer
1. WHEN started, THE SYSTEM SHALL count down.
2. WHEN paused, THE SYSTEM SHALL freeze.
## Requirement 2: Tasks
1. THE SYSTEM SHALL keep tasks.
## Glossary
3. Not a criterion either.
`;

// Built line by line so that the trace of this repository does not read the fixture as real tests.
const TESTS = [
  "describe('timer', () => {",
  '  // Req 1.1, 1.2',
  "  it('counts down and pauses', () => {});",
  "  it('says \"Req 2.1\" in its title', () => {});",
  "  it('has no tag', () => {});",
  '  // Req 9.9',
  "  it('names a criterion that does not exist', () => {});",
  '});',
].join('\n');

describe('traceability', () => {
  it('reads numbered criteria under requirement headings only', () => {
    expect(parseCriteria(SPEC).map((c) => [c.id, c.requirement])).toEqual([
      ['1.1', 'Timer'],
      ['1.2', 'Timer'],
      ['2.1', 'Tasks'],
    ]);
  });

  it('reads tags from the comment above a test and from its title', () => {
    expect(parseTests(TESTS, 'x.test.ts').map((t) => [t.line, t.title, t.reqs])).toEqual([
      [3, 'counts down and pauses', ['1.1', '1.2']],
      [4, 'says "Req 2.1" in its title', ['2.1']],
      [5, 'has no tag', []],
      [7, 'names a criterion that does not exist', ['9.9']],
    ]);
  });

  it('lists covered and uncovered criteria and tags that name no criterion', () => {
    const result = trace(parseCriteria(SPEC), parseTests(TESTS.replace('says "Req 2.1" in its title', 'has another title'), 'x.test.ts'));
    expect(result.covered).toBe(2);
    expect(result.uncovered).toEqual(['2.1']);
    expect(result.unknown.map((u) => u.id)).toEqual(['9.9']);
    expect(renderTable(result)).toContain('| 2.1 | (none yet) |');
  });

  it('every tag in the test suite names a real criterion, and the published table is current', () => {
    const { result, table } = traceRepo(root);
    expect(result.unknown.map((u) => `${u.test.file}:${u.test.line} Req ${u.id}`)).toEqual([]);
    expect(readFileSync(`${root}/${TABLE_PATH}`, 'utf8'), 'run npm run trace').toBe(table);
  });
});
