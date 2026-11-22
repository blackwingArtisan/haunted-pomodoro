import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/core/clock';
import { dayKey } from '../../src/core/dates';
import { CANDLES_PER_ROOM } from '../../src/core/house';
import { DEFAULT_SETTINGS, createModel, demoConfigFor, reduceApp, timerConfig, type AppAction, type AppModel, type Cue } from '../../src/core/model';

function harness(model?: AppModel, configFor = demoConfigFor) {
  const clock = new ManualClock(new Date(2026, 10, 18, 10).getTime());
  let m = model ?? createModel(clock.now(), DEFAULT_SETTINGS, configFor);
  const cues: Cue[] = [];
  const send = (action: AppAction) => {
    const r = reduceApp(m, action, clock.now(), configFor);
    m = r.model;
    cues.push(...r.cues);
    return r.cues;
  };
  const timer = (type: 'start' | 'tick' | 'hidden' | 'visible' | 'reset' | 'skip' | 'pause') => send({ type: 'timer', action: { type } });
  return { clock, send, timer, cues, get model() { return m; } };
}

describe('app reducer', () => {
  // Req 2.2, 2.7, 4.1, 4.2
  it('a finished focus session lights a candle, credits the task and logs the day', () => {
    const h = harness();
    h.send({ type: 'addTask', id: 't1', title: '  Draft the   chapter ', estimate: 2 });
    expect(h.model.activeTaskId).toBe('t1');
    expect(h.model.tasks[0]!.title).toBe('Draft the chapter');
    expect(h.timer('start')).toEqual([{ kind: 'candleLit' }]);
    h.clock.advance(20_000);
    h.timer('tick');
    expect(h.model.house).toEqual({ candlesLit: 1, roomsRestored: 0 });
    expect(h.model.tasks[0]!.spent).toBe(1);
    expect(h.model.days[dayKey(h.clock.now())]).toEqual({ sessions: 1, focusMs: 20_000, distractions: 0 });
    expect(h.cues.map((c) => c.kind)).toEqual(['candleLit', 'sessionComplete', 'phase', 'breakStarted']);
  });

  // Req 4.3
  it('the fourth candle restores the room', () => {
    const base = createModel(0, DEFAULT_SETTINGS, demoConfigFor);
    const h = harness({ ...base, house: { candlesLit: CANDLES_PER_ROOM - 1, roomsRestored: 0 } });
    h.timer('start');
    h.clock.advance(20_000);
    const cues = h.timer('tick');
    const restored = cues.find((c) => c.kind === 'roomRestored');
    expect(restored).toMatchObject({ kind: 'roomRestored', room: { id: 'parlor' }, houseRestored: false });
    expect(h.model.house).toEqual({ candlesLit: 0, roomsRestored: 1 });
  });

  // Req 3.2, 3.13
  it('a distraction wakes the ghost and is logged for the day', () => {
    const h = harness();
    h.timer('start');
    h.timer('hidden');
    h.clock.advance(2_500);
    expect(h.timer('tick')).toEqual([{ kind: 'ghostWoke' }]);
    expect(h.timer('visible')).toEqual([{ kind: 'ghostReturned', count: 1 }]);
    expect(h.model.days[dayKey(h.clock.now())]?.distractions).toBe(1);
  });

  // Req 3.20
  it('a comeback adds its time away to the day, and a return inside the grace period adds nothing', () => {
    const h = harness();
    h.timer('start');
    h.timer('hidden');
    h.clock.advance(4_000);
    h.timer('visible');
    h.timer('hidden');
    h.clock.advance(1_000);
    h.timer('visible');
    h.timer('hidden');
    h.clock.advance(6_000);
    h.timer('visible');
    expect(h.model.days[dayKey(h.clock.now())]).toMatchObject({ distractions: 2, awayMs: 10_000 });
  });

  // Req 1.17, 4.6
  it('reset snuffs the candle without touching the house', () => {
    const h = harness();
    h.timer('start');
    h.clock.advance(5_000);
    expect(h.timer('reset')).toEqual([{ kind: 'candleSnuffed' }]);
    expect(h.model.house.candlesLit).toBe(0);
  });

  it('ticks that change nothing return the same model object', () => {
    const h = harness();
    const before = h.model;
    h.timer('tick');
    expect(h.model).toBe(before);
  });

  // Req 2.3, 2.5, 2.6, 2.8, 2.9
  it('manages tasks: done, active hand-off, remove, clear', () => {
    const h = harness();
    h.send({ type: 'addTask', id: 'a', title: 'Alpha', estimate: 1 });
    h.send({ type: 'addTask', id: 'b', title: 'Beta', estimate: 30 });
    expect(h.model.tasks[1]!.estimate).toBe(12);
    h.send({ type: 'addTask', id: 'c', title: '   ', estimate: 1 });
    expect(h.model.tasks).toHaveLength(2);
    h.send({ type: 'toggleTaskDone', id: 'a' });
    expect(h.model.activeTaskId).toBe('b');
    h.send({ type: 'renameTask', id: 'b', title: 'Beta two' });
    h.send({ type: 'setActiveTask', id: 'missing' });
    expect(h.model.activeTaskId).toBe('b');
    h.send({ type: 'clearDoneTasks' });
    expect(h.model.tasks.map((t) => t.title)).toEqual(['Beta two']);
    h.send({ type: 'removeTask', id: 'b' });
    expect(h.model).toMatchObject({ tasks: [], activeTaskId: null });
  });

  // Req 2.4
  it('choosing a task makes it the active task', () => {
    const h = harness();
    h.send({ type: 'addTask', id: 'a', title: 'Alpha', estimate: 1 });
    h.send({ type: 'addTask', id: 'b', title: 'Beta', estimate: 1 });
    expect(h.model.activeTaskId).toBe('a');
    h.send({ type: 'setActiveTask', id: 'b' });
    expect(h.model.activeTaskId).toBe('b');
  });

  // Req 1.10, 1.16, 9.1
  it('clamps settings and applies new lengths to an idle timer', () => {
    const real = harness(createModel(0), timerConfig);
    real.send({ type: 'updateSettings', patch: { focusMin: 500, volume: 3, longEvery: 1 } });
    expect(real.model.settings).toMatchObject({ focusMin: 120, volume: 1, longEvery: 2 });
    expect(real.model.timer.durationMs).toBe(120 * 60_000);
    // Demo mode keeps its own short lengths whatever the settings say.
    const demo = harness();
    demo.send({ type: 'updateSettings', patch: { focusMin: 50 } });
    expect(demo.model.timer.durationMs).toBe(20_000);
    expect(DEFAULT_SETTINGS.focusMin).toBe(25);
  });

  // Req ghost-follows-you:4.1, 12.3
  it('keeps the follow setting off unless it is exactly the boolean true', () => {
    expect(DEFAULT_SETTINGS.ghostFollows).toBe(false);
    const h = harness();
    expect(h.model.settings.ghostFollows).toBe(false);
    h.send({ type: 'updateSettings', patch: { ghostFollows: true } });
    expect(h.model.settings.ghostFollows).toBe(true);
    for (const bad of ['true', 1, null]) {
      h.send({ type: 'updateSettings', patch: { ghostFollows: bad as unknown as boolean } });
      expect(h.model.settings.ghostFollows).toBe(false);
    }
  });
});
