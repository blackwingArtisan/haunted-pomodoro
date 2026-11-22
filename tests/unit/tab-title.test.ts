import { describe, expect, it } from 'vitest';
import { formatClock as panelsFormatClock } from '../../src/ui/panels';
import { formatClock, tabTitle } from '../../src/core/tab-title';
import { DEFAULT_TIMER_CONFIG, initialTimer, step, type TimerAction, type TimerState } from '../../src/core/timer';

const CONFIG = DEFAULT_TIMER_CONFIG;
const T0 = 1_700_000_000_000;
const MIN = 60_000;

const run = (state: TimerState, action: TimerAction, now: number) => step(state, action, now, CONFIG).state;
const running = () => run(initialTimer(CONFIG), { type: 'start' }, T0);
const title = (timer: TimerState, now: number, hidden = false) => tabTitle({ timer, now, hidden });

describe('formatClock', () => {
  it('rounds up to the next second and pads', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(25 * MIN)).toBe('25:00');
  });

  it('is still exported by the panels module', () => {
    expect(panelsFormatClock).toBe(formatClock);
  });
});

describe('tab title', () => {
  // Req ghost-follows-you:3.1, 3.5
  it('shows the time left, the phase and the app name while running, from the absolute end time', () => {
    const t = running();
    expect(title(t, T0)).toBe('25:00 · Focus · Haunted Pomodoro');
    expect(title(t, T0 + 5 * MIN + 1001)).toBe('19:59 · Focus · Haunted Pomodoro');
    const brk = run(t, { type: 'tick' }, T0 + CONFIG.focusMs);
    expect(title(brk, T0 + CONFIG.focusMs)).toBe(`${formatClock(CONFIG.shortMs)} · Short break · Haunted Pomodoro`);
  });

  // Req ghost-follows-you:3.1
  it('keeps the time while paused', () => {
    const paused = run(running(), { type: 'pause' }, T0 + 10 * MIN);
    expect(title(paused, T0 + 99 * MIN)).toBe('15:00 · Focus · Haunted Pomodoro');
  });

  // Req ghost-follows-you:3.2
  it('is only the app name while idle', () => {
    expect(title(initialTimer(CONFIG), T0)).toBe('Haunted Pomodoro');
    expect(title(initialTimer(CONFIG), T0, true)).toBe('Haunted Pomodoro');
  });

  // Req ghost-follows-you:3.3, 3.4
  it('calls the person back only while hidden with the ghost awake, and shows the timer title on return', () => {
    const awake: TimerState = { ...running(), ghostWoke: true };
    expect(title(awake, T0 + 5 * MIN, true)).toBe('Come back… 20:00 left · Haunted Pomodoro');
    expect(title(awake, T0 + 5 * MIN, false)).toBe('20:00 · Focus · Haunted Pomodoro');
    const asleep = running();
    expect(title(asleep, T0 + 5 * MIN, true)).toBe('20:00 · Focus · Haunted Pomodoro');
    const pausedAwake: TimerState = { ...awake, status: 'paused', endsAt: null, remainingMs: 20 * MIN };
    expect(title(pausedAwake, T0, true)).toBe('20:00 · Focus · Haunted Pomodoro');
  });

  // Req ghost-follows-you:3.6, 11.2
  it('never carries a count, a streak or a word of blame', () => {
    const t: TimerState = { ...running(), ghostWoke: true, distractions: 7, awayMs: 9 * MIN };
    for (const hidden of [true, false]) {
      const text = title(t, T0 + 3 * MIN, hidden);
      expect(text.replace(/\d{2}:\d{2}/, '')).not.toMatch(/\d/);
      expect(text).not.toMatch(/\b(streak|wander\w*|away|lost|fail\w*|late)\b/i);
    }
  });
});
