import { describe, expect, it } from 'vitest';
import { measureLevels, toDb, waveformPeaks } from '../../src/audio/levels';
import { judge, LIMITS, type RenderedSound, SOUND_SPECS } from '../../src/audio/render';

const RATE = 1_000;

function sine(amplitude: number, seconds: number, silentTail = 0): Float32Array {
  const out = new Float32Array(Math.round((seconds + silentTail) * RATE));
  for (let i = 0; i < seconds * RATE; i++) out[i] = amplitude * Math.sin((2 * Math.PI * 50 * i) / RATE);
  return out;
}

function rendered(name: RenderedSound['spec']['name'], samples: Float32Array): RenderedSound {
  const spec = SOUND_SPECS.find((s) => s.name === name)!;
  return { spec, samples, sampleRate: RATE, levels: measureLevels(samples, RATE) };
}

describe('sound levels', () => {
  it('converts amplitude to dBFS', () => {
    expect(toDb(1)).toBe(0);
    expect(toDb(0.5)).toBeCloseTo(-6.02, 2);
    expect(toDb(0)).toBe(-Infinity);
  });

  it('measures peak, RMS, audible span and a silent tail', () => {
    const levels = measureLevels(sine(0.5, 1, 0.5), RATE);
    expect(levels.peak).toBeCloseTo(0.5, 2);
    expect(levels.peakDb).toBeCloseTo(-6.02, 1);
    // A sine's RMS is its peak over root two: 3 dB lower.
    expect(levels.rmsDb).toBeCloseTo(-9.03, 0);
    expect(levels.audibleSeconds).toBeGreaterThan(0.95);
    expect(levels.audibleSeconds).toBeLessThanOrEqual(1);
    expect(levels.tailDb).toBe(-Infinity);
    expect(levels.clippedSamples).toBe(0);
    expect(levels.invalid).toBe(false);
  });

  it('reports silence, clipping and invalid samples', () => {
    expect(measureLevels(new Float32Array(500), RATE).peakDb).toBe(-Infinity);
    expect(measureLevels(new Float32Array(500), RATE).audibleSeconds).toBe(0);
    const hot = sine(1.4, 0.5);
    expect(measureLevels(hot, RATE).clippedSamples).toBeGreaterThan(0);
    const broken = sine(0.3, 0.5);
    broken[10] = Number.NaN;
    expect(measureLevels(broken, RATE).invalid).toBe(true);
  });

  it('draws a waveform as bounded peak values', () => {
    const peaks = waveformPeaks(sine(0.8, 1, 1), 20);
    expect(peaks).toHaveLength(20);
    expect(Math.max(...peaks.slice(0, 10))).toBeCloseTo(0.8, 1);
    expect(Math.max(...peaks.slice(11))).toBe(0);
  });
});

describe('sound limits', () => {
  // Req 6.4, 6.8
  it('passes a cue that is audible, has headroom and fades out', () => {
    expect(judge(rendered('chime', sine(0.5, 1, 0.5))).ok).toBe(true);
  });

  // Req 6.4
  it('fails a cue that clips or sits at full scale', () => {
    const verdict = judge(rendered('chime', sine(1.2, 1, 0.5)));
    expect(verdict.ok).toBe(false);
    expect(verdict.notes.join(' ')).toMatch(/clipped/);
  });

  // Req 6.4
  it('fails a cue too quiet to hear, like the first rattle at -31 dBFS', () => {
    const quiet = sine(Math.pow(10, -31 / 20), 0.4, 0.5);
    const verdict = judge(rendered('rattle', quiet));
    expect(verdict.ok).toBe(false);
    expect(verdict.notes.join(' ')).toMatch(`below ${LIMITS.minPeakDb}`);
  });

  // Req 6.3, 6.8
  it('fails a one-shot that never fades, but lets the looping wind run on', () => {
    expect(judge(rendered('moan', sine(0.3, 2))).ok).toBe(false);
    expect(judge(rendered('ambient', sine(0.3, 2))).ok).toBe(true);
  });
});
