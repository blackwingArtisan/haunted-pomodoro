/**
 * Turning the model into stored text and back. Anything read from storage is untrusted (an old
 * version, a hand edit, a half-written sync), so `parseModel` rebuilds a valid model field by field
 * and falls back to defaults rather than throwing.
 */
import { isDayKey, type DayKey } from './dates';
import { houseScore, type HouseState } from './house';
import { createModel, normalizeSettings, timerConfig, type AppModel, type DayLog, type Task } from './model';
import { initialTimer, type Phase, type Status, type TimerState } from './timer';

export const STORAGE_KEY = 'haunted-pomodoro/v1';
const MAX_TASKS = 200;
const MAX_DAYS = 800;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function int(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.round(num(value, fallback, min, max));
}

function parseTask(raw: unknown, now: number): Task | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;
  const title = raw.title.trim().slice(0, 140);
  if (!raw.id || !title) return null;
  return {
    id: raw.id.slice(0, 64),
    title,
    estimate: int(raw.estimate, 1, 1, 12),
    spent: int(raw.spent, 0, 0, 10_000),
    done: raw.done === true,
    createdAt: num(raw.createdAt, now),
  };
}

function parseDays(raw: unknown): Record<DayKey, DayLog> {
  if (!isObject(raw)) return {};
  const entries = Object.entries(raw)
    .filter(([key, value]) => isDayKey(key) && isObject(value))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-MAX_DAYS)
    .map(([key, value]): [DayKey, DayLog] => {
      const v = value as Json;
      return [key, { sessions: int(v.sessions, 0, 0, 1_000), focusMs: num(v.focusMs, 0, 0), distractions: int(v.distractions, 0, 0, 10_000) }];
    });
  return Object.fromEntries(entries);
}

function parseHouse(raw: unknown): HouseState {
  if (!isObject(raw)) return { candlesLit: 0, roomsRestored: 0 };
  return { candlesLit: int(raw.candlesLit, 0, 0, 3), roomsRestored: int(raw.roomsRestored, 0, 0, 1_000_000) };
}

const PHASES: readonly Phase[] = ['focus', 'short', 'long'];
const STATUSES: readonly Status[] = ['idle', 'running', 'paused'];

function parseTimer(raw: unknown, fallback: TimerState): TimerState {
  if (!isObject(raw)) return fallback;
  const phase = PHASES.includes(raw.phase as Phase) ? (raw.phase as Phase) : fallback.phase;
  let status = STATUSES.includes(raw.status as Status) ? (raw.status as Status) : 'idle';
  const durationMs = num(raw.durationMs, fallback.durationMs, 1_000, 24 * 3_600_000);
  const remainingMs = num(raw.remainingMs, durationMs, 0, durationMs);
  let endsAt = typeof raw.endsAt === 'number' && Number.isFinite(raw.endsAt) ? raw.endsAt : null;
  if (status === 'running' && endsAt === null) status = 'idle';
  if (status !== 'running') endsAt = null;
  return {
    phase,
    status,
    durationMs,
    remainingMs,
    endsAt,
    completedInCycle: int(raw.completedInCycle, 0, 0, 100),
    distractions: int(raw.distractions, 0, 0, 10_000),
    awayMs: num(raw.awayMs, 0, 0),
    // A reload means the person is looking at the page again.
    hiddenSince: null,
    ghostWoke: false,
  };
}

export function parseModel(raw: unknown, now: number): AppModel {
  const base = createModel(now);
  if (!isObject(raw) || raw.version !== 1) return base;
  const settings = normalizeSettings(isObject(raw.settings) ? (raw.settings as never) : {});
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
    .map((t) => parseTask(t, now))
    .filter((t): t is Task => t !== null)
    .filter((t, i, all) => all.findIndex((o) => o.id === t.id) === i)
    .slice(0, MAX_TASKS);
  const activeTaskId = typeof raw.activeTaskId === 'string' && tasks.some((t) => t.id === raw.activeTaskId) ? raw.activeTaskId : null;
  return {
    version: 1,
    settings,
    tasks,
    activeTaskId,
    days: parseDays(raw.days),
    house: parseHouse(raw.house),
    timer: parseTimer(raw.timer, initialTimer(timerConfig(settings))),
    updatedAt: num(raw.updatedAt, now),
  };
}

export function serializeModel(model: AppModel): string {
  return JSON.stringify(model);
}

export function deserializeModel(text: string | null, now: number): AppModel | null {
  if (text === null) return null;
  try {
    return parseModel(JSON.parse(text), now);
  } catch {
    return null;
  }
}

/**
 * Combines this device's copy with a synced copy. The newer copy wins for settings and tasks; day
 * logs keep the larger count for each day; the house keeps whichever copy is further restored, so
 * progress never moves backward. The running timer always stays with this device.
 */
export function mergeModels(local: AppModel, remote: AppModel): AppModel {
  const newer = remote.updatedAt > local.updatedAt ? remote : local;
  const days: Record<DayKey, DayLog> = { ...local.days };
  for (const [key, r] of Object.entries(remote.days)) {
    const l = days[key];
    days[key] = l
      ? { sessions: Math.max(l.sessions, r.sessions), focusMs: Math.max(l.focusMs, r.focusMs), distractions: Math.max(l.distractions, r.distractions) }
      : r;
  }
  return {
    ...newer,
    days,
    house: houseScore(remote.house) > houseScore(local.house) ? remote.house : local.house,
    timer: local.timer,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}
