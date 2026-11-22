/**
 * Which picture the tab's icon shows. A pure function of the timer, the time, the page's visibility
 * and the motion preference: the clock is passed in, nothing is read from the environment.
 */
import { progressAt, type TimerState } from './timer';

/** A focus session is cut into this many wax steps; a page load never draws more than WAX_STEPS + 4 images. */
export const WAX_STEPS = 24;

export type FaviconFrame =
  | { kind: 'idle' } // the app's static icon
  | { kind: 'candle'; step: number } // 0 (full wax) to WAX_STEPS - 1
  | { kind: 'ghost'; face: 0 | 1 } // the ghost's face while the person is away
  | { kind: 'break' }; // still candle, ghost-green flame

export interface FaviconInput {
  timer: TimerState;
  now: number;
  hidden: boolean;
  reducedMotion: boolean;
}

export function waxStep(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.min(WAX_STEPS - 1, Math.floor(p * WAX_STEPS));
}

export function faviconFrame(i: FaviconInput): FaviconFrame {
  const { timer, now } = i;
  if (timer.status === 'idle') return { kind: 'idle' };
  if (timer.phase !== 'focus') return { kind: 'break' };
  if (timer.status === 'running' && i.hidden) {
    return { kind: 'ghost', face: i.reducedMotion ? 0 : ((Math.floor(now / 1000) % 2) as 0 | 1) };
  }
  return { kind: 'candle', step: waxStep(progressAt(timer, now)) };
}

export const frameKey = (f: FaviconFrame): string =>
  f.kind === 'candle' ? `candle-${f.step}` : f.kind === 'ghost' ? `ghost-${f.face}` : f.kind;
