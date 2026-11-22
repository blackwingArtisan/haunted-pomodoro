import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAVICON_COLORS, FakeFavicon, bodyHeight, createCanvasFavicon, drawFavicon, noopFavicon, type FaviconContext } from '../../src/adapters/favicon';
import { PIP_COLORS } from '../../src/adapters/pip/colors';
import { WAX_STEPS, faviconFrame, type FaviconFrame } from '../../src/core/favicon';
import { DEFAULT_TIMER_CONFIG, initialTimer, step } from '../../src/core/timer';

interface Op {
  name: string;
  args: number[];
  fillStyle: string;
  alpha: number;
}

/** A canvas context that only records what is drawn. */
class RecordingContext {
  ops: Op[] = [];
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  globalAlpha = 1;
  private rec(name: string, args: number[] = []) {
    this.ops.push({ name, args, fillStyle: this.fillStyle, alpha: this.globalAlpha });
  }
  clearRect(...a: number[]) { this.rec('clearRect', a); }
  fillRect(...a: number[]) { this.rec('fillRect', a); }
  beginPath() { this.rec('beginPath'); }
  moveTo(...a: number[]) { this.rec('moveTo', a); }
  quadraticCurveTo(...a: number[]) { this.rec('quadraticCurveTo', a); }
  arc(...a: number[]) { this.rec('arc', a); }
  ellipse(...a: number[]) { this.rec('ellipse', a); }
  closePath() { this.rec('closePath'); }
  fill() { this.rec('fill'); }
  stroke() { this.rec('stroke'); }
}

const record = (frame: FaviconFrame) => {
  const ctx = new RecordingContext();
  drawFavicon(ctx as unknown as FaviconContext, frame);
  return ctx.ops;
};
const bodyOf = (ops: Op[]) => ops.find((o) => o.name === 'fillRect' && o.fillStyle === FAVICON_COLORS.bone)!;
const fillColors = (ops: Op[]) => new Set(ops.filter((o) => o.name === 'fill').map((o) => o.fillStyle));

/** A fake document with one icon link and a canvas that returns a distinct data URL per drawing. */
function fakeDocument(options: { canvas?: 'ok' | 'no-context' | 'throws' | 'none'; link?: boolean } = {}) {
  const attrs = new Map<string, string>([
    ['href', '/icon.svg'],
    ['type', 'image/svg+xml'],
  ]);
  const writes: Array<[string, string]> = [];
  const link = {
    getAttribute: (n: string) => attrs.get(n) ?? null,
    setAttribute: (n: string, v: string) => {
      attrs.set(n, v);
      writes.push([n, v]);
    },
  };
  let drawn = 0;
  let canvasesMade = 0;
  const doc = {
    querySelector: () => (options.link === false ? null : link),
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected ${tag}`);
      canvasesMade++;
      const ctx = new RecordingContext();
      return {
        width: 0,
        height: 0,
        getContext: () => (options.canvas === 'no-context' ? null : ctx),
        toDataURL: () => {
          if (options.canvas === 'throws') throw new Error('tainted');
          drawn++;
          return `data:image/png;base64,${encodeURIComponent(JSON.stringify(ctx.ops.slice(1)))}`;
        },
      };
    },
  } as unknown as Document;
  return { doc, attrs, writes, link, get drawn() { return drawn; }, get canvasesMade() { return canvasesMade; } };
}

describe('drawing the frames', () => {
  // Req ghost-follows-you:1.1, 1.2, 1.9
  it('shrinks the candle’s body with the wax step and always leaves a stub', () => {
    const heights = [0, 6, 12, 18, 23].map((s) => bodyOf(record({ kind: 'candle', step: s })).args[3]!);
    expect(heights).toEqual([...heights].sort((a, b) => b - a));
    expect(new Set(heights).size).toBe(heights.length);
    expect(heights[0]).toBe(18);
    expect(heights.at(-1)!).toBeGreaterThanOrEqual(3);
    expect(bodyHeight(0)).toBe(18);
    expect(bodyHeight(WAX_STEPS - 1)).toBeCloseTo(3 + 15 / 24);
    // The body's top moves down by exactly what the height lost, so the base stays put.
    const full = bodyOf(record({ kind: 'candle', step: 0 }));
    const stub = bodyOf(record({ kind: 'candle', step: 23 }));
    expect(full.args[1]! + full.args[3]!).toBe(stub.args[1]! + stub.args[3]!);
  });

  // Req ghost-follows-you:1.5
  it('draws the break frame with a ghost-green flame and a candle with a warm one', () => {
    expect(fillColors(record({ kind: 'break' })).has(FAVICON_COLORS.ecto)).toBe(true);
    expect(fillColors(record({ kind: 'break' })).has(FAVICON_COLORS.candle)).toBe(false);
    expect(fillColors(record({ kind: 'candle', step: 4 })).has(FAVICON_COLORS.candle)).toBe(true);
    expect(fillColors(record({ kind: 'candle', step: 4 })).has(FAVICON_COLORS.ecto)).toBe(false);
    // A still candle at 60% wax.
    expect(bodyOf(record({ kind: 'break' })).args[3]).toBe(12);
  });

  // Req ghost-follows-you:2.1, 2.5
  it('draws the ghost’s two faces differently, with the second stretched by two pixels', () => {
    const f0 = record({ kind: 'ghost', face: 0 });
    const f1 = record({ kind: 'ghost', face: 1 });
    expect(JSON.stringify(f0)).not.toBe(JSON.stringify(f1));
    expect(fillColors(f0).has(FAVICON_COLORS.ecto)).toBe(true);
    const eyes = (ops: Op[]) => ops.filter((o) => o.name === 'ellipse').map((o) => o.args[3]!);
    expect(eyes(f1).map((ry, i) => ry - eyes(f0)[i]!)).toEqual([1, 1, 1]);
  });

  // Req ghost-follows-you:1.9
  it('draws on a 32 by 32 canvas, clearing it first, and nothing for idle', () => {
    for (const frame of [{ kind: 'candle', step: 0 }, { kind: 'break' }, { kind: 'ghost', face: 0 }, { kind: 'idle' }] as FaviconFrame[]) {
      expect(record(frame)[0]).toMatchObject({ name: 'clearRect', args: [0, 0, 32, 32] });
    }
    expect(record({ kind: 'idle' })).toHaveLength(1);
  });
});

describe('the canvas painter', () => {
  // Req ghost-follows-you:13.4, 13.5
  it('does not draw or assign an equal frame again, and draws each distinct frame once', () => {
    const t = fakeDocument();
    const painter = createCanvasFavicon(t.doc);
    painter.show({ kind: 'candle', step: 3 });
    const writes = t.writes.length;
    expect(t.drawn).toBe(1);
    painter.show({ kind: 'candle', step: 3 });
    expect(t.writes).toHaveLength(writes);
    expect(t.drawn).toBe(1);
    painter.show({ kind: 'candle', step: 4 });
    painter.show({ kind: 'candle', step: 3 }); // back to a frame it has already drawn
    expect(t.drawn).toBe(2);
    expect(t.attrs.get('href')).toMatch(/^data:image\/png/);
    expect(t.attrs.get('type')).toBe('image/png');
    expect(t.canvasesMade).toBe(1);
  });

  // Req ghost-follows-you:1.4
  it('restores the static icon for idle without drawing', () => {
    const t = fakeDocument();
    const painter = createCanvasFavicon(t.doc);
    painter.show({ kind: 'idle' });
    expect(t.drawn).toBe(0);
    painter.show({ kind: 'candle', step: 0 });
    painter.show({ kind: 'idle' });
    expect(t.attrs.get('href')).toBe('/icon.svg');
    expect(t.attrs.get('type')).toBe('image/svg+xml');
  });

  // Req ghost-follows-you:13.4, 13.5
  it('draws at most 24 candle frames in a whole session and 28 images in a page load', () => {
    const t = fakeDocument();
    const painter = createCanvasFavicon(t.doc);
    const hrefs = new Set<string>();
    const watch = () => hrefs.add(t.attrs.get('href')!);
    const T0 = 1_700_000_000_000;
    const config = DEFAULT_TIMER_CONFIG;
    let timer = initialTimer(config);
    const draw = (now: number, hidden: boolean, reducedMotion: boolean) => {
      painter.show(faviconFrame({ timer, now, hidden, reducedMotion }));
      watch();
    };
    draw(T0, false, false);
    timer = step(timer, { type: 'start' }, T0, config).state;
    // A visible 25-minute session, polled four times a second.
    for (let now = T0; now <= T0 + config.focusMs; now += 250) draw(now, false, false);
    const candleDraws = t.drawn;
    expect(candleDraws).toBeLessThanOrEqual(WAX_STEPS);
    // Then the same session again with the page hidden half the time, a break and idle.
    timer = step(initialTimer(config), { type: 'start' }, T0, config).state;
    for (let now = T0; now <= T0 + config.focusMs; now += 250) draw(now, Math.floor(now / 60_000) % 2 === 0, false);
    timer = step(timer, { type: 'tick' }, T0 + config.focusMs, config).state;
    draw(T0 + config.focusMs + 1000, false, false);
    timer = initialTimer(config);
    draw(T0 + config.focusMs + 2000, false, false);
    expect(t.drawn).toBeLessThanOrEqual(WAX_STEPS + 2 + 1);
    expect(hrefs.size).toBeLessThanOrEqual(28);
    expect(t.attrs.get('href')).toBe('/icon.svg');
  });

  // Req ghost-follows-you:1.8
  it('keeps the static icon when there is no canvas, no 2D context, a failing toDataURL or no link', () => {
    for (const canvas of ['no-context', 'throws'] as const) {
      const t = fakeDocument({ canvas });
      const painter = createCanvasFavicon(t.doc);
      expect(() => {
        painter.show({ kind: 'candle', step: 1 });
        painter.show({ kind: 'ghost', face: 0 });
        painter.show({ kind: 'idle' });
      }).not.toThrow();
      expect(t.attrs.get('href')).toBe('/icon.svg');
      expect(t.writes.filter(([n, v]) => n === 'href' && v.startsWith('data:'))).toEqual([]);
    }
    const none = fakeDocument({ link: false });
    expect(() => createCanvasFavicon(none.doc).show({ kind: 'candle', step: 1 })).not.toThrow();
    expect(() => createCanvasFavicon(undefined).show({ kind: 'candle', step: 1 })).not.toThrow();
    expect(createCanvasFavicon(undefined)).toBe(noopFavicon);
  });

  // Req ghost-follows-you:1.9, 13.7
  it('fetches nothing: every icon it sets is a data URL', async () => {
    const real = globalThis.fetch;
    let fetched = 0;
    globalThis.fetch = (() => {
      fetched++;
      return Promise.reject(new Error('no network'));
    }) as typeof fetch;
    try {
      const t = fakeDocument();
      const painter = createCanvasFavicon(t.doc);
      for (const frame of [{ kind: 'candle', step: 0 }, { kind: 'ghost', face: 1 }, { kind: 'break' }] as FaviconFrame[]) painter.show(frame);
      for (const [name, value] of t.writes) if (name === 'href') expect(value.startsWith('data:image/png;base64,')).toBe(true);
      expect(fetched).toBe(0);
    } finally {
      globalThis.fetch = real;
    }
  });

  it('the fake painter records frames', () => {
    const fake = new FakeFavicon();
    fake.show({ kind: 'break' });
    expect(fake.frames).toEqual([{ kind: 'break' }]);
  });
});

describe('colors', () => {
  const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');
  const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)?.[1]?.toLowerCase();

  // Req ghost-follows-you:6.9
  it('the painter’s and the window’s constants equal the tokens in styles.css', () => {
    for (const [name, value] of Object.entries(FAVICON_COLORS)) expect(value, `--${name}`).toBe(token(name));
    for (const [name, value] of Object.entries(PIP_COLORS)) expect(value, `--${name}`).toBe(token(name));
  });
});
