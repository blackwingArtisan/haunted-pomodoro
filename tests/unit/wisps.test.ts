import { describe, expect, it } from 'vitest';
import { WISP_LIMIT, wispLine, wispsFor } from '../../src/core/wisps';

describe('will-o\'-wisps', () => {
  // Req 3.18
  it('leaves one wisp per wandering today, up to the limit', () => {
    expect(wispsFor(0)).toEqual([]);
    expect(wispsFor(1)).toHaveLength(1);
    expect(wispsFor(3)).toHaveLength(3);
    expect(wispsFor(WISP_LIMIT + 5)).toHaveLength(WISP_LIMIT);
  });

  // Req 3.18
  it('never takes a wisp away as the count grows: each count keeps every earlier wisp in place', () => {
    for (let n = 0; n < WISP_LIMIT + 3; n++) {
      const before = wispsFor(n);
      const after = wispsFor(n + 1);
      expect(after.length).toBeGreaterThanOrEqual(before.length);
      expect(after.slice(0, before.length)).toEqual(before);
    }
  });

  // Req 3.18
  it('treats a damaged count as none instead of throwing', () => {
    for (const bad of [-2, Number.NaN, Number.POSITIVE_INFINITY, -0.5]) expect(wispsFor(bad)).toEqual([]);
    expect(wispsFor(2.9)).toHaveLength(2);
  });

  // Req 3.18
  it('keeps every wisp in the upper room, clear of the portrait and inside a phone crop', () => {
    for (const w of wispsFor(WISP_LIMIT)) {
      expect(w.y).toBeLessThan(220);
      expect(w.x).toBeGreaterThanOrEqual(160);
      expect(w.x).toBeLessThanOrEqual(1040);
      const overPortrait = w.x + w.r * 4 > 504 && w.x - w.r * 4 < 696 && w.y - w.r * 4 < 276;
      expect(overPortrait, `${w.x},${w.y}`).toBe(false);
    }
  });

  // Req 3.19
  it('describes the wisps as returns, never as a count of leaving', () => {
    expect(wispLine(0)).toBeNull();
    expect(wispLine(1)).toMatch(/^One will-o'-wisp .*came back today\.$/);
    expect(wispLine(3)).toBe("Three will-o'-wisps glow near the ceiling, one for each time you came back today.");
    expect(wispLine(40)).toMatch(/^Eight will-o'-wisps/);
    for (let n = 1; n < 12; n++) expect(wispLine(n)).not.toMatch(/\b(left|wander|distract|lost|fail|only)\b/i);
  });
});
