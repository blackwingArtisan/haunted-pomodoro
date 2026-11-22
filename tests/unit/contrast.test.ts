import { describe, expect, it } from 'vitest';
import { PIP_COLORS } from '../../src/adapters/pip/colors';

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('the follow window contrast', () => {
  // Req ghost-follows-you:10.7
  it('keeps its text at 4.5 to 1 or more against the background', () => {
    expect(ratio(PIP_COLORS.bone, PIP_COLORS.night)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(PIP_COLORS.ecto, PIP_COLORS.night)).toBeGreaterThanOrEqual(4.5);
  });
});
