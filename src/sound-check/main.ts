import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/im-fell-english-sc/400.css';
import '../styles.css';
import './sound-check.css';
import { waveformPeaks } from '../audio/levels';
import { judge, LIMITS, renderSound, SOUND_SPECS, type RenderedSound } from '../audio/render';
import { SoundEngine } from '../audio/sound';

/**
 * The sound check page: renders every sound through the real engine into an OfflineAudioContext,
 * shows its waveform and levels, and offers a Play button to hear it through the live engine.
 * The end-to-end suite reads the same numbers from the page's data attributes.
 */

const live = new SoundEngine();
live.setVolume(0.8);
let ambientOn = false;

function fmt(db: number): string {
  return Number.isFinite(db) ? db.toFixed(1) : '-∞';
}

function waveform(rendered: RenderedSound): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const width = 320;
  const height = 64;
  const peaks = waveformPeaks(rendered.samples, width / 2);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'sc-wave');
  svg.setAttribute('aria-hidden', 'true');
  const mid = height / 2;
  const top = peaks.map((p, i) => `${i * 2},${(mid - p * mid).toFixed(1)}`);
  const bottom = peaks.map((p, i) => `${i * 2},${(mid + p * mid).toFixed(1)}`).reverse();
  const shape = document.createElementNS(ns, 'polygon');
  shape.setAttribute('points', [...top, ...bottom].join(' '));
  svg.append(shape);
  const clip = document.createElementNS(ns, 'line');
  clip.setAttribute('x1', '0');
  clip.setAttribute('x2', String(width));
  const headroom = mid - Math.pow(10, LIMITS.maxPeakDb / 20) * mid;
  clip.setAttribute('y1', headroom.toFixed(1));
  clip.setAttribute('y2', headroom.toFixed(1));
  clip.setAttribute('class', 'sc-ceiling');
  svg.append(clip);
  return svg;
}

function row(rendered: RenderedSound): HTMLLIElement {
  const { spec, levels } = rendered;
  const verdict = judge(rendered);
  const li = document.createElement('li');
  li.className = `card sc-row ${verdict.ok ? 'is-ok' : 'is-off'}`;
  li.dataset.sound = spec.name;
  li.dataset.ok = String(verdict.ok);
  li.dataset.peakDb = levels.peakDb.toFixed(2);
  li.dataset.rmsDb = levels.rmsDb.toFixed(2);
  li.dataset.tailDb = Number.isFinite(levels.tailDb) ? levels.tailDb.toFixed(2) : '-Infinity';
  li.dataset.clipped = String(levels.clippedSamples);
  li.dataset.testid = 'sound-row';

  const title = document.createElement('h2');
  title.textContent = spec.label;
  const when = document.createElement('p');
  when.className = 'sc-when';
  when.textContent = spec.when;

  const stats = document.createElement('dl');
  stats.className = 'sc-stats';
  const stat = (k: string, v: string) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    stats.append(dt, dd);
  };
  stat('Peak', `${fmt(levels.peakDb)} dBFS`);
  stat('Loudness (RMS)', `${fmt(levels.rmsDb)} dBFS`);
  stat('Audible for', spec.loops ? 'loops' : `${levels.audibleSeconds.toFixed(2)} s`);
  stat('Ending', spec.loops ? 'fades when turned off' : `${fmt(levels.tailDb)} dBFS`);

  const status = document.createElement('p');
  status.className = 'sc-verdict';
  status.textContent = verdict.ok ? 'Within limits' : verdict.notes.join('; ');

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'btn';
  if (spec.name === 'ambient') {
    play.textContent = 'Play wind';
    play.setAttribute('aria-pressed', 'false');
    play.addEventListener('click', () => {
      live.unlock();
      ambientOn = !ambientOn;
      live.setAmbient(ambientOn);
      play.textContent = ambientOn ? 'Stop wind' : 'Play wind';
      play.setAttribute('aria-pressed', String(ambientOn));
    });
  } else {
    play.textContent = 'Play';
    play.setAttribute('aria-label', `Play ${spec.label}`);
    play.addEventListener('click', () => {
      live.unlock();
      if (spec.name !== 'ambient') live.play(spec.name);
    });
  }

  const text = document.createElement('div');
  text.className = 'sc-text';
  text.append(title, when, status);
  li.append(text, waveform(rendered), stats, play);
  return li;
}

async function main(): Promise<void> {
  (document.querySelector('[data-testid="limit-min"]') as HTMLElement).textContent = String(LIMITS.minPeakDb);
  (document.querySelector('[data-testid="limit-max"]') as HTMLElement).textContent = String(LIMITS.maxPeakDb);
  (document.querySelector('[data-testid="limit-tail"]') as HTMLElement).textContent = String(LIMITS.maxTailDb);
  const list = document.querySelector('[data-testid="sounds"]') as HTMLOListElement;
  const summary = document.querySelector('[data-testid="summary"]') as HTMLElement;
  if (typeof OfflineAudioContext === 'undefined') {
    summary.textContent = 'This browser cannot render audio offline, so the levels cannot be measured here.';
    return;
  }
  const rendered: RenderedSound[] = [];
  for (const spec of SOUND_SPECS) rendered.push(await renderSound(spec));
  list.append(...rendered.map(row));
  const passing = rendered.filter((r) => judge(r).ok).length;
  summary.textContent = `${passing} of ${rendered.length} sounds within limits.`;
  summary.dataset.passing = String(passing);
  summary.dataset.total = String(rendered.length);
}

void main();
