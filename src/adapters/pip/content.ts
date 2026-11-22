/**
 * Builds the follow window's document once and afterwards writes only the values that changed.
 * No React: the window starts with none of the app's styles, scripts or fonts, so everything it
 * needs is made here with plain DOM calls. Variable text goes in with `textContent`, never `innerHTML`.
 */
import { PIP_COLORS } from './colors';
import type { PipView } from './port';

export const PIP_TITLE = 'Ottilie, keeping time';

const SVG_NS = 'http://www.w3.org/2000/svg';

const STYLE = `
:root { color-scheme: dark; }
html, body { margin: 0; height: 100%; background: ${PIP_COLORS.night}; color: ${PIP_COLORS.bone}; font-family: Georgia, serif; }
main { box-sizing: border-box; min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 12px; text-align: center; }
.ghost { width: 72px; height: 84px; flex: none; animation: bob 4s ease-in-out infinite; }
.time { margin: 0; font-size: 2.4rem; line-height: 1.1; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; color: ${PIP_COLORS.bone}; }
.phase { margin: 0; font-size: 0.95rem; color: ${PIP_COLORS.ecto}; }
.line { margin: 0; font-size: 0.95rem; font-style: italic; color: ${PIP_COLORS.bone}; }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
[data-motion='reduced'] .ghost { animation: none; }
`;

interface Parts {
  root: Element;
  ghost: Element;
  time: Element;
  phase: Element;
  paused: Element;
  line: Element;
  last: PipView | null;
}

const built = new WeakMap<object, Parts>();

function el(doc: Document, tag: string, attrs: Record<string, string> = {}): Element {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function svg(doc: Document, tag: string, attrs: Record<string, string>): Element {
  const e = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function build(doc: Document): Parts {
  const html = doc.documentElement;
  html.setAttribute('lang', 'en');
  doc.title = PIP_TITLE;
  const style = el(doc, 'style');
  style.textContent = STYLE;
  doc.head.appendChild(style);

  const ghost = svg(doc, 'svg', { class: 'ghost', viewBox: '0 0 72 84', 'aria-hidden': 'true', focusable: 'false' });
  ghost.appendChild(svg(doc, 'path', { d: 'M8 78V34C8 16 20 6 36 6s28 10 28 28v44l-9-8-9 8-10-8-10 8-9-8z', fill: PIP_COLORS.ecto }));
  ghost.appendChild(svg(doc, 'ellipse', { cx: '27', cy: '36', rx: '4', ry: '6', fill: PIP_COLORS.night }));
  ghost.appendChild(svg(doc, 'ellipse', { cx: '45', cy: '36', rx: '4', ry: '6', fill: PIP_COLORS.night }));
  ghost.appendChild(svg(doc, 'ellipse', { cx: '36', cy: '52', rx: '4', ry: '5', fill: PIP_COLORS.night }));

  const time = el(doc, 'p', { class: 'time', role: 'timer', 'aria-label': 'Time left' });
  const phase = el(doc, 'p', { class: 'phase' });
  const phaseName = el(doc, 'span', { class: 'phase-name' });
  const paused = el(doc, 'span', { class: 'paused' });
  phase.appendChild(phaseName);
  phase.appendChild(paused);
  const line = el(doc, 'p', { class: 'line' });

  const main = el(doc, 'main');
  main.appendChild(ghost);
  main.appendChild(time);
  main.appendChild(phase);
  main.appendChild(line);
  doc.body.appendChild(main);
  return { root: main, ghost, time, phase: phaseName, paused, line, last: null };
}

function setText(e: Element, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

/** Draws `view` into the window's document, building the document on the first call. */
export function renderPipDocument(doc: Document, view: PipView): void {
  let parts = built.get(doc);
  if (!parts) {
    parts = build(doc);
    built.set(doc, parts);
  }
  const last = parts.last;
  if (!last || last.still !== view.still) {
    if (view.still) parts.root.setAttribute('data-motion', 'reduced');
    else parts.root.setAttribute('data-motion', 'full');
    doc.documentElement.setAttribute('data-motion', view.still ? 'reduced' : 'full');
  }
  if (!last || last.timeLeft !== view.timeLeft) setText(parts.time, view.timeLeft);
  if (!last || last.phaseLabel !== view.phaseLabel) setText(parts.phase, view.phaseLabel);
  if (!last || last.paused !== view.paused) setText(parts.paused, view.paused ? ' · Paused' : '');
  if (!last || last.line !== view.line) setText(parts.line, view.line);
  if (!last || last.ghostOpacity !== view.ghostOpacity || last.fadeMs !== view.fadeMs) {
    parts.ghost.setAttribute('style', `opacity: ${view.ghostOpacity}; transition: opacity ${view.fadeMs}ms linear`);
  }
  parts.last = view;
}
