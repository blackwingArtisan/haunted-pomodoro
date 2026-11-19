import { addDays, dayKey } from '../core/dates';
import { createModel, demoConfigFor, type AppModel, type Settings } from '../core/model';

/**
 * The demo house: the parlor starts fully haunted, but here one candle restores a room, so a single
 * 20-second focus session carries it all the way from cold to restored. A short streak is already
 * warm. It lives in memory only; the person's own house is never touched.
 */
export function createDemoModel(now: number, settings: Settings): AppModel {
  const today = dayKey(now);
  const base = createModel(now, { ...settings, autoStartBreaks: true, autoStartFocus: false }, demoConfigFor);
  const log = (sessions: number) => ({ sessions, focusMs: sessions * 25 * 60_000, distractions: 1 });
  return {
    ...base,
    house: { candlesLit: 0, roomsRestored: 0, candlesPerRoom: 1 },
    tasks: [
      { id: 'demo-1', title: 'Rehearse the opening monologue', estimate: 2, spent: 1, done: false, createdAt: now },
      { id: 'demo-2', title: 'Mend the velvet curtains', estimate: 1, spent: 0, done: false, createdAt: now },
      { id: 'demo-3', title: 'Order more beeswax candles', estimate: 1, spent: 1, done: true, createdAt: now },
    ],
    activeTaskId: 'demo-1',
    days: {
      [addDays(today, -5)]: log(3),
      [addDays(today, -4)]: log(2),
      [addDays(today, -2)]: log(4),
      [addDays(today, -1)]: log(1),
    },
  };
}
