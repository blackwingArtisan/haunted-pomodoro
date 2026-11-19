// Types for scripts/trace.mjs, which stays plain JavaScript so it runs on every supported Node version.
export interface Criterion {
  id: string;
  requirement: string;
  text: string;
}
export interface TracedTest {
  file: string;
  line: number;
  title: string;
  reqs: string[];
}
export interface TraceResult {
  rows: Array<Criterion & { tests: TracedTest[] }>;
  covered: number;
  uncovered: string[];
  unknown: Array<{ id: string; test: TracedTest }>;
  tagged: number;
  total: number;
}
export const SPEC_DIR: string;
export const TABLE_PATH: string;
export function parseCriteria(markdown: string): Criterion[];
export function parseTests(source: string, file: string): TracedTest[];
export function trace(criteria: Criterion[], tests: TracedTest[]): TraceResult;
export function renderTable(result: TraceResult): string;
export function traceRepo(root: string): { result: TraceResult; table: string };
