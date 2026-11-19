import { describe, expect, it } from 'vitest';
import { createBrowserNotifier, noopNotifier, type Notifier, type NotifyPermission } from '../../src/adapters/notify';
import { HouseController } from '../../src/app/controller';
import { createDemoModel } from '../../src/app/demo';
import { ManualClock } from '../../src/core/clock';
import { DEFAULT_SETTINGS, createModel, demoConfigFor, reduceApp, type Cue } from '../../src/core/model';
import { phaseEndNotice } from '../../src/core/notice';
import { parseModel, serializeModel } from '../../src/core/snapshot';

class FakeNotifier implements Notifier {
  shown: Array<{ title: string; body: string }> = [];
  requests = 0;
  constructor(
    public current: NotifyPermission,
    private readonly answer: NotifyPermission = 'granted',
  ) {}
  permission() {
    return this.current;
  }
  async requestPermission() {
    this.requests++;
    this.current = this.answer;
    return this.current;
  }
  show(title: string, body: string) {
    this.shown.push({ title, body });
  }
}

function setup(options: { permission: NotifyPermission; answer?: NotifyPermission; on?: boolean; hidden?: boolean; demo?: boolean }) {
  const clock = new ManualClock(new Date(2026, 10, 18, 10).getTime());
  const notifier = new FakeNotifier(options.permission, options.answer);
  const state = { hidden: options.hidden ?? true };
  const settings = { ...DEFAULT_SETTINGS, notifyPhaseEnd: options.on ?? false };
  const initial = options.demo ? createDemoModel(clock.now(), settings) : createModel(clock.now(), settings, demoConfigFor);
  const controller = new HouseController({ initial, clock, configFor: demoConfigFor, notifier, isHidden: () => state.hidden });
  const offMessages: string[] = [];
  controller.onNotifyOff((m) => offMessages.push(m));
  const finishFocus = () => {
    controller.dispatch({ type: 'timer', action: { type: 'start' } });
    clock.advance(20_000);
    controller.dispatch({ type: 'timer', action: { type: 'tick' } });
  };
  return { clock, notifier, controller, state, offMessages, finishFocus };
}

describe('phase-end notification', () => {
  it('is off by default and never touches the browser permission on its own', () => {
    expect(DEFAULT_SETTINGS.notifyPhaseEnd).toBe(false);
    const t = setup({ permission: 'granted' });
    t.finishFocus();
    expect(t.notifier.shown).toEqual([]);
    expect(t.notifier.requests).toBe(0);
  });

  it('notifies once, naming the phase that ended and what comes next, when hidden with permission', () => {
    const t = setup({ permission: 'granted', on: true });
    t.finishFocus();
    expect(t.notifier.shown).toHaveLength(1);
    expect(t.notifier.shown[0]).toEqual({ title: 'Focus finished', body: 'Your candle stays lit. Short break has started.' });
  });

  it('notifies when a break ends, too', () => {
    const t = setup({ permission: 'granted', on: true });
    t.finishFocus();
    t.clock.advance(10_000);
    t.controller.dispatch({ type: 'timer', action: { type: 'tick' } });
    expect(t.notifier.shown).toHaveLength(2);
    expect(t.notifier.shown[1]).toEqual({ title: 'Short break finished', body: 'Focus is ready when you are.' });
  });

  it('does not notify while the tab is visible', () => {
    const t = setup({ permission: 'granted', on: true, hidden: false });
    t.finishFocus();
    expect(t.notifier.shown).toEqual([]);
  });

  it('does not notify for a skip or a reset, which are not phase ends', () => {
    const t = setup({ permission: 'granted', on: true });
    t.controller.dispatch({ type: 'timer', action: { type: 'start' } });
    t.controller.dispatch({ type: 'timer', action: { type: 'skip' } });
    t.controller.dispatch({ type: 'timer', action: { type: 'reset' } });
    expect(t.notifier.shown).toEqual([]);
  });

  it('does not repeat on late ticks after the same phase end', () => {
    const t = setup({ permission: 'granted', on: true });
    t.controller.dispatch({ type: 'timer', action: { type: 'start' } });
    t.clock.advance(23_000);
    for (let i = 0; i < 4; i++) {
      t.controller.dispatch({ type: 'timer', action: { type: 'tick' } });
      t.clock.advance(250);
    }
    expect(t.notifier.shown).toHaveLength(1);
  });

  it('follows the setting in demo mode: silent when off, one notification when on', () => {
    const off = setup({ permission: 'granted', demo: true });
    off.finishFocus();
    expect(off.notifier.shown).toEqual([]);
    const on = setup({ permission: 'granted', on: true, demo: true });
    on.finishFocus();
    expect(on.notifier.shown).toHaveLength(1);
  });

  it('stays silent, without asking, when the setting is on but permission was never given', () => {
    const t = setup({ permission: 'default', on: true });
    t.finishFocus();
    expect(t.notifier.shown).toEqual([]);
    expect(t.notifier.requests).toBe(0);
    expect(t.controller.getModel().settings.notifyPhaseEnd).toBe(true);
  });

  it('turns itself off, with the reason, when permission has since been denied', () => {
    const t = setup({ permission: 'denied', on: true });
    t.finishFocus();
    expect(t.notifier.shown).toEqual([]);
    expect(t.controller.getModel().settings.notifyPhaseEnd).toBe(false);
    expect(t.offMessages).toHaveLength(1);
    expect(t.offMessages[0]).toMatch(/blocked/);
  });
});

describe('turning the setting on', () => {
  it('asks for permission at that moment and enables the setting when granted', async () => {
    const t = setup({ permission: 'default', answer: 'granted' });
    expect(t.notifier.requests).toBe(0);
    const result = await t.controller.setNotifyPhaseEnd(true);
    expect(t.notifier.requests).toBe(1);
    expect(result.enabled).toBe(true);
    expect(t.controller.getModel().settings.notifyPhaseEnd).toBe(true);
  });

  it('does not ask again when permission is already granted', async () => {
    const t = setup({ permission: 'granted' });
    await t.controller.setNotifyPhaseEnd(true);
    expect(t.notifier.requests).toBe(0);
    expect(t.controller.getModel().settings.notifyPhaseEnd).toBe(true);
  });

  it('keeps the setting off and says why when permission is denied', async () => {
    const t = setup({ permission: 'default', answer: 'denied' });
    const result = await t.controller.setNotifyPhaseEnd(true);
    expect(result.enabled).toBe(false);
    expect(result.message).toMatch(/blocked/);
    expect(t.controller.getModel().settings.notifyPhaseEnd).toBe(false);
  });

  it('does not show the prompt again when the browser already blocks the site', async () => {
    const t = setup({ permission: 'denied' });
    const result = await t.controller.setNotifyPhaseEnd(true);
    expect(t.notifier.requests).toBe(0);
    expect(result.enabled).toBe(false);
  });

  it('keeps the setting off when the prompt is dismissed, and when the browser has no support', async () => {
    const dismissed = setup({ permission: 'default', answer: 'default' });
    expect((await dismissed.controller.setNotifyPhaseEnd(true)).enabled).toBe(false);
    const none = setup({ permission: 'unsupported' });
    const result = await none.controller.setNotifyPhaseEnd(true);
    expect(result.enabled).toBe(false);
    expect(result.message).toMatch(/cannot show notifications/);
  });

  it('turns off without any permission work', async () => {
    const t = setup({ permission: 'granted', on: true });
    await t.controller.setNotifyPhaseEnd(false);
    expect(t.controller.getModel().settings.notifyPhaseEnd).toBe(false);
    expect(t.notifier.requests).toBe(0);
  });
});

describe('notification wording and settings storage', () => {
  it('names a long break and a manual start', () => {
    const cues: Cue[] = [{ kind: 'breakOver' }, { kind: 'phase', phase: 'focus', autoStarted: false }];
    expect(phaseEndNotice(cues, 'long')).toEqual({ title: 'Long break finished', body: 'Focus is ready when you are.' });
    expect(phaseEndNotice([{ kind: 'candleLit' }], 'focus')).toBeNull();
  });

  it('keeps the setting through a save, and reads an older save without it as off', () => {
    const model = reduceApp(createModel(1), { type: 'updateSettings', patch: { notifyPhaseEnd: true } }, 2).model;
    expect(parseModel(JSON.parse(serializeModel(model)), 3).settings.notifyPhaseEnd).toBe(true);
    const old = JSON.parse(serializeModel(createModel(1)));
    delete old.settings.notifyPhaseEnd;
    expect(parseModel(old, 3).settings.notifyPhaseEnd).toBe(false);
    old.settings.notifyPhaseEnd = 'yes';
    expect(parseModel(old, 3).settings.notifyPhaseEnd).toBe(false);
  });
});

describe('browser notifier adapter', () => {
  it('is a silent no-op where the Notification API is missing', () => {
    const n = createBrowserNotifier(undefined);
    expect(n).toBe(noopNotifier);
    expect(n.permission()).toBe('unsupported');
    expect(() => n.show('a', 'b')).not.toThrow();
  });

  it('wraps the Notification constructor with one tag', async () => {
    const made: unknown[][] = [];
    class FakeNotification {
      static permission = 'default';
      static async requestPermission() {
        FakeNotification.permission = 'granted';
        return 'granted';
      }
      constructor(...args: unknown[]) {
        made.push(args);
      }
    }
    const n = createBrowserNotifier(FakeNotification);
    expect(n.permission()).toBe('default');
    expect(await n.requestPermission()).toBe('granted');
    n.show('Focus finished', 'Body');
    expect(made).toHaveLength(1);
    expect(made[0]?.[0]).toBe('Focus finished');
    expect((made[0]?.[1] as { tag: string }).tag).toBe('haunted-pomodoro-phase');
  });

  it('reports the current permission if the prompt throws', async () => {
    class Broken {
      static permission = 'denied';
      static async requestPermission(): Promise<string> {
        throw new Error('blocked');
      }
      constructor() {}
    }
    expect(await createBrowserNotifier(Broken).requestPermission()).toBe('denied');
  });
});
