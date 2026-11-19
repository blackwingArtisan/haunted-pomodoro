/**
 * The timer state machine. Pure: every transition takes the current time as an argument and
 * returns a new state plus the effects the rest of the app reacts to (light a candle, wake the
 * ghost, ring the bell). Nothing here reads a clock or touches the DOM.
 *
 * Time is kept as an absolute end time while running, so a throttled background tab or a slow
 * frame never makes the timer drift.
 */

export type Phase = 'focus' | 'short' | 'long';
export type Status = 'idle' | 'running' | 'paused';

export interface TimerConfig {
  focusMs: number;
  shortMs: number;
  longMs: number;
  /** A long break follows every `longEvery` finished focus sessions. */
  longEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  /** Time away from the tab that is forgiven before it counts as a distraction. */
  distractionGraceMs: number;
}

export interface TimerState {
  phase: Phase;
  status: Status;
  /** Full length of the current phase. */
  durationMs: number;
  /** Time left; authoritative while idle or paused. */
  remainingMs: number;
  /** Absolute end time; authoritative while running. */
  endsAt: number | null;
  /** Finished focus sessions since the last long break. */
  completedInCycle: number;
  /** Distractions counted in the current focus session. */
  distractions: number;
  /** Time spent away from the tab in the current focus session, counted distractions only. */
  awayMs: number;
  /** When the tab was hidden during a running focus session, else null. */
  hiddenSince: number | null;
  /** True once the ghost has woken for the current absence. */
  ghostWoke: boolean;
}

export type TimerAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'toggle' }
  | { type: 'skip' }
  | { type: 'reset' }
  | { type: 'tick' }
  | { type: 'hidden' }
  | { type: 'visible' }
  | { type: 'configure'; config: TimerConfig };

export type TimerEffect =
  | { type: 'focusStarted' }
  | { type: 'focusCompleted'; durationMs: number; distractions: number; awayMs: number }
  | { type: 'focusAbandoned' }
  | { type: 'breakStarted'; phase: 'short' | 'long' }
  | { type: 'breakCompleted'; phase: 'short' | 'long' }
  | { type: 'ghostWoke' }
  | { type: 'distracted'; count: number; awayMs: number }
  | { type: 'phaseChanged'; phase: Phase; autoStarted: boolean };

export interface StepResult {
  state: TimerState;
  effects: TimerEffect[];
}

export const MINUTE = 60_000;

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  focusMs: 25 * MINUTE,
  shortMs: 5 * MINUTE,
  longMs: 15 * MINUTE,
  longEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  distractionGraceMs: 3_000,
};

export function phaseDuration(phase: Phase, config: TimerConfig): number {
  switch (phase) {
    case 'focus':
      return config.focusMs;
    case 'short':
      return config.shortMs;
    case 'long':
      return config.longMs;
  }
}

export function initialTimer(config: TimerConfig = DEFAULT_TIMER_CONFIG): TimerState {
  return {
    phase: 'focus',
    status: 'idle',
    durationMs: config.focusMs,
    remainingMs: config.focusMs,
    endsAt: null,
    completedInCycle: 0,
    distractions: 0,
    awayMs: 0,
    hiddenSince: null,
    ghostWoke: false,
  };
}

export function remainingAt(state: TimerState, now: number): number {
  if (state.status === 'running' && state.endsAt !== null) return Math.max(0, state.endsAt - now);
  return state.remainingMs;
}

/** 0 at the start of the phase, 1 at its end. */
export function progressAt(state: TimerState, now: number): number {
  if (state.durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - remainingAt(state, now) / state.durationMs));
}

/** True when a focus session has begun and not yet finished or been reset. */
export function focusInProgress(state: TimerState): boolean {
  return state.phase === 'focus' && (state.status === 'running' || (state.status === 'paused' && state.remainingMs < state.durationMs));
}

function enterPhase(
  state: TimerState,
  phase: Phase,
  config: TimerConfig,
  now: number,
  autoStart: boolean,
  completedInCycle: number,
): StepResult {
  const durationMs = phaseDuration(phase, config);
  const next: TimerState = {
    ...state,
    phase,
    status: autoStart ? 'running' : 'idle',
    durationMs,
    remainingMs: durationMs,
    endsAt: autoStart ? now + durationMs : null,
    completedInCycle,
    distractions: 0,
    awayMs: 0,
    hiddenSince: null,
    ghostWoke: false,
  };
  const effects: TimerEffect[] = [{ type: 'phaseChanged', phase, autoStarted: autoStart }];
  if (autoStart) effects.push(phase === 'focus' ? { type: 'focusStarted' } : { type: 'breakStarted', phase });
  return { state: next, effects };
}

/** Counts a pending absence if it has outlasted the grace period. */
function settleAbsence(state: TimerState, now: number, config: TimerConfig): StepResult {
  if (state.hiddenSince === null) return { state, effects: [] };
  const away = Math.max(0, now - state.hiddenSince);
  const cleared: TimerState = { ...state, hiddenSince: null, ghostWoke: false };
  if (away < config.distractionGraceMs) return { state: cleared, effects: [] };
  const distractions = state.distractions + 1;
  return {
    state: { ...cleared, distractions, awayMs: state.awayMs + away },
    effects: [{ type: 'distracted', count: distractions, awayMs: away }],
  };
}

function complete(state: TimerState, config: TimerConfig, now: number): StepResult {
  if (state.phase === 'focus') {
    const settled = settleAbsence(state, now, config);
    const s = settled.state;
    const completedInCycle = s.completedInCycle + 1;
    const nextPhase: Phase = completedInCycle % Math.max(1, config.longEvery) === 0 ? 'long' : 'short';
    const entered = enterPhase(s, nextPhase, config, now, config.autoStartBreaks, completedInCycle);
    return {
      state: entered.state,
      effects: [
        ...settled.effects,
        { type: 'focusCompleted', durationMs: s.durationMs, distractions: s.distractions, awayMs: s.awayMs },
        ...entered.effects,
      ],
    };
  }
  const phase = state.phase;
  const completedInCycle = phase === 'long' ? 0 : state.completedInCycle;
  const entered = enterPhase(state, 'focus', config, now, config.autoStartFocus, completedInCycle);
  return { state: entered.state, effects: [{ type: 'breakCompleted', phase }, ...entered.effects] };
}

function start(state: TimerState, now: number): StepResult {
  const fresh = state.remainingMs >= state.durationMs;
  const next: TimerState = { ...state, status: 'running', endsAt: now + state.remainingMs };
  const effects: TimerEffect[] = [];
  if (fresh) effects.push(state.phase === 'focus' ? { type: 'focusStarted' } : { type: 'breakStarted', phase: state.phase });
  return { state: next, effects };
}

function pause(state: TimerState, now: number, config: TimerConfig): StepResult {
  const settled = settleAbsence(state, now, config);
  return {
    state: { ...settled.state, status: 'paused', remainingMs: remainingAt(state, now), endsAt: null },
    effects: settled.effects,
  };
}

export function step(state: TimerState, action: TimerAction, now: number, config: TimerConfig): StepResult {
  const unchanged: StepResult = { state, effects: [] };
  switch (action.type) {
    case 'start':
      return state.status === 'idle' ? start(state, now) : unchanged;
    case 'resume':
      return state.status === 'paused' ? { state: { ...state, status: 'running', endsAt: now + state.remainingMs }, effects: [] } : unchanged;
    case 'pause':
      return state.status === 'running' ? pause(state, now, config) : unchanged;
    case 'toggle':
      if (state.status === 'idle') return step(state, { type: 'start' }, now, config);
      if (state.status === 'running') return step(state, { type: 'pause' }, now, config);
      return step(state, { type: 'resume' }, now, config);
    case 'tick': {
      if (state.status !== 'running' || state.endsAt === null) return unchanged;
      if (now >= state.endsAt) return complete(state, config, state.endsAt);
      if (state.hiddenSince !== null && !state.ghostWoke && now - state.hiddenSince >= config.distractionGraceMs) {
        return { state: { ...state, ghostWoke: true }, effects: [{ type: 'ghostWoke' }] };
      }
      return unchanged;
    }
    case 'skip': {
      const abandoned: TimerEffect[] = focusInProgress(state) ? [{ type: 'focusAbandoned' }] : [];
      if (state.phase === 'focus') {
        const entered = enterPhase(state, 'short', config, now, false, state.completedInCycle);
        return { state: entered.state, effects: [...abandoned, ...entered.effects] };
      }
      const completedInCycle = state.phase === 'long' ? 0 : state.completedInCycle;
      return enterPhase(state, 'focus', config, now, false, completedInCycle);
    }
    case 'reset': {
      const abandoned: TimerEffect[] = focusInProgress(state) ? [{ type: 'focusAbandoned' }] : [];
      const durationMs = phaseDuration(state.phase, config);
      return {
        state: {
          ...state,
          status: 'idle',
          durationMs,
          remainingMs: durationMs,
          endsAt: null,
          distractions: 0,
          awayMs: 0,
          hiddenSince: null,
          ghostWoke: false,
        },
        effects: abandoned,
      };
    }
    case 'hidden':
      if (state.phase !== 'focus' || state.status !== 'running' || state.hiddenSince !== null) return unchanged;
      return { state: { ...state, hiddenSince: now, ghostWoke: false }, effects: [] };
    case 'visible':
      if (state.hiddenSince === null) return unchanged;
      return settleAbsence(state, now, config);
    case 'configure': {
      const { config: next } = action;
      if (state.status !== 'idle') return unchanged;
      const durationMs = phaseDuration(state.phase, next);
      if (durationMs === state.durationMs && state.remainingMs === durationMs) return unchanged;
      return { state: { ...state, durationMs, remainingMs: durationMs }, effects: [] };
    }
  }
}
