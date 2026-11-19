/**
 * Plain-number measurements of a rendered sound, used by the sound check page and its tests.
 * Pure functions over samples: no Web Audio here, so they run in unit tests too.
 */

export interface Levels {
  /** Largest absolute sample, 0..1 (1 is full scale). */
  peak: number;
  /** Peak in dB relative to full scale. -Infinity for silence. */
  peakDb: number;
  /** Root-mean-square level of the audible part, in dBFS. -Infinity for silence. */
  rmsDb: number;
  /** Seconds from the first to the last sample above the audibility floor. */
  audibleSeconds: number;
  /** Largest absolute sample in the final tail window, in dBFS. A clean ending is far below the peak. */
  tailDb: number;
  /** Samples at or above full scale, which would clip on output. */
  clippedSamples: number;
  /** True when any sample is NaN or infinite (a broken graph). */
  invalid: boolean;
}

/** -60 dBFS: quieter than this counts as silence for the audible span. */
export const AUDIBLE_FLOOR = 0.001;

export function toDb(amplitude: number): number {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity;
}

export function measureLevels(samples: Float32Array, sampleRate: number, tailSeconds = 0.25): Levels {
  let peak = 0;
  let first = -1;
  let last = -1;
  let clippedSamples = 0;
  let invalid = false;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    if (!Number.isFinite(v)) {
      invalid = true;
      continue;
    }
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a >= 1) clippedSamples++;
    if (a >= AUDIBLE_FLOOR) {
      if (first < 0) first = i;
      last = i;
    }
  }

  let sumSquares = 0;
  let count = 0;
  if (first >= 0) {
    for (let i = first; i <= last; i++) {
      const v = samples[i] ?? 0;
      if (!Number.isFinite(v)) continue;
      sumSquares += v * v;
      count++;
    }
  }
  const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;

  const tailStart = Math.max(0, samples.length - Math.round(tailSeconds * sampleRate));
  let tailPeak = 0;
  for (let i = tailStart; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    if (Number.isFinite(v)) tailPeak = Math.max(tailPeak, Math.abs(v));
  }

  return {
    peak,
    peakDb: toDb(peak),
    rmsDb: toDb(rms),
    audibleSeconds: first >= 0 ? (last - first + 1) / sampleRate : 0,
    tailDb: toDb(tailPeak),
    clippedSamples,
    invalid,
  };
}

/** Down-samples a sound to `points` peak values (0..1) for drawing a waveform. */
export function waveformPeaks(samples: Float32Array, points: number): number[] {
  const size = Math.max(1, Math.floor(samples.length / points));
  const out: number[] = [];
  for (let p = 0; p < points; p++) {
    let max = 0;
    const end = Math.min(samples.length, (p + 1) * size);
    for (let i = p * size; i < end; i++) {
      const a = Math.abs(samples[i] ?? 0);
      if (Number.isFinite(a) && a > max) max = a;
    }
    out.push(Math.min(1, max));
  }
  return out;
}
