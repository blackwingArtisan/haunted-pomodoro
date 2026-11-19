import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/core/clock';
import {
  DEFAULT_TIMER_CONFIG,
  initialTimer,
  progressAt,
  remainingAt,
  step,
  type TimerAction,
  type TimerConfig,
  type TimerEffect,
  type TimerState,
} from '../../src/core/timer';

const config: TimerConfig = {
  ...DEFAULT_TIMER_CONFIG,
  focusMs: 10_000,
  shortMs: 3_000,
  longMs: 6_000,
  longEvery: 3,
  autoStartBreaks: true,
  autoStartFocus: false,
  distractionGraceMs: 2_000,
};

function harness(cfg: TimerConfig = config) {
  const clock = new ManualClock(1_000_000);
  let state: TimerState = initialTimer(cfg);
  const log: TimerEffect[] = [];
  const send = (action: TimerAction) => {
    const result = step(state, action, clock.now(), cfg);
    state = result.state;
    log.push(...result.effects);
    return result.effects;
  };
  const types = () => log.map((e) => e.type);
  return { clock, send, get state() { return state; }, log, types };
}

describe('timer state machine', () => {
  it('starts idle on a full focus session', () => {
    const t = harness();
    expect(t.state).toMatchObject({ phase: 'focus', status: 'idle', remainingMs: 10_000, endsAt: null });
  });

  it('counts down from an absolute end time', () => {
    const t = harness();
    expect(t.send({ type: 'start' })).toEqual([{ type: 'focusStarted' }]);
    t.clock.advance(4_000);
    expect(remainingAt(t.state, t.clock.now())).toBe(6_000);
    expect(progressAt(t.state, t.clock.now())).toBeCloseTo(0.4);
  });

  it('pauses and resumes without losing or gaining time', () => {
    const t = harness();
    t.send({ type: 'start' });
    t.clock.advance(3_000);
    t.send({ type: 'pause' });
    expect(t.state).toMatchObject({ status: 'paused', remainingMs: 7_000, endsAt: null });
    t.clock.advance(60_000);
    expect(remainingAt(t.state, t.clock.now())).toBe(7_000);
    t.send({ type: 'resume' });
    t.clock.advance(2_000);
    expect(remainingAt(t.state, t.clock.now())).toBe(5_000);
    // Resuming never re-fires focusStarted.
    expect(t.types().filter((x) => x === 'focusStarted')).toHaveLength(1);
  });

  it('toggle walks idle -> running -> paused -> running', () => {
    const t = harness();
    t.send({ type: 'toggle' });
    expect(t.state.status).toBe('running');
    t.send({ type: 'toggle' });
    expect(t.state.status).toBe('paused');
    t.send({ type: 'toggle' });
    expect(t.state.status).toBe('running');
  });

  it('finishes focus into an auto-started short break', () => {
    const t = harness();
    t.send({ type: 'start' });
    t.clock.advance(10_000);
    const effects = t.send({ type: 'tick' });
    expect(effects.map((e) => e.type)).toEqual(['focusCompleted', 'phaseChanged', 'breakStarted']);
    expect(t.state).toMatchObject({ phase: 'short', status: 'running', completedInCycle: 1 });
    // The break is timed from the moment focus ended, not from the late tick.
    expect(t.state.endsAt).toBe(1_000_000 + 10_000 + 3_000);
  });

  it('completes at the exact end time even when the tick is late', () => {
    const t = harness();
    t.send({ type: 'start' });
    t.clock.advance(11_500);
    t.send({ type: 'tick' });
    expect(remainingAt(t.state, t.clock.now())).toBe(1_500);
  });

  it('waits for the person after a break when focus auto-start is off', () => {
    const t = harness();
    t.send({ type: 'start' });
    t.clock.advance(10_000);
    t.send({ type: 'tick' });
    t.clock.advance(3_000);
    const effects = t.send({ type: 'tick' });
    expect(effects.map((e) => e.type)).toEqual(['breakCompleted', 'phaseChanged']);
    expect(t.state).toMatchObject({ phase: 'focus', status: 'idle', remainingMs: 10_000 });
  });

  it('takes a long break every longEvery sessions and then restarts the cycle', () => {
    const t = harness();
    const phases: string[] = [];
    for (let i = 0; i < 3; i++) {
      t.send({ type: 'start' });
      t.clock.advance(10_000);
      t.send({ type: 'tick' });
      phases.push(t.state.phase);
      t.clock.advance(t.state.durationMs);
      t.send({ type: 'tick' });
    }
    expect(phases).toEqual(['short', 'short', 'long']);
    expect(t.state.completedInCycle).toBe(0);
    expect(t.log.filter((e) => e.type === 'breakCompleted').map((e) => (e as { phase: string }).phase)).toEqual(['short', 'short', 'long']);
  });

  it('skipping focus moves to a break without lighting a candle or advancing the cycle', () => {
    const t = harness();
    t.send({ type: 'start' });
    t.clock.advance(2_000);
    const effects = t.send({ type: 'skip' });
    expect(effects.map((e) => e.type)).toEqual(['focusAbandoned', 'phaseChanged']);
    expect(t.state).toMatchObject({ phase: 'short', status: 'idle', completedInCycle: 0 });
    expect(t.types()).not.toContain('focusCompleted');
  });

  it('skipping a break returns to focus; skipping a long break resets the cycle', () => {
    const t = harness({ ...config, longEvery: 1 });
    t.send({ type: 'start' });
    t.clock.advance(10_000);
    t.send({ type: 'tick' });
    expect(t.state.phase).toBe('long');
    expect(t.state.completedInCycle).toBe(1);
    t.send({ type: 'skip' });
    expect(t.state).toMatchObject({ phase: 'focus', status: 'idle', completedInCycle: 0 });
  });

  it('skipping an idle focus session does not report an abandoned candle', () => {
    const t = harness();
    expect(t.send({ type: 'skip' }).map((e) => e.type)).toEqual(['phaseChanged']);
  });

  it('reset restores the full phase and snuffs an in-progress candle', () => {
    const t = harness();
    t.send({ type: 'start' });
    t.clock.advance(5_000);
    expect(t.send({ type: 'reset' })).toEqual([{ type: 'focusAbandoned' }]);
    expect(t.state).toMatchObject({ status: 'idle', remainingMs: 10_000, distractions: 0 });
  });

  describe('distractions', () => {
    it('counts an absence longer than the grace period when the person returns', () => {
      const t = harness();
      t.send({ type: 'start' });
      t.send({ type: 'hidden' });
      t.clock.advance(5_000);
      const effects = t.send({ type: 'visible' });
      expect(effects).toEqual([{ type: 'distracted', count: 1, awayMs: 5_000 }]);
      expect(t.state).toMatchObject({ distractions: 1, awayMs: 5_000, hiddenSince: null });
    });

    it('forgives a glance away shorter than the grace period', () => {
      const t = harness();
      t.send({ type: 'start' });
      t.send({ type: 'hidden' });
      t.clock.advance(1_500);
      expect(t.send({ type: 'visible' })).toEqual([]);
      expect(t.state.distractions).toBe(0);
    });

    it('wakes the ghost once per absence while the tab is still hidden', () => {
      const t = harness();
      t.send({ type: 'start' });
      t.send({ type: 'hidden' });
      t.clock.advance(1_000);
      expect(t.send({ type: 'tick' })).toEqual([]);
      t.clock.advance(1_500);
      expect(t.send({ type: 'tick' })).toEqual([{ type: 'ghostWoke' }]);
      t.clock.advance(500);
      expect(t.send({ type: 'tick' })).toEqual([]);
    });

    it('counts each separate absence', () => {
      const t = harness();
      t.send({ type: 'start' });
      for (let i = 0; i < 3; i++) {
        t.send({ type: 'hidden' });
        t.clock.advance(2_000);
        t.send({ type: 'visible' });
      }
      expect(t.state.distractions).toBe(3);
    });

    it('ignores hiding during breaks and while paused', () => {
      const t = harness();
      t.send({ type: 'hidden' });
      expect(t.state.hiddenSince).toBeNull();
      t.send({ type: 'start' });
      t.send({ type: 'pause' });
      t.send({ type: 'hidden' });
      expect(t.state.hiddenSince).toBeNull();
    });

    it('settles an absence that is still open when focus ends and reports it with the session', () => {
      const t = harness();
      t.send({ type: 'start' });
      t.clock.advance(4_000);
      t.send({ type: 'hidden' });
      t.clock.advance(30_000);
      const effects = t.send({ type: 'tick' });
      expect(effects[0]).toEqual({ type: 'distracted', count: 1, awayMs: 6_000 });
      expect(effects[1]).toEqual({ type: 'focusCompleted', durationMs: 10_000, distractions: 1, awayMs: 6_000 });
      expect(t.state.distractions).toBe(0);
    });

    it('a fresh focus session starts with no distractions', () => {
      const t = harness();
      t.send({ type: 'start' });
      t.send({ type: 'hidden' });
      t.clock.advance(3_000);
      t.send({ type: 'visible' });
      t.send({ type: 'reset' });
      expect(t.state.distractions).toBe(0);
    });
  });

  it('applies new lengths only while idle', () => {
    const t = harness();
    const longer = { ...config, focusMs: 20_000 };
    let r = step(t.state, { type: 'configure', config: longer }, t.clock.now(), longer);
    expect(r.state.remainingMs).toBe(20_000);
    t.send({ type: 'start' });
    r = step(t.state, { type: 'configure', config: longer }, t.clock.now(), longer);
    expect(r.state).toBe(t.state);
  });
});
