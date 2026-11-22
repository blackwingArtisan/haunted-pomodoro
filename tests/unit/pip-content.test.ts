import { describe, expect, it } from 'vitest';
import { PIP_TITLE, renderPipDocument } from '../../src/adapters/pip/content';
import type { PipView } from '../../src/adapters/pip';

/** A tiny element that records every write made to it. */
class RecEl {
  attrs: Record<string, string> = {};
  children: RecEl[] = [];
  textWrites = 0;
  attrWrites = 0;
  private text = '';
  constructor(readonly tag: string) {}
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
    this.attrWrites++;
  }
  appendChild(c: RecEl) {
    this.children.push(c);
    return c;
  }
  get textContent() {
    return this.text;
  }
  set textContent(v: string) {
    this.text = v;
    this.textWrites++;
  }
  find(pred: (e: RecEl) => boolean): RecEl | undefined {
    if (pred(this)) return this;
    for (const c of this.children) {
      const f = c.find(pred);
      if (f) return f;
    }
    return undefined;
  }
}

class RecDoc {
  title = '';
  documentElement = new RecEl('html');
  head = new RecEl('head');
  body = new RecEl('body');
  createElement(tag: string) {
    return new RecEl(tag);
  }
  createElementNS(_ns: string, tag: string) {
    return new RecEl(tag);
  }
  byClass(c: string) {
    return this.body.find((e) => e.attrs.class === c)!;
  }
}

const view = (patch: Partial<PipView> = {}): PipView => ({
  timeLeft: '12:34',
  phaseLabel: 'Focus',
  paused: false,
  line: 'Nothing here needs hurrying.',
  ghostOpacity: 0.25,
  fadeMs: 600,
  still: false,
  ...patch,
});

const render = (doc: RecDoc, v: PipView) => renderPipDocument(doc as unknown as Document, v);

describe('renderPipDocument', () => {
  // Req ghost-follows-you:6.1, 6.9, 10.6
  it('builds the structure once, with language, title, timer role and a hidden picture', () => {
    const doc = new RecDoc();
    render(doc, view());
    expect(doc.documentElement.attrs.lang).toBe('en');
    expect(doc.title).toBe(PIP_TITLE);
    expect(PIP_TITLE).toBe('Ottilie, keeping time');
    const time = doc.byClass('time');
    expect(time.attrs.role).toBe('timer');
    expect(time.attrs['aria-label']).toBe('Time left');
    expect(time.textContent).toBe('12:34');
    expect(doc.byClass('ghost').attrs['aria-hidden']).toBe('true');
    expect(doc.byClass('phase').find((e) => e.attrs.class === 'phase-name')!.textContent).toBe('Focus');
    expect(doc.byClass('line').textContent).toBe('Nothing here needs hurrying.');
    expect(doc.head.children.filter((c) => c.tag === 'style')).toHaveLength(1);
    render(doc, view({ timeLeft: '12:33' }));
    expect(doc.body.children).toHaveLength(1);
    expect(doc.head.children).toHaveLength(1);
  });

  // Req ghost-follows-you:6.1
  it('sets text with textContent, so markup in a value stays text', () => {
    const doc = new RecDoc();
    render(doc, view({ line: '<img src=x onerror=alert(1)>' }));
    expect(doc.byClass('line').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(doc.byClass('line').children).toHaveLength(0);
  });

  // Req ghost-follows-you:6.5, 6.9
  it('writes only the values that changed', () => {
    const doc = new RecDoc();
    render(doc, view());
    const time = doc.byClass('time');
    const line = doc.byClass('line');
    const ghost = doc.byClass('ghost');
    const before = { t: time.textWrites, l: line.textWrites, g: ghost.attrWrites };
    render(doc, view({ timeLeft: '12:33' }));
    expect(time.textWrites).toBe(before.t + 1);
    expect(line.textWrites).toBe(before.l);
    expect(ghost.attrWrites).toBe(before.g);
    render(doc, view({ timeLeft: '12:33' }));
    expect(time.textWrites).toBe(before.t + 1);
  });

  // Req ghost-follows-you:6.5, 6.8
  it('sets the ghost opacity from the view while the time and line stay unstyled, and shows Paused', () => {
    const doc = new RecDoc();
    render(doc, view({ ghostOpacity: 1 }));
    expect(doc.byClass('ghost').attrs.style).toContain('opacity: 1');
    expect(doc.byClass('ghost').attrs.style).toContain('600ms');
    render(doc, view({ ghostOpacity: 0.25, paused: true }));
    expect(doc.byClass('ghost').attrs.style).toContain('opacity: 0.25');
    expect(doc.byClass('time').attrs.style).toBeUndefined();
    expect(doc.byClass('line').attrs.style).toBeUndefined();
    expect(doc.byClass('phase').find((e) => e.attrs.class === 'paused')!.textContent).toContain('Paused');
    render(doc, view({ paused: false }));
    expect(doc.byClass('phase').find((e) => e.attrs.class === 'paused')!.textContent).toBe('');
  });

  // Req ghost-follows-you:9.3, 9.4
  it('follows reduced motion with data-motion and no fade time', () => {
    const doc = new RecDoc();
    render(doc, view());
    expect(doc.documentElement.attrs['data-motion']).toBe('full');
    render(doc, view({ still: true, fadeMs: 0 }));
    expect(doc.documentElement.attrs['data-motion']).toBe('reduced');
    expect(doc.byClass('ghost').attrs.style).toContain('0ms');
    expect(doc.body.children[0]!.attrs['data-motion']).toBe('reduced');
  });
});
