/**
 * The mantel always shows four candlesticks, whatever a room's size. These maps progress through
 * the room onto them: in a normal four-candle room each candlestick is one session; in the
 * one-candle demo room the four light one after another through the single session.
 */
export const MANTEL_CANDLES = 4;

export interface MantelCandles {
  /** Candlesticks fully lit. */
  lit: number;
  /** The candlestick burning now and how far it has melted (0 to 1), or null between sessions. */
  burning: { index: number; melt: number } | null;
}

/**
 * @param candlesLit candles finished in this room
 * @param perRoom candles that restore the room
 * @param progress how far the current focus session has run, 0 to 1
 * @param inSession true while a focus session is under way
 */
export function mantelCandles(candlesLit: number, perRoom: number, progress: number, inSession: boolean): MantelCandles {
  const size = Math.max(1, perRoom);
  const p = inSession ? Math.min(1, Math.max(0, progress)) : 0;
  const slots = ((candlesLit + p) / size) * MANTEL_CANDLES;
  // A small epsilon keeps 2.9999999 from reading as 2 candlesticks.
  const lit = Math.min(MANTEL_CANDLES, Math.max(0, Math.floor(slots + 1e-9)));
  if (!inSession || lit >= MANTEL_CANDLES) return { lit, burning: null };
  return { lit, burning: { index: lit, melt: Math.max(0, slots - lit) } };
}
