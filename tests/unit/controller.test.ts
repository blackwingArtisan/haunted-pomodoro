import { describe, expect, it } from 'vitest';
import { HouseController } from '../../src/app/controller';
import { createDemoModel } from '../../src/app/demo';
import { ManualClock } from '../../src/core/clock';
import { DEFAULT_SETTINGS, createModel, demoConfigFor, type AppModel, type Cue } from '../../src/core/model';

describe('HouseController', () => {
  it('persists and notifies only when the model really changes', () => {
    const clock = new ManualClock(1_000);
    const saved: AppModel[] = [];
    let renders = 0;
    const c = new HouseController({ initial: createModel(clock.now()), clock, persist: (m) => saved.push(m) });
    c.subscribe(() => renders++);
    c.dispatch({ type: 'timer', action: { type: 'tick' } });
    expect(saved).toHaveLength(0);
    expect(renders).toBe(0);
    c.dispatch({ type: 'timer', action: { type: 'start' } });
    expect(saved).toHaveLength(1);
    expect(renders).toBe(1);
  });

  it('emits cues and stops after unsubscribe', () => {
    const clock = new ManualClock(0);
    const c = new HouseController({ initial: createModel(0, DEFAULT_SETTINGS, demoConfigFor), clock, configFor: demoConfigFor });
    const cues: Cue[] = [];
    const off = c.onCues((list) => cues.push(...list));
    c.dispatch({ type: 'timer', action: { type: 'start' } });
    clock.advance(20_000);
    c.dispatch({ type: 'timer', action: { type: 'tick' } });
    expect(cues.map((x) => x.kind)).toContain('sessionComplete');
    off();
    c.dispatch({ type: 'timer', action: { type: 'reset' } });
    expect(cues.map((x) => x.kind)).not.toContain('candleSnuffed');
  });
});

describe('demo house', () => {
  // Req 9.1, 9.4
  it('starts with a fully haunted parlor that one candle restores, a warm streak and demo lengths', () => {
    const now = new Date(2026, 10, 18, 12).getTime();
    const m = createDemoModel(now, { ...DEFAULT_SETTINGS, autoStartBreaks: false });
    expect(m.house).toEqual({ candlesLit: 0, roomsRestored: 0, candlesPerRoom: 1 });
    expect(m.timer.durationMs).toBe(20_000);
    expect(m.settings.autoStartBreaks).toBe(true);
    expect(Object.keys(m.days)).toHaveLength(4);
    expect(m.activeTaskId).toBe('demo-1');
  });
});
