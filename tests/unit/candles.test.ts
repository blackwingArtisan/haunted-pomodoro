import { describe, expect, it } from 'vitest';
import { mantelCandles } from '../../src/ui/candles';

describe('candlesticks on the mantel', () => {
  it('shows one candlestick per session in a four-candle room', () => {
    expect(mantelCandles(2, 4, 0, false)).toEqual({ lit: 2, burning: null });
    expect(mantelCandles(2, 4, 0, true)).toEqual({ lit: 2, burning: { index: 2, melt: 0 } });
    const mid = mantelCandles(2, 4, 0.3, true);
    expect(mid.lit).toBe(2);
    expect(mid.burning?.index).toBe(2);
    expect(mid.burning?.melt).toBeCloseTo(0.3);
  });

  it('lights all four candlesticks through a single session in the one-candle demo room', () => {
    expect(mantelCandles(0, 1, 0, false)).toEqual({ lit: 0, burning: null });
    expect(mantelCandles(0, 1, 0.15, true).lit).toBe(0);
    expect(mantelCandles(0, 1, 0.15, true).burning?.index).toBe(0);
    expect(mantelCandles(0, 1, 0.3, true).lit).toBe(1);
    expect(mantelCandles(0, 1, 0.8, true).lit).toBe(3);
    expect(mantelCandles(0, 1, 1, true)).toEqual({ lit: 4, burning: null });
  });

  it('never shows fewer candlesticks than the candles already earned', () => {
    for (let lit = 0; lit < 4; lit++) {
      for (const p of [0, 0.25, 0.5, 0.99]) expect(mantelCandles(lit, 4, p, true).lit).toBeGreaterThanOrEqual(lit);
    }
    expect(mantelCandles(3, 4, -1, true).lit).toBe(3);
    expect(mantelCandles(3, 4, 2, true)).toEqual({ lit: 4, burning: null });
  });
});
