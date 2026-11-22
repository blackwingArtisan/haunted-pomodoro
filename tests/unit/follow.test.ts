import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FADED_OPACITY,
  FADE_MS,
  PIP_SIZE,
  initialFollow,
  pipView,
  sameView,
  stepFollow,
  type FollowEffect,
  type FollowEvent,
  type FollowState,
  type FollowStatus,
} from '../../src/core/follow';
import { FOLLOW_LINES } from '../../src/core/story';
import { DEFAULT_TIMER_CONFIG, initialTimer, step, type TimerAction, type TimerState } from '../../src/core/timer';

const NOW = 1_700_000_000_000;
const MIN = 60_000;

const ON: FollowEvent = { type: 'config', on: true, supported: true };

/** Applies events in order, collecting every effect. */
function drive(state: FollowState, events: FollowEvent[], now = NOW) {
  const effects: FollowEffect[] = [];
  let s = state;
  for (const e of events) {
    const r = stepFollow(s, e, now);
    s = r.state;
    effects.push(...r.effects);
  }
  return { state: s, effects };
}

/** A state in the given status, reached by real events. */
function at(status: FollowStatus, hidden = false, requestedAt = NOW): FollowState {
  const base = initialFollow(hidden);
  const ready = drive(base, [ON]).state;
  switch (status) {
    case 'off':
      return base;
    case 'ready':
      return ready;
    case 'opening':
      return drive(ready, [{ type: 'start' }], requestedAt).state;
    case 'resting':
    case 'floating': {
      const opened = drive(drive(ready, [{ type: 'start' }], requestedAt).state, [{ type: 'opened', requestedAt }]).state;
      return status === 'floating' ? drive(opened, [{ type: 'hidden' }]).state : opened;
    }
    case 'dismissed':
      return drive(at('resting', hidden, requestedAt), [{ type: 'closed' }]).state;
    case 'unavailable':
      return drive(at('opening', hidden, requestedAt), [{ type: 'rejected', requestedAt }]).state;
  }
}

describe('follow state machine', () => {
  // Req ghost-follows-you:4.2, 4.6
  it('starts off, becomes ready when enabled and supported, and never requests on config', () => {
    const s0 = initialFollow(false);
    expect(s0).toEqual({ status: 'off', hidden: false, enabled: false, requestedAt: null });
    const on = stepFollow(s0, ON, NOW);
    expect(on.state.status).toBe('ready');
    expect(on.effects).toEqual([]);
    expect(stepFollow(s0, { type: 'config', on: true, supported: false }, NOW).state).toBe(s0);
    expect(stepFollow(s0, { type: 'config', on: false, supported: true }, NOW).state).toBe(s0);
    // While the setting is off a start gesture requests nothing.
    expect(stepFollow(s0, { type: 'start' }, NOW)).toEqual({ state: s0, effects: [] });
  });

  // Req ghost-follows-you:5.4, 5.5
  it('requests exactly once for a start gesture, and only from a start event', () => {
    const r = stepFollow(at('ready'), { type: 'start' }, NOW + 5);
    expect(r.state).toMatchObject({ status: 'opening', requestedAt: NOW + 5 });
    expect(r.effects).toEqual([{ type: 'request', requestedAt: NOW + 5 }]);
    for (const e of [ON, { type: 'hidden' }, { type: 'visible' }, { type: 'sessionEnded' }] as FollowEvent[]) {
      expect(stepFollow(at('ready'), e, NOW).effects.some((x) => x.type === 'request')).toBe(false);
    }
  });

  // Req ghost-follows-you:5.8
  it('changes nothing when a start arrives while a window is open or opening', () => {
    for (const status of ['opening', 'resting', 'floating'] as const) {
      const s = at(status);
      const r = stepFollow(s, { type: 'start' }, NOW + 1);
      expect(r.state).toBe(s);
      expect(r.effects).toEqual([]);
    }
  });

  // Req ghost-follows-you:5.2, 5.3, 6.3, 6.4
  it('opens resting when the page is visible and floating when it is hidden, and announces it', () => {
    const visible = stepFollow(at('opening', false), { type: 'opened', requestedAt: NOW }, NOW);
    expect(visible.state.status).toBe('resting');
    expect(visible.effects).toEqual([{ type: 'announce', note: 'opened' }]);
    const hidden = stepFollow(at('opening', true), { type: 'opened', requestedAt: NOW }, NOW);
    expect(hidden.state.status).toBe('floating');
    // Hidden then visible moves between the two while the window stays open.
    expect(drive(at('resting'), [{ type: 'hidden' }]).state.status).toBe('floating');
    expect(drive(at('floating'), [{ type: 'visible' }]).state.status).toBe('resting');
  });

  // Req ghost-follows-you:8.3, 8.6, 8.7
  it('closes a late or stale opened answer', () => {
    for (const status of ['off', 'ready', 'dismissed', 'unavailable', 'resting', 'floating'] as const) {
      const s = at(status);
      const r = stepFollow(s, { type: 'opened', requestedAt: NOW }, NOW);
      expect(r.state, status).toBe(s);
      expect(r.effects, status).toEqual([{ type: 'close' }]);
    }
    const stale = stepFollow(at('opening', false, NOW + 10), { type: 'opened', requestedAt: NOW }, NOW + 10);
    expect(stale.effects).toEqual([{ type: 'close' }]);
    expect(stale.state.status).toBe('opening');
  });

  // Req ghost-follows-you:8.1, 8.2, 8.3
  it('marks the window unavailable on a rejection, says so once and ignores a stale rejection', () => {
    const r = stepFollow(at('opening'), { type: 'rejected', requestedAt: NOW }, NOW);
    expect(r.state.status).toBe('unavailable');
    expect(r.effects).toEqual([{ type: 'announce', note: 'failed' }]);
    const open = at('opening', false, NOW + 1);
    expect(stepFollow(open, { type: 'rejected', requestedAt: NOW }, NOW)).toEqual({ state: open, effects: [] });
    const un = at('unavailable');
    expect(stepFollow(un, { type: 'rejected', requestedAt: NOW }, NOW).state).toBe(un);
    // No retry until the next start gesture.
    expect(drive(un, [{ type: 'visible' }, { type: 'hidden' }, ON]).effects).toEqual([]);
    expect(stepFollow(un, { type: 'start' }, NOW + 9).effects).toEqual([{ type: 'request', requestedAt: NOW + 9 }]);
  });

  // Req ghost-follows-you:7.4, 7.5, 7.6
  it('leads a close to dismissed, with no new request until the next start', () => {
    for (const status of ['resting', 'floating'] as const) {
      const r = stepFollow(at(status), { type: 'closed' }, NOW);
      expect(r.state.status).toBe('dismissed');
      expect(r.state.enabled).toBe(true);
      expect(r.effects).toEqual([]);
    }
    const d = at('dismissed');
    const quiet = drive(d, [{ type: 'hidden' }, { type: 'visible' }, ON, { type: 'closed' }]);
    expect(quiet.effects).toEqual([]);
    expect(quiet.state.status).toBe('dismissed');
    const next = stepFollow(d, { type: 'start' }, NOW + 1);
    expect(next.state.status).toBe('opening');
    expect(next.effects).toEqual([{ type: 'request', requestedAt: NOW + 1 }]);
  });

  // Req ghost-follows-you:7.7, 8.6
  it('returns to ready when the session ends, closing a window that is open', () => {
    for (const status of ['resting', 'floating'] as const) {
      const r = stepFollow(at(status), { type: 'sessionEnded' }, NOW);
      expect(r.state).toMatchObject({ status: 'ready', requestedAt: null });
      expect(r.effects).toEqual([{ type: 'close' }]);
    }
    for (const status of ['opening', 'dismissed', 'unavailable'] as const) {
      const r = stepFollow(at(status), { type: 'sessionEnded' }, NOW);
      expect(r.state.status, status).toBe('ready');
      expect(r.effects, status).toEqual([]);
    }
    // The answer that arrives after the session ended is closed.
    const afterReset = drive(at('opening'), [{ type: 'sessionEnded' }, { type: 'opened', requestedAt: NOW }]);
    expect(afterReset.state.status).toBe('ready');
    expect(afterReset.effects).toEqual([{ type: 'close' }]);
  });

  // Req ghost-follows-you:4.3, 8.7
  it('closes when the setting is turned off or support goes, and a late answer is closed too', () => {
    for (const status of ['opening', 'resting', 'floating'] as const) {
      const r = stepFollow(at(status), { type: 'config', on: false, supported: true }, NOW);
      expect(r.state).toMatchObject({ status: 'off', enabled: false, requestedAt: null });
      expect(r.effects).toEqual([{ type: 'close' }]);
    }
    for (const status of ['ready', 'dismissed', 'unavailable'] as const) {
      const r = stepFollow(at(status), { type: 'config', on: true, supported: false }, NOW);
      expect(r.state.status).toBe('off');
      expect(r.effects).toEqual([]);
    }
    const late = drive(at('opening'), [{ type: 'config', on: false, supported: true }, { type: 'opened', requestedAt: NOW }]);
    expect(late.effects).toEqual([{ type: 'close' }, { type: 'close' }]);
    expect(late.state.status).toBe('off');
  });

  // Req ghost-follows-you:13.2
  it('returns the same object for every event that changes nothing', () => {
    const cases: Array<[FollowStatus, FollowEvent]> = [
      ['off', { type: 'visible' }],
      ['ready', { type: 'visible' }],
      ['ready', ON],
      ['ready', { type: 'closed' }],
      ['ready', { type: 'sessionEnded' }],
      ['resting', { type: 'visible' }],
      ['floating', { type: 'hidden' }],
      ['opening', { type: 'closed' }],
      ['dismissed', { type: 'closed' }],
      ['unavailable', { type: 'closed' }],
    ];
    for (const [status, event] of cases) {
      const hiddenState = status === 'floating';
      const s = at(status, hiddenState);
      const r = stepFollow(s, event, NOW + 123);
      expect(r.state, `${status} ${event.type}`).toBe(s);
      expect(r.effects, `${status} ${event.type}`).toEqual([]);
    }
  });

  // Req ghost-follows-you:5.3, 6.3
  it('remembers the page’s visibility in every status', () => {
    for (const status of ['off', 'ready', 'opening', 'dismissed', 'unavailable'] as const) {
      const s = at(status);
      expect(stepFollow(s, { type: 'hidden' }, NOW).state.hidden).toBe(true);
      expect(stepFollow(at(status, true), { type: 'visible' }, NOW).state.hidden).toBe(false);
    }
  });
});

describe('follow sources', () => {
  // Req ghost-follows-you:13.2, 13.3
  it('favicon.ts, tab-title.ts and follow.ts read no clock and no random number', () => {
    for (const file of ['favicon.ts', 'tab-title.ts', 'follow.ts']) {
      const source = readFileSync(new URL(`../../src/core/${file}`, import.meta.url), 'utf8');
      expect(source, file).not.toMatch(/Date\.now\(|new Date\(|Math\.random\(/);
    }
  });

  // Req ghost-follows-you:11.1
  it('follow.ts does not import the app model', () => {
    const source = readFileSync(new URL('../../src/core/follow.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from '\.\/model'/);
  });
});

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

describe('follow properties', () => {
  // Req ghost-follows-you:7.4, 11.1
  it('a dismissed state never becomes opening without a start, and only request, close or announce come out', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const next = rng(seed);
      let s = initialFollow(false);
      let t = NOW;
      for (let i = 0; i < 300; i++) {
        t += 1000;
        const pick = Math.floor(next() * 11);
        const requestedAt = next() < 0.5 && s.requestedAt !== null ? s.requestedAt : t - 2000;
        const event: FollowEvent = [
          ON,
          { type: 'config', on: false, supported: true },
          { type: 'config', on: true, supported: false },
          { type: 'start' },
          { type: 'start' },
          { type: 'opened', requestedAt },
          { type: 'rejected', requestedAt },
          { type: 'closed' },
          { type: 'hidden' },
          { type: 'visible' },
          { type: 'sessionEnded' },
        ][pick] as FollowEvent;
        const r = stepFollow(s, event, t);
        for (const e of r.effects) expect(['request', 'close', 'announce'], `seed ${seed}`).toContain(e.type);
        if (s.status === 'dismissed' && r.state.status === 'opening') expect(event.type, `seed ${seed}`).toBe('start');
        if (r.effects.some((e) => e.type === 'request')) expect(event.type, `seed ${seed}`).toBe('start');
        if (r.state === s) expect(r.effects.every((e) => e.type === 'close')).toBe(true);
        s = r.state;
      }
    }
  });
});

describe('what the window shows', () => {
  const run = (state: TimerState, action: TimerAction, now: number) => step(state, action, now, DEFAULT_TIMER_CONFIG).state;
  const running = run(initialTimer(DEFAULT_TIMER_CONFIG), { type: 'start' }, NOW);
  const view = (follow: FollowState, reducedMotion = false, timer = running, now = NOW + 5 * MIN) => pipView({ timer, now, follow, reducedMotion });

  // Req ghost-follows-you:5.9
  it('hints at a 280 by 200 window', () => {
    expect(PIP_SIZE).toEqual({ width: 280, height: 200 });
  });

  // Req ghost-follows-you:6.3, 6.4, 9.3
  it('is at full strength only while floating, faded otherwise, with a fade unless motion is reduced', () => {
    for (const status of ['off', 'ready', 'opening', 'resting', 'floating', 'dismissed', 'unavailable'] as const) {
      const v = view(at(status));
      expect(v.ghostOpacity, status).toBe(status === 'floating' ? 1 : FADED_OPACITY);
      expect(v.fadeMs).toBe(FADE_MS);
      const still = view(at(status), true);
      expect(still.fadeMs).toBe(0);
      expect(still.ghostOpacity).toBe(v.ghostOpacity);
    }
    expect(FADED_OPACITY).toBe(0.25);
    expect(FADE_MS).toBe(600);
  });

  // Req ghost-follows-you:9.4, 9.6
  it('keeps the bobbing still under reduced motion and every state visible', () => {
    expect(view(at('resting'), true).still).toBe(true);
    expect(view(at('resting'), false).still).toBe(false);
    const paused = run(running, { type: 'pause' }, NOW + MIN);
    expect(view(at('resting'), true, paused).paused).toBe(true);
  });

  // Req ghost-follows-you:6.1, 6.2, 6.5
  it('shows the time from the absolute end time, and fading changes nothing else', () => {
    const a = view(at('floating'));
    const b = view(at('resting'));
    expect(a.timeLeft).toBe('20:00');
    expect(a.phaseLabel).toBe('Focus');
    expect({ ...a, ghostOpacity: 0 }).toEqual({ ...b, ghostOpacity: 0 });
    expect(view(at('floating'), false, running, NOW + 10 * MIN + 500).timeLeft).toBe('15:00');
  });

  // Req ghost-follows-you:6.7
  it('picks the line by the minute of time left', () => {
    const lines = new Set<string>();
    for (let m = 0; m < 25; m++) {
      const v = view(at('resting'), false, running, NOW + m * MIN);
      expect(FOLLOW_LINES).toContain(v.line);
      lines.add(v.line);
    }
    expect(lines.size).toBe(FOLLOW_LINES.length);
    expect(view(at('resting'), false, running, NOW + 61_000).line).toBe(view(at('resting'), false, running, NOW + 90_000).line);
  });

  // Req ghost-follows-you:6.8
  it('says Paused and freezes the time while the timer is paused', () => {
    const paused = run(running, { type: 'pause' }, NOW + 5 * MIN);
    const early = view(at('resting'), false, paused, NOW + 5 * MIN);
    const late = view(at('resting'), false, paused, NOW + 50 * MIN);
    expect(early.paused).toBe(true);
    expect(early.timeLeft).toBe('20:00');
    expect(late).toEqual(early);
    expect(view(at('resting')).paused).toBe(false);
  });

  // Req ghost-follows-you:13.6
  it('sameView is true only for equal views', () => {
    const v = view(at('floating'));
    expect(sameView(v, { ...v })).toBe(true);
    for (const patch of [
      { timeLeft: '00:01' },
      { phaseLabel: 'Short break' },
      { paused: true },
      { line: 'x' },
      { ghostOpacity: 0.5 },
      { fadeMs: 1 },
      { still: true },
    ]) {
      expect(sameView(v, { ...v, ...patch })).toBe(false);
    }
  });
});
