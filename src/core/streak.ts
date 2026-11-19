import { addDays, daysBetween, type DayKey } from './dates';

/**
 * The hearth: a streak of days with at least one finished focus session.
 *
 * It is deliberately forgiving. Up to `graceDays` missed days between two active days keep the
 * streak alive, and a broken streak never takes away restored rooms or the best streak.
 */
export interface Streak {
  /** Active days in the current chain (0 when the hearth has gone cold). */
  current: number;
  /** Longest chain ever. */
  best: number;
  /** True when today already has a finished session. */
  litToday: boolean;
  /** The last day a session can be finished to keep the current chain. Null when there is no chain. */
  warmUntil: DayKey | null;
  /** Total days with at least one finished session. */
  activeDays: number;
}

export const DEFAULT_GRACE_DAYS = 1;

export function computeStreak(days: Iterable<DayKey>, today: DayKey, graceDays = DEFAULT_GRACE_DAYS): Streak {
  const maxGap = graceDays + 1;
  const sorted = [...new Set(days)].filter((d) => daysBetween(d, today) >= 0).sort();
  if (sorted.length === 0) {
    return { current: 0, best: 0, litToday: false, warmUntil: null, activeDays: 0 };
  }

  let best = 1;
  let chain = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1]!, sorted[i]!);
    chain = gap <= maxGap ? chain + 1 : 1;
    best = Math.max(best, chain);
  }

  const last = sorted[sorted.length - 1]!;
  const sinceLast = daysBetween(last, today);
  const alive = sinceLast <= maxGap;
  return {
    current: alive ? chain : 0,
    best,
    litToday: sinceLast === 0,
    warmUntil: alive ? addDays(last, maxGap) : null,
    activeDays: sorted.length,
  };
}
