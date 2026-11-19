import { addDays, dayKey } from '../core/dates';
import { createModel, demoConfigFor, type AppModel, type Settings } from '../core/model';

/**
 * Which demo: the opening arc (`?demo=1`), the last room of the house (`?demo=finale`), or a house
 * with two weeks of made-up history so the weekly reflection and the postcard show (`?demo=week`).
 */
export type DemoKind = 'arc' | 'finale' | 'week';

/** Reads the demo kind from a `demo` URL parameter value: `finale` or `week` by name, anything else the arc. */
export function demoKindFrom(param: string | null): DemoKind | null {
  if (param === null) return null;
  return param === 'finale' || param === 'week' ? param : 'arc';
}

/**
 * Two invented weeks, oldest first, ending today: sessions, comebacks and minutes away each day.
 * The second week has fewer comebacks and less time away, which is the story the Hearth tells.
 */
const DEMO_FORTNIGHT: ReadonlyArray<readonly [sessions: number, comebacks: number, minutesAway: number]> = [
  [2, 3, 9],
  [3, 4, 12],
  [0, 0, 0],
  [4, 5, 14],
  [2, 2, 6],
  [3, 4, 11],
  [1, 1, 3],
  [3, 2, 4],
  [2, 1, 2],
  [4, 2, 3],
  [0, 0, 0],
  [3, 1, 1],
  [2, 1, 2],
  [2, 1, 1],
];

/**
 * The demo house: the parlor starts fully haunted, but here one candle restores a room, so a single
 * 20-second focus session carries it all the way from cold to restored. A short streak is already
 * warm. It lives in memory only; the person's own house is never touched.
 *
 * The finale demo starts in the same house with five rooms already restored and the Observatory
 * still dark, so one session restores the last room, finishes the ghost's book and begins a new house.
 *
 * The week demo has two rooms restored and two weeks of history, two sessions of them today.
 */
export function createDemoModel(now: number, settings: Settings, kind: DemoKind = 'arc'): AppModel {
  const today = dayKey(now);
  const base = createModel(now, { ...settings, autoStartBreaks: true, autoStartFocus: false }, demoConfigFor);
  const log = (sessions: number) => ({ sessions, focusMs: sessions * 25 * 60_000, distractions: 1 });
  const fortnight = Object.fromEntries(
    DEMO_FORTNIGHT.flatMap(([sessions, distractions, minutesAway], i) =>
      sessions > 0 ? [[addDays(today, i - (DEMO_FORTNIGHT.length - 1)), { sessions, focusMs: sessions * 25 * 60_000, distractions, awayMs: minutesAway * 60_000 }]] : [],
    ),
  );
  return {
    ...base,
    house: { candlesLit: 0, roomsRestored: kind === 'finale' ? 5 : kind === 'week' ? 2 : 0, candlesPerRoom: 1 },
    tasks: [
      { id: 'demo-1', title: 'Rehearse the opening monologue', estimate: 2, spent: 1, done: false, createdAt: now },
      { id: 'demo-2', title: 'Mend the velvet curtains', estimate: 1, spent: 0, done: false, createdAt: now },
      { id: 'demo-3', title: 'Order more beeswax candles', estimate: 1, spent: 1, done: true, createdAt: now },
    ],
    activeTaskId: 'demo-1',
    days:
      kind === 'week'
        ? fortnight
        : {
            [addDays(today, -5)]: log(3),
            [addDays(today, -4)]: log(2),
            [addDays(today, -2)]: log(4),
            [addDays(today, -1)]: log(1),
          },
  };
}
