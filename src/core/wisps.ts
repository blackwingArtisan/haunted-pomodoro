/**
 * Will-o'-wisps: the visible side of forgiveness. Every time the person wanders off and comes back
 * during focus, the ghost leaves a small light in the room. A wandering is shown as a return, never
 * as a mark against anyone, and nothing here ever takes a light away within a day: the wisps for a
 * count are always the wisps for any smaller count plus new ones.
 *
 * Pure: the count comes in, positions come out. The scene draws them; the scene label describes them.
 */

export interface Wisp {
  /** Position in the scene's 1200x700 viewBox. */
  x: number;
  y: number;
  /** Radius of the bright core. */
  r: number;
  /** Seconds of offset into the shared float animation, so the wisps do not bob in step. */
  phase: number;
}

/**
 * Spots in the upper room, clear of the portrait (x 504 to 696) and of the ghost's waking spots, and
 * inside x 160 to 1040 so a phone's crop of the scene still shows them. Filled in this order.
 */
const SPOTS: ReadonlyArray<readonly [number, number]> = [
  [262, 96],
  [930, 120],
  [170, 150],
  [770, 40],
  [400, 70],
  [820, 78],
  [350, 190],
  [1000, 64],
];

/** More wanderings than this still show this many wisps; the room stays readable. */
export const WISP_LIMIT = SPOTS.length;

/** A whole, non-negative count; anything else counts as none. */
function wholeCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The wisps for a day with `wanderings` returns: one each, up to WISP_LIMIT. */
export function wispsFor(wanderings: number): Wisp[] {
  const count = Math.min(WISP_LIMIT, wholeCount(wanderings));
  return SPOTS.slice(0, count).map(([x, y], i) => ({ x, y, r: i % 3 === 0 ? 8.5 : i % 3 === 1 ? 7 : 7.6, phase: -1.7 * i }));
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/**
 * One sentence for the scene's accessible label, or null with no wisps. It thanks the person for coming
 * back; it never counts the leaving.
 */
export function wispLine(wanderings: number): string | null {
  const n = wholeCount(wanderings);
  if (n === 0) return null;
  if (n === 1) return 'One will-o\'-wisp glows near the ceiling, lit for the time you came back today.';
  const shown = Math.min(n, WISP_LIMIT);
  const word = COUNT_WORDS[shown] ?? String(shown);
  return `${word[0]!.toUpperCase()}${word.slice(1)} will-o'-wisps glow near the ceiling, one for each time you came back today.`;
}
