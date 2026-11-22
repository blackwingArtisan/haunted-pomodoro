/**
 * The follow window's state machine and what the window shows. Pure: the clock is passed in, and
 * the only outputs are `request`, `close` and `announce`. Nothing here imports the app model or can
 * name an action that changes it, so opening, fading, closing or failing to open the window can
 * never touch a candle, a wandering or the streak.
 */
import { followLine } from './story';
import { formatClock } from './tab-title';
import { remainingAt, type TimerState } from './timer';

export type FollowStatus = 'off' | 'ready' | 'opening' | 'resting' | 'floating' | 'dismissed' | 'unavailable';

export interface FollowState {
  status: FollowStatus;
  /** Whether the page is hidden. Remembered in every status, so a window that opens late shows the right opacity. */
  hidden: boolean;
  /** Setting on and the browser supports the API. */
  enabled: boolean;
  /** Time of the start gesture that is waiting for its window, else null. Identifies a request, so a late answer for an old one is recognised. */
  requestedAt: number | null;
}

export type FollowEvent =
  | { type: 'config'; on: boolean; supported: boolean }
  | { type: 'start' } // the person started a focus session with a gesture
  | { type: 'opened'; requestedAt: number }
  | { type: 'rejected'; requestedAt: number }
  | { type: 'closed' } // closed by the person or the browser
  | { type: 'hidden' }
  | { type: 'visible' }
  | { type: 'sessionEnded' }; // finished, skipped or reset

export type FollowNote = 'opened' | 'closed' | 'failed';

export type FollowEffect =
  | { type: 'request'; requestedAt: number } // call pip.open now, inside the gesture
  | { type: 'close' } // call pip.close
  | { type: 'announce'; note: FollowNote };

export interface FollowStep {
  state: FollowState;
  effects: FollowEffect[];
}

export function initialFollow(hidden: boolean): FollowState {
  return { status: 'off', hidden, enabled: false, requestedAt: null };
}

const NONE: FollowEffect[] = [];
const stay = (state: FollowState): FollowStep => ({ state, effects: NONE });
const windowIsOpenOrOpening = (s: FollowStatus) => s === 'opening' || s === 'resting' || s === 'floating';

/** The next state and the effects to run. A no-op returns the same state object. */
export function stepFollow(state: FollowState, event: FollowEvent, now: number): FollowStep {
  switch (event.type) {
    case 'config': {
      const enabled = event.on && event.supported;
      if (!enabled) {
        if (state.status === 'off' && !state.enabled) return stay(state);
        return {
          state: { ...state, status: 'off', enabled: false, requestedAt: null },
          effects: windowIsOpenOrOpening(state.status) ? [{ type: 'close' }] : NONE,
        };
      }
      if (state.status === 'off') return stay({ ...state, status: 'ready', enabled: true });
      return state.enabled ? stay(state) : stay({ ...state, enabled: true });
    }
    case 'start': {
      if (!state.enabled) return stay(state);
      if (state.status === 'ready' || state.status === 'dismissed' || state.status === 'unavailable') {
        return { state: { ...state, status: 'opening', requestedAt: now }, effects: [{ type: 'request', requestedAt: now }] };
      }
      return stay(state);
    }
    case 'opened': {
      if (state.status === 'opening' && state.requestedAt === event.requestedAt) {
        return {
          state: { ...state, status: state.hidden ? 'floating' : 'resting', requestedAt: null },
          effects: [{ type: 'announce', note: 'opened' }],
        };
      }
      return { state, effects: [{ type: 'close' }] };
    }
    case 'rejected': {
      if (state.status === 'opening' && state.requestedAt === event.requestedAt) {
        return { state: { ...state, status: 'unavailable', requestedAt: null }, effects: [{ type: 'announce', note: 'failed' }] };
      }
      return stay(state);
    }
    case 'closed': {
      if (state.status === 'resting' || state.status === 'floating') {
        return { state: { ...state, status: 'dismissed' }, effects: [{ type: 'announce', note: 'closed' }] };
      }
      return stay(state);
    }
    case 'hidden': {
      if (state.hidden && state.status !== 'resting') return stay(state);
      return stay({ ...state, hidden: true, status: state.status === 'resting' ? 'floating' : state.status });
    }
    case 'visible': {
      if (!state.hidden && state.status !== 'floating') return stay(state);
      return stay({ ...state, hidden: false, status: state.status === 'floating' ? 'resting' : state.status });
    }
    case 'sessionEnded': {
      const s = state.status;
      if (s === 'resting' || s === 'floating' || s === 'opening' || s === 'dismissed' || s === 'unavailable') {
        return {
          state: { ...state, status: 'ready', requestedAt: null },
          effects: s === 'resting' || s === 'floating' ? [{ type: 'close' }] : NONE,
        };
      }
      return stay(state);
    }
  }
}

/* ------------------------------------------------------------------ What the window shows */

/** A size hint only: the browser may clamp or ignore it. */
export const PIP_SIZE = { width: 280, height: 200 } as const;
export const FADED_OPACITY = 0.25;
export const FADE_MS = 600;

export interface PipView {
  /** 'mm:ss', from the absolute end time. */
  timeLeft: string;
  /** 'Focus', 'Short break' or 'Long break'. */
  phaseLabel: string;
  /** Shows the word "Paused". */
  paused: boolean;
  /** From FOLLOW_LINES. */
  line: string;
  /** 1 while floating, FADED_OPACITY otherwise. Applies to the ghost's picture only. */
  ghostOpacity: number;
  /** FADE_MS, or 0 under reduced motion. */
  fadeMs: number;
  /** Reduced motion: no bobbing. */
  still: boolean;
}

const PHASE_NAME = { focus: 'Focus', short: 'Short break', long: 'Long break' } as const;

export function pipView(i: { timer: TimerState; now: number; follow: FollowState; reducedMotion: boolean }): PipView {
  const left = remainingAt(i.timer, i.now);
  return {
    timeLeft: formatClock(left),
    phaseLabel: PHASE_NAME[i.timer.phase],
    paused: i.timer.status === 'paused',
    line: followLine(left),
    ghostOpacity: i.follow.status === 'floating' ? 1 : FADED_OPACITY,
    fadeMs: i.reducedMotion ? 0 : FADE_MS,
    still: i.reducedMotion,
  };
}

export function sameView(a: PipView, b: PipView): boolean {
  return (
    a.timeLeft === b.timeLeft &&
    a.phaseLabel === b.phaseLabel &&
    a.paused === b.paused &&
    a.line === b.line &&
    a.ghostOpacity === b.ghostOpacity &&
    a.fadeMs === b.fadeMs &&
    a.still === b.still
  );
}
