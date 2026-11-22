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
  /** Unqualified (`2.3`, the default spec) or qualified (`ghost-follows-you:2.3`). */
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
export interface SpecTrace {
  spec: string;
  tablePath: string;
  result: TraceResult;
  table: string;
}
export const SPECS_DIR: string;
export const DEFAULT_SPEC: string;
export const SPEC_DIR: string;
export const TABLE_PATH: string;
export function tablePathFor(spec: string): string;
export function tagSpec(tag: string): string;
export function tagId(tag: string): string;
export function parseCriteria(markdown: string): Criterion[];
export function parseTests(source: string, file: string): TracedTest[];
export function trace(criteria: Criterion[], tests: TracedTest[], spec?: string): TraceResult;
export function renderTable(result: TraceResult): string;
export function specFolders(root: string): string[];
export function traceAll(root: string): { specs: SpecTrace[]; stray: Array<{ id: string; test: TracedTest }> };
export function traceRepo(root: string): { result: TraceResult; table: string };
