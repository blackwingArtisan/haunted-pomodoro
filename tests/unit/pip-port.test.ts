import { describe, expect, it } from 'vitest';
import { FakePipWindow, createViewGate, noopPip, type PipClosedBy, type PipView } from '../../src/adapters/pip';

const SIZE = { width: 280, height: 200 };
const view = (patch: Partial<PipView> = {}): PipView => ({
  timeLeft: '25:00',
  phaseLabel: 'Focus',
  paused: false,
  line: 'Nothing here needs hurrying.',
  ghostOpacity: 0.25,
  fadeMs: 600,
  still: false,
  ...patch,
});

describe('the no-op window', () => {
  // Req ghost-follows-you:8.4
  it('reports unsupported and resolves { ok: false, reason: "unsupported" } without throwing', async () => {
    expect(noopPip.isSupported()).toBe(false);
    expect(noopPip.isOpen()).toBe(false);
    await expect(noopPip.open(SIZE, () => view())).resolves.toEqual({ ok: false, reason: 'unsupported' });
    expect(() => {
      noopPip.refresh();
      noopPip.close();
      noopPip.onClosed(() => undefined)();
    }).not.toThrow();
  });
});

describe('the view gate', () => {
  // Req ghost-follows-you:13.6
  it('passes a first view and a changed view and drops an equal one', () => {
    const written: PipView[] = [];
    const gate = createViewGate((v) => written.push(v));
    gate(view());
    gate(view());
    gate(view({ timeLeft: '24:59' }));
    gate(view({ timeLeft: '24:59' }));
    gate(view({ timeLeft: '24:59', ghostOpacity: 1 }));
    expect(written.map((v) => [v.timeLeft, v.ghostOpacity])).toEqual([
      ['25:00', 0.25],
      ['24:59', 0.25],
      ['24:59', 1],
    ]);
  });
});

describe('the fake window', () => {
  // Req ghost-follows-you:5.1
  it('opens when called inside activate', async () => {
    const pip = new FakePipWindow();
    const result = await pip.activate(() => pip.open(SIZE, () => view()));
    expect(result).toEqual({ ok: true });
    expect(pip.isOpen()).toBe(true);
    expect(pip.openCalls).toEqual([{ options: SIZE, inGesture: true }]);
  });

  // Req ghost-follows-you:5.1, 5.4
  it('answers not-allowed to a call after an await or from a plain call', async () => {
    const pip = new FakePipWindow();
    expect(await pip.open(SIZE, () => view())).toEqual({ ok: false, reason: 'not-allowed' });
    const late = await pip.activate(async () => {
      await Promise.resolve();
      return pip.open(SIZE, () => view());
    });
    expect(late).toEqual({ ok: false, reason: 'not-allowed' });
    expect(pip.openCalls.map((c) => c.inGesture)).toEqual([false, false]);
    expect(pip.isOpen()).toBe(false);
    // Activation ends when the function returns.
    pip.activate(() => undefined);
    expect(await pip.open(SIZE, () => view())).toEqual({ ok: false, reason: 'not-allowed' });
  });

  // Req ghost-follows-you:5.1
  it('plays back scripted rejections and an unsupported browser', async () => {
    const pip = new FakePipWindow();
    for (const [outcome, reason] of [
      ['reject:not-allowed', 'not-allowed'],
      ['reject:unsupported', 'unsupported'],
      ['reject:failed', 'failed'],
    ] as const) {
      pip.outcome = outcome;
      expect(await pip.activate(() => pip.open(SIZE, () => view()))).toEqual({ ok: false, reason });
      expect(pip.isOpen()).toBe(false);
    }
    pip.supported = false;
    expect(pip.isSupported()).toBe(false);
    pip.outcome = 'ok';
    expect(await pip.activate(() => pip.open(SIZE, () => view()))).toEqual({ ok: false, reason: 'unsupported' });
  });

  // Req ghost-follows-you:5.4
  it('keeps a pending request open until it is settled', async () => {
    const pip = new FakePipWindow();
    pip.outcome = 'pending';
    const answer = pip.activate(() => pip.open(SIZE, () => view()));
    expect(pip.hasPending()).toBe(true);
    expect(pip.isOpen()).toBe(false);
    pip.settle({ ok: true });
    expect(await answer).toEqual({ ok: true });
    expect(pip.isOpen()).toBe(true);
    expect(pip.hasPending()).toBe(false);

    const rejected = pip.activate(() => pip.open(SIZE, () => view()));
    pip.settle({ ok: false, reason: 'failed' });
    expect(await rejected).toEqual({ ok: false, reason: 'failed' });
  });

  // Req ghost-follows-you:5.1
  it('lets views pass through the gate on open and refresh, and writes nothing once closed', async () => {
    const pip = new FakePipWindow();
    let current = view();
    await pip.activate(() => pip.open(SIZE, () => current));
    expect(pip.views).toHaveLength(1);
    pip.refresh();
    expect(pip.views).toHaveLength(1);
    current = view({ timeLeft: '24:59' });
    pip.refresh();
    expect(pip.views.map((v) => v.timeLeft)).toEqual(['25:00', '24:59']);
    pip.close();
    current = view({ timeLeft: '24:58' });
    pip.refresh();
    expect(pip.views).toHaveLength(2);
  });

  // Req ghost-follows-you:5.1
  it('reports who closed it: app for close(), external for the person', async () => {
    const pip = new FakePipWindow();
    const closed: PipClosedBy[] = [];
    const off = pip.onClosed((by) => closed.push(by));
    await pip.activate(() => pip.open(SIZE, () => view()));
    pip.close();
    expect(closed).toEqual(['app']);
    expect(pip.closeCalls).toBe(1);
    pip.close(); // nothing open: counted, nothing reported
    expect(pip.closeCalls).toBe(2);
    await pip.activate(() => pip.open(SIZE, () => view()));
    pip.closeFromOutside();
    expect(closed).toEqual(['app', 'external']);
    expect(pip.isOpen()).toBe(false);
    off();
    await pip.activate(() => pip.open(SIZE, () => view()));
    pip.closeFromOutside();
    expect(closed).toHaveLength(2);
  });
});
