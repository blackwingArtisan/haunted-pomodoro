import { describe, expect, it } from 'vitest';
import { FakeFavicon } from '../../src/adapters/favicon';
import { FakePipWindow, type FakeOutcome } from '../../src/adapters/pip';
import { HouseController } from '../../src/app/controller';
import { FOLLOW_NOTES, GhostFollower } from '../../src/app/follow';
import { ManualClock } from '../../src/core/clock';
import { DEFAULT_SETTINGS, createModel } from '../../src/core/model';

const START = Date.UTC(2025, 5, 2, 9, 0, 0);
const MIN = 60_000;
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

interface Rig {
  clock: ManualClock;
  controller: HouseController;
  pip: FakePipWindow;
  fav: FakeFavicon;
  follower: GhostFollower;
  titles: string[];
  announced: string[];
  notes: string[];
  env: { hidden: boolean; reduced: boolean };
  /** The click handler: the follower's gesture call, then the dispatch. */
  start(): void;
  act(action: 'tick' | 'toggle' | 'reset' | 'skip' | 'hidden' | 'visible'): void;
  setHidden(hidden: boolean): void;
  advance(ms: number): void;
}

function rig(follows = true): Rig {
  const clock = new ManualClock(START);
  const controller = new HouseController({ initial: createModel(START, { ...DEFAULT_SETTINGS, ghostFollows: follows }), clock });
  // The follower is handed a source whose `dispatch` would throw if it were ever used.
  const source = {
    getModel: controller.getModel,
    subscribe: controller.subscribe,
    dispatch: () => {
      throw new Error('the follower must not dispatch');
    },
  };
  const pip = new FakePipWindow();
  const fav = new FakeFavicon();
  const titles: string[] = [];
  const announced: string[] = [];
  const notes: string[] = [];
  const env = { hidden: false, reduced: false };
  const follower = new GhostFollower({
    controller: source,
    clock,
    pip,
    favicon: fav,
    setTitle: (t) => titles.push(t),
    isHidden: () => env.hidden,
    isReducedMotion: () => env.reduced,
    announce: (t) => announced.push(t),
    note: (t) => notes.push(t),
  });
  const r: Rig = {
    clock,
    controller,
    pip,
    fav,
    follower,
    titles,
    announced,
    notes,
    env,
    start() {
      pip.activate(() => {
        follower.startGesture();
        controller.dispatch({ type: 'timer', action: { type: 'toggle' } });
      });
    },
    act(action) {
      controller.dispatch({ type: 'timer', action: { type: action } });
    },
    setHidden(hidden) {
      env.hidden = hidden;
      controller.dispatch({ type: 'timer', action: { type: hidden ? 'hidden' : 'visible' } });
      follower.sync();
    },
    advance(ms) {
      clock.advance(ms);
      controller.dispatch({ type: 'timer', action: { type: 'tick' } });
      follower.sync();
    },
  };
  follower.sync();
  return r;
}

describe('GhostFollower', () => {
  // Req ghost-follows-you:5.4, 5.5, 5.6, 5.7, 12.6
  it('requests no window on load, on a tick, on an auto-start or on a resume', async () => {
    const r = rig();
    for (let i = 0; i < 5; i++) r.advance(250);
    expect(r.pip.openCalls).toHaveLength(0);
    // A session already running when the page loads: the follower is built after the start.
    r.act('toggle');
    r.advance(250);
    r.act('toggle'); // pause
    r.pip.activate(() => r.follower.startGesture()); // a gesture on Resume is not a start
    r.act('toggle'); // resume
    r.advance(250);
    await flush();
    expect(r.pip.openCalls).toHaveLength(0);
    expect(r.follower.getState().status).toBe('ready');
  });

  // Req ghost-follows-you:5.1, 5.2, 5.10, 7.10
  it('requests one window per start gesture, inside the gesture, without holding the timer back', async () => {
    const r = rig();
    r.start();
    expect(r.pip.openCalls).toHaveLength(1);
    expect(r.pip.openCalls[0]!.inGesture).toBe(true);
    expect(r.pip.openCalls[0]!.options).toEqual({ width: 280, height: 200 });
    expect(r.controller.getModel().timer.status).toBe('running');
    await flush();
    r.advance(250);
    expect(r.pip.isOpen()).toBe(true);
    expect(r.follower.getState().status).toBe('resting');
    expect(r.announced).toEqual([FOLLOW_NOTES.opened]);
    expect(r.pip.views.at(-1)!.timeLeft).toBe('25:00');
  });

  // Req ghost-follows-you:5.8
  it('keeps the open window and does not request a second one', async () => {
    const r = rig();
    r.start();
    await flush();
    r.act('reset');
    r.pip.activate(() => r.follower.startGesture()); // before any sync has noticed the reset
    await flush();
    expect(r.pip.openCalls).toHaveLength(1);
  });

  // Req ghost-follows-you:4.6
  it('never requests a window while the setting is off', async () => {
    const r = rig(false);
    r.start();
    await flush();
    expect(r.pip.openCalls).toHaveLength(0);
  });

  // Req ghost-follows-you:8.1, 8.2, 8.3
  it.each<FakeOutcome>(['reject:not-allowed', 'reject:unsupported', 'reject:failed'])('keeps the timer running and says why once when the request is %s', async (outcome) => {
    const r = rig();
    r.pip.outcome = outcome;
    r.start();
    await flush();
    r.advance(250);
    r.advance(250);
    expect(r.controller.getModel().timer.status).toBe('running');
    expect(r.announced).toEqual([FOLLOW_NOTES.failed]);
    expect(r.notes).toEqual([FOLLOW_NOTES.failed]);
    expect(r.pip.openCalls).toHaveLength(1);
    expect(r.follower.getState().status).toBe('unavailable');
  });

  // Req ghost-follows-you:7.1, 7.2, 7.3, 7.4, 7.5
  it('leaves the model alone when the person closes the window, and opens again only for the next session', async () => {
    const r = rig();
    r.start();
    await flush();
    r.setHidden(true);
    r.advance(5_000);
    r.setHidden(false);
    const before = r.controller.getModel();
    r.pip.closeFromOutside();
    expect(r.controller.getModel()).toBe(before);
    expect(r.announced.at(-1)).toBe(FOLLOW_NOTES.closed);
    expect(FOLLOW_NOTES.closed).toContain('still burning');
    r.advance(1_000);
    expect(r.controller.getModel().timer.status).toBe('running');
    expect(r.pip.openCalls).toHaveLength(1);
    // The next focus session, lit with a gesture, asks again.
    r.act('reset');
    r.follower.sync();
    expect(r.follower.getState().status).toBe('ready');
    r.start();
    await flush();
    expect(r.pip.openCalls).toHaveLength(2);
    expect(r.pip.isOpen()).toBe(true);
  });

  // Req ghost-follows-you:7.7
  it('closes the window when the session is reset, skipped or finishes, without a closing note', async () => {
    for (const end of ['reset', 'skip'] as const) {
      const r = rig();
      r.start();
      await flush();
      r.act(end);
      r.follower.sync();
      expect(r.pip.isOpen()).toBe(false);
      expect(r.announced).toEqual([FOLLOW_NOTES.opened]);
    }
    const r = rig();
    r.start();
    await flush();
    r.advance(25 * MIN);
    expect(r.pip.isOpen()).toBe(false);
  });

  // Req ghost-follows-you:8.6
  it('closes a window that opens after the session was reset', async () => {
    const r = rig();
    r.pip.outcome = 'pending';
    r.start();
    r.act('reset');
    r.follower.sync();
    r.pip.settle({ ok: true });
    await flush();
    expect(r.pip.isOpen()).toBe(false);
    expect(r.pip.closeCalls).toBeGreaterThan(0);
  });

  // Req ghost-follows-you:4.3, 8.7
  it('closes the window when the setting is turned off, and a late window too', async () => {
    const r = rig();
    r.start();
    await flush();
    r.controller.dispatch({ type: 'updateSettings', patch: { ghostFollows: false } });
    r.follower.sync();
    expect(r.pip.isOpen()).toBe(false);
    expect(r.controller.getModel().timer.status).toBe('running');

    const late = rig();
    late.pip.outcome = 'pending';
    late.start();
    late.controller.dispatch({ type: 'updateSettings', patch: { ghostFollows: false } });
    late.follower.sync();
    late.pip.settle({ ok: true });
    await flush();
    expect(late.pip.isOpen()).toBe(false);
  });

  // Req ghost-follows-you:2.6, 6.3, 6.4
  it('fades with visibility and leaves the wanderings to the timer', async () => {
    const r = rig();
    r.start();
    await flush();
    expect(r.pip.views.at(-1)!.ghostOpacity).toBe(0.25);
    r.setHidden(true);
    expect(r.pip.views.at(-1)!.ghostOpacity).toBe(1);
    r.advance(5_000);
    r.setHidden(false);
    expect(r.pip.views.at(-1)!.ghostOpacity).toBe(0.25);
    expect(r.pip.isOpen()).toBe(true);
    expect(r.controller.getModel().timer.distractions).toBe(1);
  });

  // Req ghost-follows-you:9.5
  it('applies a motion change to the open window without reopening it', async () => {
    const r = rig();
    r.start();
    await flush();
    expect(r.pip.views.at(-1)!.still).toBe(false);
    r.env.reduced = true;
    r.follower.sync();
    expect(r.pip.views.at(-1)!.still).toBe(true);
    expect(r.pip.views.at(-1)!.fadeMs).toBe(0);
    expect(r.pip.openCalls).toHaveLength(1);
  });

  // Req ghost-follows-you:3.7, 13.4, 13.6
  it('writes nothing when a tick changes nothing', async () => {
    const r = rig();
    r.start();
    await flush();
    r.advance(250);
    const counts = () => [r.fav.frames.length, r.titles.length, r.pip.views.length];
    const before = counts();
    r.follower.sync();
    r.follower.sync();
    expect(counts()).toEqual(before);
  });

  // Req ghost-follows-you:2.1, 2.3, 3.4, 10.4
  it('shows the ghost while hidden and the candle again on return, with the title following', async () => {
    const r = rig();
    r.start();
    r.follower.sync();
    expect(r.fav.frames.at(-1)!.kind).toBe('candle');
    r.setHidden(true);
    expect(r.fav.frames.at(-1)!.kind).toBe('ghost');
    r.advance(4_000);
    expect(r.titles.at(-1)).toMatch(/^Come back… 24:\d\d left/);
    r.setHidden(false);
    expect(r.fav.frames.at(-1)!.kind).toBe('candle');
    expect(r.titles.at(-1)).toMatch(/^24:\d\d · Focus/);
  });

  // Req ghost-follows-you:11.1
  it('never calls dispatch on the controller', async () => {
    const r = rig();
    r.start();
    await flush();
    r.setHidden(true);
    r.pip.closeFromOutside();
    r.setHidden(false);
    r.follower.dispose();
    // The source handed to the follower throws on dispatch, so reaching here means it never did.
    expect(r.controller.getModel().timer.status).toBe('running');
  });
});

/* ------------------------------------------------------------------ properties */

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Step = 'start' | 'tick' | 'long' | 'toggle' | 'reset' | 'skip' | 'hide' | 'show' | 'close' | 'reduce' | 'outcome';
const STEPS: Step[] = ['start', 'tick', 'tick', 'long', 'toggle', 'reset', 'skip', 'hide', 'show', 'close', 'reduce', 'outcome'];
const OUTCOMES: FakeOutcome[] = ['ok', 'ok', 'reject:not-allowed', 'reject:failed', 'pending'];

describe('GhostFollower properties', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  // Req ghost-follows-you:11.1, 7.1, 7.2, 8.1
  it.each(seeds)('does not interfere with the model (seed %i)', async (seed) => {
    const rand = seeded(seed);
    const withFollower = rig(true);
    const clock2 = new ManualClock(START);
    const bare = new HouseController({ initial: createModel(START, { ...DEFAULT_SETTINGS, ghostFollows: true }), clock: clock2 });
    const both = (action: Parameters<typeof withFollower.act>[0]) => {
      withFollower.act(action);
      bare.dispatch({ type: 'timer', action: { type: action } });
    };
    for (let i = 0; i < 80; i++) {
      const step = STEPS[Math.floor(rand() * STEPS.length)]!;
      switch (step) {
        case 'start':
          withFollower.pip.activate(() => withFollower.follower.startGesture());
          both('toggle');
          break;
        case 'tick':
        case 'long': {
          const ms = step === 'tick' ? 250 : 7 * MIN;
          withFollower.clock.advance(ms);
          clock2.advance(ms);
          both('tick');
          break;
        }
        case 'toggle':
        case 'reset':
        case 'skip':
          both(step);
          break;
        case 'hide':
        case 'show': {
          const hidden = step === 'hide';
          withFollower.env.hidden = hidden;
          both(hidden ? 'hidden' : 'visible');
          break;
        }
        case 'close':
          withFollower.pip.closeFromOutside();
          break;
        case 'reduce':
          withFollower.env.reduced = !withFollower.env.reduced;
          break;
        case 'outcome':
          withFollower.pip.outcome = OUTCOMES[Math.floor(rand() * OUTCOMES.length)]!;
          if (withFollower.pip.hasPending() && rand() < 0.5) withFollower.pip.settle({ ok: true });
          break;
      }
      withFollower.follower.sync();
      await flush();
    }
    expect(withFollower.controller.getModel()).toEqual(bare.getModel());
  });

  // Req ghost-follows-you:5.1, 5.4
  it.each(seeds)('opens only inside a start gesture, at most once per gesture (seed %i)', async (seed) => {
    const rand = seeded(seed + 1000);
    const r = rig(true);
    let gestures = 0;
    for (let i = 0; i < 80; i++) {
      const step = STEPS[Math.floor(rand() * STEPS.length)]!;
      if (step === 'start') {
        gestures++;
        r.start();
      } else if (step === 'tick') r.advance(250);
      else if (step === 'long') r.advance(7 * MIN);
      else if (step === 'toggle' || step === 'reset' || step === 'skip') r.act(step);
      else if (step === 'hide' || step === 'show') r.setHidden(step === 'hide');
      else if (step === 'close') r.pip.closeFromOutside();
      else if (step === 'outcome') r.pip.outcome = OUTCOMES[Math.floor(rand() * OUTCOMES.length)]!;
      r.follower.sync();
      await flush();
    }
    expect(r.pip.openCalls.every((c) => c.inGesture)).toBe(true);
    expect(r.pip.openCalls.length).toBeLessThanOrEqual(gestures);
  });

  // Req ghost-follows-you:3.7, 13.4, 13.6
  it('writes nothing on idle syncs and draws at most 24 candles over a 25-minute session', async () => {
    const r = rig(true);
    r.start();
    await flush();
    for (let t = 0; t < 25 * 60 * 4; t++) r.advance(250);
    const candles = r.fav.frames.filter((f) => f.kind === 'candle');
    expect(candles.length).toBeLessThanOrEqual(24);
    const r2 = rig(true);
    r2.start();
    await flush();
    r2.advance(250);
    const before = [r2.fav.frames.length, r2.titles.length, r2.pip.views.length];
    for (let i = 0; i < 20; i++) r2.follower.sync();
    expect([r2.fav.frames.length, r2.titles.length, r2.pip.views.length]).toEqual(before);
  });
});
