/**
 * The end-of-week postcard: a picture of the house from outside, with a lamp in every restored
 * window, the week's candles and comebacks, and a line from the ghost. This module only decides what
 * the card says and which windows glow; `src/ui/postcard.ts` draws it. Pure, so it can be tested.
 */
import type { DayKey } from './dates';
import { ROOMS, viewHouse, type HouseState } from './house';
import { hoursAndMinutes, weeklyReflection, type DayCounts } from './story';

export type PostcardWindow = 'restored' | 'today' | 'dark';

export interface Postcard {
  /** One entry per room, in room order: a lamp for each restored room, the ghost in today's. */
  windows: PostcardWindow[];
  /** Headline numbers, joined by " · ": for example "9 candles · 6 comebacks". */
  headline: string;
  /** The smaller lines under it, joined by " · ": focused time, then time away when it fell. */
  detail: string;
  /** The ghost's words, signed on the card. */
  ghostLine: string;
  /** The suggested file name, dated by the last day on the card. */
  fileName: string;
  /** "The week to 18 November 2026": the seven days the card covers. */
  dateLine: string;
}

/** What the ghost writes on the card. All of them pass the never-punish rule. */
export const POSTCARD_LINES = {
  wandered: 'You kept coming back. Every time you did, a lamp stayed lit.',
  stayed: 'You never once left me this week. I hardly know what to do with myself.',
  quiet: 'The house is quiet this week. One candle is all it takes to begin again.',
} as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function longDate(key: DayKey): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function postcardFor(days: Record<DayKey, DayCounts>, today: DayKey, house: HouseState): Postcard {
  const view = viewHouse(house);
  const litToday = (days[today]?.sessions ?? 0) > 0;
  const windows = ROOMS.map((_, i): PostcardWindow => (i < view.roomsInThisHouse ? 'restored' : i === view.roomIndex && litToday ? 'today' : 'dark'));
  const week = weeklyReflection(days, today);
  const fileName = `haunted-pomodoro-week-${today}.png`;
  const dateLine = `The week to ${longDate(today)}`;
  if (!week) {
    return { windows, headline: 'A quiet week', detail: `${plural(view.roomsInThisHouse, 'room', 'rooms')} restored so far`, ghostLine: POSTCARD_LINES.quiet, fileName, dateLine };
  }
  const headline = `${plural(week.candles, 'candle', 'candles')} · ${plural(week.wanderings, 'comeback', 'comebacks')}`;
  const fell = week.previousAwayMs !== null && week.awayMs < week.previousAwayMs && hoursAndMinutes(week.awayMs) !== hoursAndMinutes(week.previousAwayMs);
  const detail = fell
    ? `${hoursAndMinutes(week.focusMs)} focused · Time away fell from ${hoursAndMinutes(week.previousAwayMs!)} to ${hoursAndMinutes(week.awayMs)}`
    : `${hoursAndMinutes(week.focusMs)} focused · ${plural(view.roomsInThisHouse, 'room', 'rooms')} restored`;
  return { windows, headline, detail, ghostLine: week.wanderings > 0 ? POSTCARD_LINES.wandered : POSTCARD_LINES.stayed, fileName, dateLine };
}

