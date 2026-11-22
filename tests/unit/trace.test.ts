import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEC, parseCriteria, parseTests, renderTable, specFolders, tablePathFor, TABLE_PATH, tagSpec, trace, traceAll, traceRepo } from '../../scripts/trace.mjs';

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

// Fixtures are built line by line so that the trace of this repository does not read them as real tests.
const QUALIFIED = [
  '  // Req ghost-follows-you:2.1, 2.2',
  "  it('is qualified', () => {});",
  '  // Req 1.1',
  "  it('is not qualified', () => {});",
  '  // Req ghost-follows-you:2.1, 1.1',
  "  it('mixes one qualifier over a list', () => {});",
  '  // Req ghost-follows-you:9.9',
  "  it('names a criterion that does not exist', () => {});",
  "  it('says \"Req ghost-follows-you:2.2\" in its title', () => {});",
].join('\n');

const OTHER_SPEC = `# Requirements
## Requirement 1: Window
1. THE SYSTEM SHALL open.
## Requirement 2: Icon
1. THE SYSTEM SHALL draw.
2. THE SYSTEM SHALL fade.
`;

describe('traceability across specs', () => {
  // Req ghost-follows-you:13.1
  it('reads a qualified tag, with the qualifier applying to its whole list', () => {
    expect(parseTests(QUALIFIED, 'x.test.ts').map((t) => [t.title, t.reqs])).toEqual([
      ['is qualified', ['ghost-follows-you:2.1', 'ghost-follows-you:2.2']],
      ['is not qualified', ['1.1']],
      ['mixes one qualifier over a list', ['ghost-follows-you:2.1', 'ghost-follows-you:1.1']],
      ['names a criterion that does not exist', ['ghost-follows-you:9.9']],
      ['says "Req ghost-follows-you:2.2" in its title', ['ghost-follows-you:2.2']],
    ]);
    expect(tagSpec('ghost-follows-you:2.1')).toBe('ghost-follows-you');
    expect(tagSpec('2.1')).toBe(DEFAULT_SPEC);
  });

  // Req ghost-follows-you:13.1
  it('resolves a qualified tag in its own spec only, and an unqualified tag in the default spec', () => {
    const tests = parseTests(QUALIFIED, 'x.test.ts');
    const own = trace(parseCriteria(OTHER_SPEC), tests, 'ghost-follows-you');
    expect(own.rows.map((r) => [r.id, r.tests.length])).toEqual([['1.1', 1], ['2.1', 2], ['2.2', 2]]);
    const base = trace(parseCriteria(OTHER_SPEC), tests);
    expect(base.rows.map((r) => [r.id, r.tests.length])).toEqual([['1.1', 1], ['2.1', 0], ['2.2', 0]]);
  });

  // Req ghost-follows-you:13.1
  it('fails a tag that names a criterion that does not exist, in either kind of tag', () => {
    const tests = parseTests(QUALIFIED, 'x.test.ts');
    expect(trace(parseCriteria(OTHER_SPEC), tests, 'ghost-follows-you').unknown.map((u) => u.id)).toEqual(['9.9']);
    expect(trace(parseCriteria(SPEC), parseTests(TESTS, 'y.test.ts')).unknown.map((u) => u.id)).toEqual(['9.9']);
    expect(trace(parseCriteria(OTHER_SPEC), tests, 'house-sync').unknown).toEqual([]);
  });

  // Req ghost-follows-you:13.1
  it('writes a current table into every spec folder, and every tag in the suite names a real criterion', () => {
    const { specs, stray } = traceAll(root);
    expect(specs.map((s) => s.spec)).toEqual(specFolders(root));
    expect(specs.map((s) => s.spec)).toEqual(expect.arrayContaining([DEFAULT_SPEC, 'ghost-follows-you', 'house-sync']));
    expect(stray.map((s) => `${s.test.file}:${s.test.line} ${s.id}`)).toEqual([]);
    for (const s of specs) {
      expect(s.tablePath).toBe(tablePathFor(s.spec));
      expect(s.result.unknown.map((u) => `${u.test.file}:${u.test.line} Req ${s.spec}:${u.id}`), s.spec).toEqual([]);
      expect(readFileSync(`${root}/${s.tablePath}`, 'utf8'), `run npm run trace (${s.spec})`).toBe(s.table);
    }
  });
});
