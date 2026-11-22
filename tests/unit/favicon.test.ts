import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/core/clock';
import { WAX_STEPS, faviconFrame, frameKey, waxStep, type FaviconFrame } from '../../src/core/favicon';
import { DEFAULT_TIMER_CONFIG, initialTimer, step, type TimerAction, type TimerState } from '../../src/core/timer';

const CONFIG = DEFAULT_TIMER_CONFIG;
const FOCUS = CONFIG.focusMs;
const T0 = 1_700_000_000_000;

function run(state: TimerState, action: TimerAction, now: number): TimerState {
  return step(state, action, now, CONFIG).state;
}

/** A focus session started at T0. */
const running = () => run(initialTimer(CONFIG), { type: 'start' }, T0);

const frame = (timer: TimerState, now: number, hidden = false, reducedMotion = false) => faviconFrame({ timer, now, hidden, reducedMotion });

/** The focus session ran to its end, so the short break has started and is running. */
const breakRunning = () => run(running(), { type: 'tick' }, T0 + FOCUS);

/** Small seeded generator (mulberry32) so a failure replays from its seed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('wax steps', () => {
  // Req ghost-follows-you:1.1, 1.2
  it('cut progress into 24 steps with boundaries at 0, 1/24, 23/24 and 1', () => {
    expect(WAX_STEPS).toBe(24);
    expect(waxStep(0)).toBe(0);
    expect(waxStep(1 / 24 - 1e-9)).toBe(0);
    expect(waxStep(1 / 24)).toBe(1);
    expect(waxStep(23 / 24 - 1e-9)).toBe(22);
    expect(waxStep(23 / 24)).toBe(23);
    expect(waxStep(1)).toBe(23);
    expect(waxStep(-1)).toBe(0);
    expect(waxStep(5)).toBe(23);
  });
});

describe('favicon frames', () => {
  // Req ghost-follows-you:1.4
  it('is the static icon while the timer is idle', () => {
    expect(frame(initialTimer(CONFIG), T0)).toEqual({ kind: 'idle' });
    expect(frame(initialTimer(CONFIG), T0, true)).toEqual({ kind: 'idle' });
  });

  // Req ghost-follows-you:1.1, 1.2
  it('is a candle whose step follows the running session', () => {
    const t = running();
    expect(frame(t, T0)).toEqual({ kind: 'candle', step: 0 });
    expect(frame(t, T0 + FOCUS / 24 - 1)).toEqual({ kind: 'candle', step: 0 });
    expect(frame(t, T0 + FOCUS / 24 + 1)).toEqual({ kind: 'candle', step: 1 });
    expect(frame(t, T0 + FOCUS / 2)).toEqual({ kind: 'candle', step: 12 });
    expect(frame(t, T0 + FOCUS - 1)).toEqual({ kind: 'candle', step: 23 });
  });

  // Req ghost-follows-you:1.3
  it('keeps the candle at its step while paused, however long the pause', () => {
    const paused = run(running(), { type: 'pause' }, T0 + FOCUS / 2);
    expect(paused.status).toBe('paused');
    expect(frame(paused, T0 + FOCUS / 2)).toEqual({ kind: 'candle', step: 12 });
    expect(frame(paused, T0 + FOCUS * 5)).toEqual({ kind: 'candle', step: 12 });
  });

  // Req ghost-follows-you:1.5
  it('is the break frame during a short or long break, running or paused', () => {
    const brk = breakRunning();
    expect(brk.phase).not.toBe('focus');
    expect(brk.status).toBe('running');
    expect(frame(brk, T0 + FOCUS + 1000)).toEqual({ kind: 'break' });
    const pausedBreak = run(brk, { type: 'pause' }, T0 + FOCUS + 2000);
    expect(frame(pausedBreak, T0 + FOCUS + 3000)).toEqual({ kind: 'break' });
  });

  // Req ghost-follows-you:1.6, 2.7
  it('shows the frame for the new state when a phase is skipped or reset', () => {
    const t = running();
    expect(frame(t, T0 + 1000, true).kind).toBe('ghost');
    expect(frame(run(t, { type: 'tick' }, T0 + FOCUS), T0 + FOCUS, true)).toEqual({ kind: 'break' });
    expect(frame(run(t, { type: 'skip' }, T0 + 1000), T0 + 1000, true)).toEqual({ kind: 'idle' });
    expect(frame(run(t, { type: 'reset' }, T0 + 1000), T0 + 1000, true)).toEqual({ kind: 'idle' });
  });

  // Req ghost-follows-you:2.1, 2.2, 2.3
  it('is the ghost while hidden during a running focus session and the candle again on return', () => {
    const t = running();
    expect(frame(t, T0 + 10_000, true).kind).toBe('ghost');
    expect(frame(t, T0 + 10_000, false)).toEqual({ kind: 'candle', step: waxStep(10_000 / FOCUS) });
  });

  // Req ghost-follows-you:2.4
  it('is not the ghost while paused or in a break, even when hidden', () => {
    const paused = run(running(), { type: 'pause' }, T0 + 5000);
    expect(frame(paused, T0 + 6000, true).kind).toBe('candle');
    const brk = breakRunning();
    expect(frame(brk, T0 + FOCUS + 1000, true)).toEqual({ kind: 'break' });
  });

  // Req ghost-follows-you:2.5
  it('alternates the ghost’s face once per second', () => {
    const t = running();
    const faces = [0, 1, 2, 3, 4, 5].map((s) => (frame(t, 1_700_000_100_000 + s * 1000, true) as { face: number }).face);
    expect(faces[0]).not.toBe(faces[1]);
    expect(faces).toEqual([faces[0], faces[1], faces[0], faces[1], faces[0], faces[1]]);
    // Within one second the face does not change.
    expect(frame(t, 1_700_000_100_000, true)).toEqual(frame(t, 1_700_000_100_999, true));
  });

  // Req ghost-follows-you:9.1, 9.2
  it('fixes the face at 0 under reduced motion while the wax still steps', () => {
    const t = running();
    for (let s = 0; s < 6; s++) expect(frame(t, T0 + s * 1000, true, true)).toEqual({ kind: 'ghost', face: 0 });
    expect(frame(t, T0, false, true)).toEqual({ kind: 'candle', step: 0 });
    expect(frame(t, T0 + FOCUS / 2, false, true)).toEqual({ kind: 'candle', step: 12 });
  });

  // Req ghost-follows-you:1.7, 2.7
  it('returns the true step after a long gap between updates', () => {
    const clock = new ManualClock(T0);
    const t = running();
    expect(frame(t, clock.now())).toEqual({ kind: 'candle', step: 0 });
    clock.advance(FOCUS * 0.8);
    expect(frame(t, clock.now())).toEqual({ kind: 'candle', step: waxStep(0.8) });
    clock.advance(FOCUS);
    expect(frame(t, clock.now())).toEqual({ kind: 'candle', step: 23 });
  });

  // Req ghost-follows-you:13.1, 13.4
  it('gives each frame a key, equal for equal frames', () => {
    const frames: FaviconFrame[] = [{ kind: 'idle' }, { kind: 'break' }, { kind: 'candle', step: 3 }, { kind: 'ghost', face: 1 }];
    expect(frames.map(frameKey)).toEqual(['idle', 'break', 'candle-3', 'ghost-1']);
    expect(frameKey({ kind: 'candle', step: 3 })).toBe(frameKey({ kind: 'candle', step: 3 }));
    expect(frameKey({ kind: 'candle', step: 3 })).not.toBe(frameKey({ kind: 'candle', step: 4 }));
  });
});

describe('favicon properties', () => {
  // Req ghost-follows-you:1.2, 2.1, 2.4, 13.1
  it('the wax never decreases, stays within 0 to 23, and a ghost appears exactly when running and hidden', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const next = rng(seed);
      const t = running();
      let now = T0;
      let last = -1;
      for (let i = 0; i < 200; i++) {
        now += Math.floor(next() * FOCUS * 0.02);
        const hidden = next() < 0.5;
        const reduced = next() < 0.5;
        const f = frame(t, now, hidden, reduced);
        expect(f.kind, `seed ${seed}`).toBe(hidden ? 'ghost' : 'candle');
        const visible = frame(t, now, false, reduced);
        if (visible.kind !== 'candle') throw new Error('expected a candle');
        expect(visible.step).toBeGreaterThanOrEqual(0);
        expect(visible.step).toBeLessThanOrEqual(23);
        expect(visible.step, `seed ${seed}`).toBeGreaterThanOrEqual(last);
        last = visible.step;
      }
      // The same inputs give the same frame.
      expect(frame(t, now, true)).toEqual(frame(t, now, true));
      // A paused session never shows the ghost.
      const paused = run(t, { type: 'pause' }, now >= T0 + FOCUS ? T0 + FOCUS - 1 : now);
      expect(frame(paused, now, true).kind).not.toBe('ghost');
    }
  });
});
