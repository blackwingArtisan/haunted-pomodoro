import { describe, expect, it } from 'vitest';
import { createBrowserPip, type DocumentPipApi, type PipClosedBy, type PipEnv, type PipHostWindow, type PipView } from '../../src/adapters/pip';

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

/** A host window that records what the adapter does to it. */
class FakeHost implements PipHostWindow {
  readonly document = { tag: 'pip-document' } as unknown as Document;
  closed = 0;
  intervals = new Map<number, () => void>();
  cleared: number[] = [];
  private nextId = 1;
  private pagehide: Array<() => void> = [];
  closeDispatchesPagehide = true;

  addEventListener(_type: 'pagehide', listener: () => void, options?: { once?: boolean }) {
    this.pagehide.push(options?.once ? () => { this.pagehide = this.pagehide.filter((l) => l !== wrapped); listener(); } : listener);
    const wrapped = this.pagehide[this.pagehide.length - 1]!;
  }
  setInterval(handler: () => void): number {
    const id = this.nextId++;
    this.intervals.set(id, handler);
    return id;
  }
  clearInterval(id: number): void {
    this.cleared.push(id);
    this.intervals.delete(id);
  }
  close(): void {
    this.closed++;
    if (this.closeDispatchesPagehide) this.firePagehide();
  }
  firePagehide(): void {
    for (const l of [...this.pagehide]) l();
  }
  tick(): void {
    for (const h of [...this.intervals.values()]) h();
  }
}

function setup(request?: (options?: { width?: number; height?: number }) => Promise<PipHostWindow>) {
  const host = new FakeHost();
  const calls: Array<{ options?: { width?: number; height?: number }; stackDepthMarker: string }> = [];
  let marker = 'outside';
  const api: DocumentPipApi = {
    requestWindow(options) {
      calls.push({ options, stackDepthMarker: marker });
      return request ? request(options) : Promise.resolve(host);
    },
  };
  const env: PipEnv = { documentPictureInPicture: api };
  const rendered: Array<{ doc: Document; view: PipView }> = [];
  const pip = createBrowserPip(env, (doc, v) => rendered.push({ doc, view: v }));
  const closed: PipClosedBy[] = [];
  pip.onClosed((by) => closed.push(by));
  return { host, env, api, pip, calls, rendered, closed, mark: (m: string) => (marker = m) };
}

const rejecting = (name: string) => () => Promise.reject(Object.assign(new Error(name), { name }));

describe('the browser adapter', () => {
  // Req ghost-follows-you:5.1, 5.10
  it('calls requestWindow in the same call stack, before any await, with the size hint', async () => {
    const t = setup();
    const answer = t.pip.open(SIZE, () => view());
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]!.options).toEqual({ width: 280, height: 200 });
    expect(t.pip.isOpen()).toBe(false);
    expect(await answer).toEqual({ ok: true });
    expect(t.pip.isOpen()).toBe(true);
    // The first view is written into the window's document.
    expect(t.rendered).toEqual([{ doc: t.host.document, view: view() }]);
  });

  // Req ghost-follows-you:5.9
  it('passes whatever size it is given as a hint only', async () => {
    const t = setup();
    await t.pip.open({ width: 300, height: 220 }, () => view());
    expect(t.calls[0]!.options).toEqual({ width: 300, height: 220 });
  });

  // Req ghost-follows-you:8.1
  it('maps each rejection to a result and never rejects', async () => {
    for (const [name, reason] of [
      ['NotAllowedError', 'not-allowed'],
      ['NotSupportedError', 'unsupported'],
      ['RangeError', 'failed'],
      ['SomethingElse', 'failed'],
    ] as const) {
      const t = setup(rejecting(name));
      await expect(t.pip.open(SIZE, () => view())).resolves.toEqual({ ok: false, reason });
      expect(t.pip.isOpen()).toBe(false);
    }
    const nonError = setup(() => Promise.reject('nope'));
    await expect(nonError.pip.open(SIZE, () => view())).resolves.toEqual({ ok: false, reason: 'failed' });
  });

  // Req ghost-follows-you:8.1
  it('maps a synchronous throw to failed', async () => {
    const t = setup(() => {
      throw new TypeError('broken');
    });
    await expect(t.pip.open(SIZE, () => view())).resolves.toEqual({ ok: false, reason: 'failed' });
    expect(t.pip.isOpen()).toBe(false);
  });

  // Req ghost-follows-you:8.4
  it('treats a missing API as unsupported and never throws', async () => {
    const pip = createBrowserPip({});
    expect(pip.isSupported()).toBe(false);
    await expect(pip.open(SIZE, () => view())).resolves.toEqual({ ok: false, reason: 'unsupported' });
    expect(() => {
      pip.refresh();
      pip.close();
    }).not.toThrow();
    // The API is read at call time, so it can appear after the adapter was made.
    const env: PipEnv = {};
    const late = createBrowserPip(env);
    expect(late.isSupported()).toBe(false);
    env.documentPictureInPicture = { requestWindow: () => Promise.resolve(new FakeHost()) };
    expect(late.isSupported()).toBe(true);
  });

  // Req ghost-follows-you:7.9
  it('reports a pagehide of the open window as external', async () => {
    const t = setup();
    await t.pip.open(SIZE, () => view());
    t.host.firePagehide();
    expect(t.closed).toEqual(['external']);
    expect(t.pip.isOpen()).toBe(false);
    expect(t.host.cleared).toHaveLength(1);
  });

  // Req ghost-follows-you:7.8
  it('reports close() as app, clears the interval and drops the window', async () => {
    const t = setup();
    await t.pip.open(SIZE, () => view());
    expect(t.host.intervals.size).toBe(1);
    t.pip.close();
    expect(t.closed).toEqual(['app']);
    expect(t.host.closed).toBe(1);
    expect(t.host.intervals.size).toBe(0);
    expect(t.pip.isOpen()).toBe(false);
    // Nothing more is written once it is closed.
    t.pip.refresh();
    expect(t.rendered).toHaveLength(1);
    t.pip.close();
    expect(t.host.closed).toBe(1);
    expect(t.closed).toEqual(['app']);
  });

  // Req ghost-follows-you:6.2
  it('refreshes once a second from the window’s own interval, writing only changed views', async () => {
    const t = setup();
    let current = view();
    await t.pip.open(SIZE, () => current);
    t.host.tick();
    expect(t.rendered).toHaveLength(1);
    current = view({ timeLeft: '24:59' });
    t.host.tick();
    expect(t.rendered.map((r) => r.view.timeLeft)).toEqual(['25:00', '24:59']);
    current = view({ timeLeft: '24:59', ghostOpacity: 1 });
    t.pip.refresh();
    expect(t.rendered).toHaveLength(3);
  });

  // Req ghost-follows-you:8.5
  it('treats a write that throws as a closed window', async () => {
    const host = new FakeHost();
    const closed: PipClosedBy[] = [];
    let explode = false;
    const pip = createBrowserPip({ documentPictureInPicture: { requestWindow: () => Promise.resolve(host) } }, () => {
      if (explode) throw new Error('window is gone');
    });
    pip.onClosed((by) => closed.push(by));
    let current = view();
    await pip.open(SIZE, () => current);
    explode = true;
    current = view({ timeLeft: '24:59' });
    expect(() => host.tick()).not.toThrow();
    expect(closed).toEqual(['external']);
    expect(pip.isOpen()).toBe(false);
    expect(host.intervals.size).toBe(0);
  });

  // Req ghost-follows-you:8.1
  it('answers failed when the first write throws, and leaves no window open', async () => {
    const host = new FakeHost();
    const pip = createBrowserPip({ documentPictureInPicture: { requestWindow: () => Promise.resolve(host) } }, () => {
      throw new Error('cannot draw');
    });
    await expect(pip.open(SIZE, () => view())).resolves.toEqual({ ok: false, reason: 'failed' });
    expect(pip.isOpen()).toBe(false);
    expect(host.closed).toBe(1);
  });

  // Req ghost-follows-you:7.9
  it('ignores a pagehide from a window that is no longer the stored one', async () => {
    const first = new FakeHost();
    const second = new FakeHost();
    const queue = [first, second];
    const closed: PipClosedBy[] = [];
    const pip = createBrowserPip({ documentPictureInPicture: { requestWindow: () => Promise.resolve(queue.shift()!) } }, () => undefined);
    pip.onClosed((by) => closed.push(by));
    await pip.open(SIZE, () => view());
    await pip.open(SIZE, () => view()); // the browser closes the first one
    first.firePagehide();
    expect(closed).toEqual([]);
    expect(pip.isOpen()).toBe(true);
    second.firePagehide();
    expect(closed).toEqual(['external']);
  });

  // Req ghost-follows-you:7.8
  it('closes its window when the opener page is hidden for good, and the app ignores that close', async () => {
    const host = new FakeHost();
    let openerPagehide: (() => void) | undefined;
    const env: PipEnv = {
      documentPictureInPicture: { requestWindow: () => Promise.resolve(host) },
      addEventListener: (_t, l) => {
        openerPagehide = l;
      },
    };
    const pip = createBrowserPip(env, () => undefined);
    const closed: PipClosedBy[] = [];
    pip.onClosed((by) => closed.push(by));
    await pip.open(SIZE, () => view());
    openerPagehide?.();
    expect(host.closed).toBe(1);
    expect(closed).toEqual(['app']);
  });

  // Req ghost-follows-you:7.8
  it('stops telling a listener that was removed', async () => {
    const t = setup();
    const extra: PipClosedBy[] = [];
    const off = t.pip.onClosed((by) => extra.push(by));
    off();
    await t.pip.open(SIZE, () => view());
    t.host.firePagehide();
    expect(extra).toEqual([]);
    expect(t.closed).toEqual(['external']);
  });
});
