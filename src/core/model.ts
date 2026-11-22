/**
 * The whole app state and its reducer. The reducer is pure: it takes the current time as an
 * argument and returns the next model plus cues (sounds, announcements, theatrical moments) for the
 * UI to play. Persistence, audio and the DOM live outside.
 */
import { dayKey, type DayKey } from './dates';
import { EMPTY_HOUSE, lightCandle, type HouseState, type RoomDef } from './house';
import {
  DEFAULT_TIMER_CONFIG,
  MINUTE,
  initialTimer,
  step,
  type Phase,
  type TimerAction,
  type TimerConfig,
  type TimerEffect,
  type TimerState,
} from './timer';

export type MotionPreference = 'system' | 'reduced' | 'full';

export interface Settings {
  focusMin: number;
  shortMin: number;
  longMin: number;
  longEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  /** 0 to 1. */
  volume: number;
  muted: boolean;
  ambient: boolean;
  /** The ghost makes a soft sound when you wander off during focus. */
  ghostCalls: boolean;
  /** Show a browser notification when a phase ends while the tab is hidden. Off until the person asks. */
  notifyPhaseEnd: boolean;
  /** Open the follow window when a focus candle is lit by a gesture. Off until the person turns it on. */
  ghostFollows: boolean;
  motion: MotionPreference;
}

export const DEFAULT_SETTINGS: Settings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  volume: 0.6,
  muted: false,
  ambient: false,
  ghostCalls: true,
  notifyPhaseEnd: false,
  ghostFollows: false,
  motion: 'system',
};

export const SETTING_LIMITS = {
  focusMin: [1, 120],
  shortMin: [1, 60],
  longMin: [1, 90],
  longEvery: [2, 8],
} as const;

export interface Task {
  id: string;
  title: string;
  /** Planned focus sessions. */
  estimate: number;
  /** Focus sessions finished while this task was active. */
  spent: number;
  done: boolean;
  createdAt: number;
}

export interface DayLog {
  sessions: number;
  focusMs: number;
  /** Counted wanderings, which are also the comebacks: every counted wandering ends in a return. */
  distractions: number;
  /** Time away from the tab across that day's counted wanderings. Absent in saves made before it was logged. */
  awayMs?: number;
}

export interface AppModel {
  version: 1;
  settings: Settings;
  tasks: Task[];
  activeTaskId: string | null;
  days: Record<DayKey, DayLog>;
  house: HouseState;
  timer: TimerState;
  /** Last time anything worth syncing changed. */
  updatedAt: number;
}

/** Demo mode: a whole session in thirty seconds, for showing the house off. */
export const DEMO_TIMER_CONFIG: TimerConfig = {
  focusMs: 20_000,
  shortMs: 10_000,
  longMs: 10_000,
  longEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  distractionGraceMs: 2_000,
};

export function timerConfig(settings: Settings): TimerConfig {
  return {
    ...DEFAULT_TIMER_CONFIG,
    focusMs: settings.focusMin * MINUTE,
    shortMs: settings.shortMin * MINUTE,
    longMs: settings.longMin * MINUTE,
    longEvery: settings.longEvery,
    autoStartBreaks: settings.autoStartBreaks,
    autoStartFocus: settings.autoStartFocus,
  };
}

export function createModel(now: number, settings: Settings = DEFAULT_SETTINGS, configFor: (s: Settings) => TimerConfig = timerConfig): AppModel {
  return {
    version: 1,
    settings,
    tasks: [],
    activeTaskId: null,
    days: {},
    house: EMPTY_HOUSE,
    timer: initialTimer(configFor(settings)),
    updatedAt: now,
  };
}

export type AppAction =
  | { type: 'timer'; action: TimerAction }
  | { type: 'addTask'; id: string; title: string; estimate: number }
  | { type: 'renameTask'; id: string; title: string }
  | { type: 'setEstimate'; id: string; estimate: number }
  | { type: 'toggleTaskDone'; id: string }
  | { type: 'removeTask'; id: string }
  | { type: 'setActiveTask'; id: string | null }
  | { type: 'clearDoneTasks' }
  | { type: 'updateSettings'; patch: Partial<Settings> };

export type Cue =
  | { kind: 'candleLit' }
  | { kind: 'candleSnuffed' }
  | { kind: 'sessionComplete'; distractions: number }
  | { kind: 'roomRestored'; room: RoomDef; houseRestored: boolean }
  | { kind: 'breakStarted'; phase: 'short' | 'long' }
  | { kind: 'breakOver' }
  | { kind: 'ghostWoke' }
  | { kind: 'ghostReturned'; count: number }
  | { kind: 'phase'; phase: Phase; autoStarted: boolean };

export interface ReduceResult {
  model: AppModel;
  cues: Cue[];
}

const MAX_TITLE = 140;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const s = { ...base, ...patch };
  return {
    focusMin: clampInt(s.focusMin, ...SETTING_LIMITS.focusMin),
    shortMin: clampInt(s.shortMin, ...SETTING_LIMITS.shortMin),
    longMin: clampInt(s.longMin, ...SETTING_LIMITS.longMin),
    longEvery: clampInt(s.longEvery, ...SETTING_LIMITS.longEvery),
    autoStartBreaks: Boolean(s.autoStartBreaks),
    autoStartFocus: Boolean(s.autoStartFocus),
    volume: Number.isFinite(s.volume) ? Math.min(1, Math.max(0, s.volume)) : base.volume,
    muted: Boolean(s.muted),
    ambient: Boolean(s.ambient),
    ghostCalls: Boolean(s.ghostCalls),
    notifyPhaseEnd: s.notifyPhaseEnd === true,
    ghostFollows: s.ghostFollows === true,
    motion: s.motion === 'reduced' || s.motion === 'full' ? s.motion : 'system',
  };
}

function cleanTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
}

function logDay(days: Record<DayKey, DayLog>, now: number, patch: (d: DayLog) => DayLog): Record<DayKey, DayLog> {
  const key = dayKey(now);
  const current = days[key] ?? { sessions: 0, focusMs: 0, distractions: 0 };
  return { ...days, [key]: patch(current) };
}

function applyTimerEffects(model: AppModel, effects: TimerEffect[], now: number): ReduceResult {
  let next = model;
  const cues: Cue[] = [];
  for (const effect of effects) {
    switch (effect.type) {
      case 'focusStarted':
        cues.push({ kind: 'candleLit' });
        break;
      case 'focusAbandoned':
        cues.push({ kind: 'candleSnuffed' });
        break;
      case 'focusCompleted': {
        const lit = lightCandle(next.house);
        next = {
          ...next,
          house: lit.house,
          tasks: next.tasks.map((t) => (t.id === next.activeTaskId ? { ...t, spent: t.spent + 1 } : t)),
          days: logDay(next.days, now, (d) => ({ ...d, sessions: d.sessions + 1, focusMs: d.focusMs + effect.durationMs })),
          updatedAt: now,
        };
        cues.push({ kind: 'sessionComplete', distractions: effect.distractions });
        if (lit.restoredRoom) cues.push({ kind: 'roomRestored', room: lit.restoredRoom, houseRestored: lit.houseRestored });
        break;
      }
      case 'breakStarted':
        cues.push({ kind: 'breakStarted', phase: effect.phase });
        break;
      case 'breakCompleted':
        cues.push({ kind: 'breakOver' });
        break;
      case 'ghostWoke':
        cues.push({ kind: 'ghostWoke' });
        break;
      case 'distracted':
        next = {
          ...next,
          days: logDay(next.days, now, (d) => ({ ...d, distractions: d.distractions + 1, awayMs: (d.awayMs ?? 0) + effect.awayMs })),
          updatedAt: now,
        };
        cues.push({ kind: 'ghostReturned', count: effect.count });
        break;
      case 'phaseChanged':
        cues.push({ kind: 'phase', phase: effect.phase, autoStarted: effect.autoStarted });
        break;
    }
  }
  return { model: next, cues };
}

/** Maps settings to timer lengths. Demo mode swaps in a function that returns the demo lengths. */
export type ConfigFor = (settings: Settings) => TimerConfig;

export const demoConfigFor: ConfigFor = (settings) => ({
  ...DEMO_TIMER_CONFIG,
  autoStartBreaks: settings.autoStartBreaks,
  autoStartFocus: settings.autoStartFocus,
});

export function reduceApp(model: AppModel, action: AppAction, now: number, configFor: ConfigFor = timerConfig): ReduceResult {
  const touched = (patch: Partial<AppModel>): ReduceResult => ({ model: { ...model, ...patch, updatedAt: now }, cues: [] });
  switch (action.type) {
    case 'timer': {
      const result = step(model.timer, action.action, now, configFor(model.settings));
      if (result.state === model.timer && result.effects.length === 0) return { model, cues: [] };
      return applyTimerEffects({ ...model, timer: result.state }, result.effects, now);
    }
    case 'addTask': {
      const title = cleanTitle(action.title);
      if (!title || model.tasks.some((t) => t.id === action.id)) return { model, cues: [] };
      const task: Task = { id: action.id, title, estimate: clampInt(action.estimate, 1, 12), spent: 0, done: false, createdAt: now };
      return touched({ tasks: [...model.tasks, task], activeTaskId: model.activeTaskId ?? task.id });
    }
    case 'renameTask': {
      const title = cleanTitle(action.title);
      if (!title) return { model, cues: [] };
      return touched({ tasks: model.tasks.map((t) => (t.id === action.id ? { ...t, title } : t)) });
    }
    case 'setEstimate':
      return touched({ tasks: model.tasks.map((t) => (t.id === action.id ? { ...t, estimate: clampInt(action.estimate, 1, 12) } : t)) });
    case 'toggleTaskDone': {
      const tasks = model.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
      const finished = tasks.find((t) => t.id === action.id)?.done;
      const activeTaskId = finished && model.activeTaskId === action.id ? (tasks.find((t) => !t.done)?.id ?? null) : model.activeTaskId;
      return touched({ tasks, activeTaskId });
    }
    case 'removeTask': {
      const tasks = model.tasks.filter((t) => t.id !== action.id);
      const activeTaskId = model.activeTaskId === action.id ? (tasks.find((t) => !t.done)?.id ?? null) : model.activeTaskId;
      return touched({ tasks, activeTaskId });
    }
    case 'setActiveTask':
      if (action.id !== null && !model.tasks.some((t) => t.id === action.id)) return { model, cues: [] };
      return touched({ activeTaskId: action.id });
    case 'clearDoneTasks': {
      const tasks = model.tasks.filter((t) => !t.done);
      const activeTaskId = tasks.some((t) => t.id === model.activeTaskId) ? model.activeTaskId : (tasks[0]?.id ?? null);
      return touched({ tasks, activeTaskId });
    }
    case 'updateSettings': {
      const settings = normalizeSettings(action.patch, model.settings);
      const config = configFor(settings);
      const timer = step(model.timer, { type: 'configure', config }, now, config).state;
      return touched({ settings, timer });
    }
  }
}
