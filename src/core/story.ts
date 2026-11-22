/**
 * The house's story and the ghost's voice. All of it is data and pure functions: no clock, no
 * network, no randomness, so the same house always reads the same way and every line can be tested.
 *
 * The ghost is Ottilie Vane, the house's last owner, who was writing a book when the lamps went
 * out. Each restored room gives back one page. She is lonely, never hostile: every line here has
 * to pass the never-punish rule in .kiro/steering/product.md.
 */
import { addDays, lastDays, weekdayName, type DayKey } from './dates';
import { ROOMS, viewHouse, type HouseState } from './house';

export const BOOK_TITLE = 'A Lamp for Every Window';

export interface JournalPage {
  roomId: string;
  title: string;
  text: string;
}

/** One page per room, in the order the rooms are restored. */
export const JOURNAL_PAGES: readonly JournalPage[] = [
  {
    roomId: 'parlor',
    title: 'I. The Parlor',
    text: 'I began this book the winter the lamps went out. I meant to write one page a night by the parlor fire, and I wrote exactly one. Then the house went cold, and so, somehow, did I. Thank you for the fire. Here is that first page again.',
  },
  {
    roomId: 'library',
    title: 'II. The Library',
    text: 'Every book in this room was a promise to finish mine. I turned their spines to the wall so they would stop asking. You sat with them until they faced out again. I think they forgive me. I am trying to.',
  },
  {
    roomId: 'conservatory',
    title: 'III. The Conservatory',
    text: 'A fern does not grow because you glare at it. It grows because you come back, mostly at the same hour, with a little water. I wrote that in the margin forty years ago and never believed it until you kept coming back.',
  },
  {
    roomId: 'music-room',
    title: 'IV. The Music Room',
    text: 'I played one note at midnight for so long that I forgot there were others. Scales are only small returns, done in order. You wander and you come back; that is a scale too. The piano is tuned now. So, a little, am I.',
  },
  {
    roomId: 'nursery',
    title: 'V. The Nursery',
    text: 'The rocking horse kept rocking because nobody told it the child had grown up and gone. Nobody tells you, either, when a habit has quietly taken hold. I am telling you now. It has.',
  },
  {
    roomId: 'observatory',
    title: 'VI. The Observatory',
    text: 'The stars were never smudged. My lens was. Every night you lit a candle I could see one more of them. Tonight I can see all of them, and the last page is easy to write.',
  },
];

export const JOURNAL_FINALE: JournalPage = {
  roomId: 'finale',
  title: 'The last page',
  text: 'A lamp for every window, and a reader in every chair. The book is finished, and I can rest. Another house down the lane has gone dark; its ghost is shyer than me. Be patient with her. You were patient with me.',
};

export interface JournalView {
  /** Pages for the house being restored now; locked pages carry no text. */
  pages: Array<{ page: JournalPage; unlocked: boolean; roomName: string }>;
  /** True once at least one whole house, and so the whole book, has been finished. */
  finished: boolean;
  /** How many times the book has been finished. */
  booksFinished: number;
}

/** The journal for this house: one page per restored room, the finale once any house is complete. */
export function journalFor(house: HouseState): JournalView {
  const view = viewHouse(house);
  return {
    pages: JOURNAL_PAGES.map((page, i) => ({ page, unlocked: i < view.roomsInThisHouse, roomName: ROOMS[i]!.name })),
    finished: view.housesRestored > 0,
    booksFinished: view.housesRestored,
  };
}

/** The page a room gives back when it is restored. */
export function pageForRoom(roomId: string): JournalPage | null {
  return JOURNAL_PAGES.find((p) => p.roomId === roomId) ?? null;
}

/* ------------------------------------------------------------------ The ghost's voice */

/** The first time you come back in a session, the ghost says something about the room it waited in. */
const FIRST_RETURN: Record<string, string> = {
  parlor: 'There you are. I kept your candle lit.',
  library: 'Back already? I only got through one shelf.',
  conservatory: 'You came back. The ferns noticed before I did.',
  'music-room': 'There you are. I was humming your candle along.',
  nursery: 'Shh, you are back. The horse and I kept very still.',
  observatory: 'There you are. I counted three new stars while you were out.',
};

/** Later returns in the same session. Three lines each, chosen by room so every house sounds different. */
const SECOND_RETURN = [
  'Wandering again? The flame waited for you.',
  'Twice now. I do not mind. I like the company.',
  'Welcome back. The wax barely moved.',
] as const;
const THIRD_RETURN = [
  'Three times now. Shall we finish this one together?',
  'Third time back. I saved your seat by the fire.',
  'There you are again. I think the candle likes you.',
] as const;
const LATER_RETURN = [
  'I will just sit here, very close, until the candle is done.',
  'However often you leave, I will be here when you come back.',
  'Every return counts. Let us see this candle through.',
] as const;

/** Every line the ghost can say when you come back, for review and tests. */
export const ALL_RETURN_LINES: readonly string[] = [...Object.values(FIRST_RETURN), ...SECOND_RETURN, ...THIRD_RETURN, ...LATER_RETURN];

/** What Ottilie says in the small follow window. None of it mentions leaving, closing, counts or time away. */
export const FOLLOW_LINES: readonly string[] = [
  'I came along. Your candle is still burning.',
  'Take your time. I will keep the light.',
  'Nothing here needs hurrying.',
  'I am right here, humming by the window.',
  'Every minute is a small lamp.',
  'Work well. I will keep the lamp.',
];

/** One line per minute of time left, so the same minute always reads the same. */
export function followLine(remainingMs: number): string {
  const minutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  return FOLLOW_LINES[minutes % FOLLOW_LINES.length] ?? FOLLOW_LINES[0]!;
}

/** What the ghost says when you come back for the `count`-th time this session, in this room. */
export function returnLine(roomId: string, count: number): string {
  const roomIndex = Math.max(0, ROOMS.findIndex((r) => r.id === roomId));
  if (count <= 1) return FIRST_RETURN[roomId] ?? FIRST_RETURN.parlor!;
  const pool = count === 2 ? SECOND_RETURN : count === 3 ? THIRD_RETURN : LATER_RETURN;
  return pool[roomIndex % pool.length]!;
}

/* ------------------------------------------------------------------ The Hearth diary */

export interface DayCounts {
  sessions: number;
  focusMs: number;
  distractions: number;
  awayMs?: number;
}

const FULL_WEEKDAY: Record<string, string> = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};

/** What the ghost did while it waited, by room. */
const WHILE_WAITING: Record<string, string> = {
  parlor: 'I dusted the portrait while I waited.',
  library: 'I counted the books while I waited.',
  conservatory: 'I watered the ferns while I waited.',
  'music-room': 'I practised my one note while I waited.',
  nursery: 'I sang the horse to sleep while I waited.',
  observatory: 'I named a star after you while I waited.',
};

const SMALL_NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function inWords(n: number): string {
  return SMALL_NUMBERS[n] ?? String(n);
}
function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${inWords(n)} times`;
}

/**
 * One diary line from the most recent earlier day with any focus, in the ghost's voice. Null when
 * there is no earlier day to write about. It reports, it never scolds.
 */
export function diaryLine(days: Record<DayKey, DayCounts>, today: DayKey, roomId: string): string | null {
  for (let back = 1; back <= 14; back++) {
    const key = addDays(today, -back);
    const day = days[key];
    if (!day || day.sessions <= 0) continue;
    const when = back === 1 ? 'Yesterday' : (FULL_WEEKDAY[weekdayName(key)] ?? 'That day');
    const candles = `${inWords(day.sessions)} ${day.sessions === 1 ? 'candle' : 'candles'}`;
    if (day.distractions <= 0) return `${when} you lit ${candles} and never once left me. I did not know what to do with myself.`;
    return `${when} you lit ${candles} and left me ${times(day.distractions)}. ${WHILE_WAITING[roomId] ?? WHILE_WAITING.parlor}`;
  }
  return null;
}

/* ------------------------------------------------------------------ Weekly reflection */

export interface WeeklyReflection {
  candles: number;
  focusMs: number;
  /** Counted wanderings this week. Each one ended in a return, so the reflection calls them comebacks. */
  wanderings: number;
  /** Wanderings in the seven days before; null when that week had no sessions to compare with. */
  previousWanderings: number | null;
  /** Time away this week, across the counted wanderings. */
  awayMs: number;
  /** Time away in the seven days before; null when that week had no sessions or no time away logged. */
  previousAwayMs: number | null;
  /** The whole reflection as one sentence. */
  text: string;
}

/** "4 h 35 min", "50 min", "under 1 min". */
export function hoursAndMinutes(ms: number): string {
  if (ms > 0 && ms < 60_000) return 'under 1 min';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${Math.floor(minutes / 60)} h`;
}

function sum(days: Record<DayKey, DayCounts>, keys: DayKey[]): DayCounts {
  return keys.reduce<DayCounts>(
    (acc, k) => {
      const d = days[k];
      return d
        ? { sessions: acc.sessions + d.sessions, focusMs: acc.focusMs + d.focusMs, distractions: acc.distractions + d.distractions, awayMs: (acc.awayMs ?? 0) + (d.awayMs ?? 0) }
        : acc;
    },
    { sessions: 0, focusMs: 0, distractions: 0, awayMs: 0 },
  );
}

/**
 * The last seven days, today included, against the seven before. It counts comebacks, not
 * distractions, and the number it lets fall is the time away: when that went down it says so; when
 * it went up it says only what was kept. Null when the week has no sessions yet.
 */
export function weeklyReflection(days: Record<DayKey, DayCounts>, today: DayKey): WeeklyReflection | null {
  const week = sum(days, lastDays(today, 7));
  if (week.sessions <= 0) return null;
  const before = sum(days, lastDays(addDays(today, -7), 7));
  const previousWanderings = before.sessions > 0 ? before.distractions : null;
  const awayMs = week.awayMs ?? 0;
  const previousAwayMs = before.sessions > 0 && (before.awayMs ?? 0) > 0 ? (before.awayMs ?? 0) : null;
  const head = `This week: ${week.sessions} ${week.sessions === 1 ? 'candle' : 'candles'}, ${hoursAndMinutes(week.focusMs)} focused`;
  let text: string;
  if (week.distractions === 0) text = `${head}, and you never once left. The ghost is speechless.`;
  else {
    const comebacks = `${head}, ${week.distractions} ${week.distractions === 1 ? 'comeback' : 'comebacks'}`;
    if (previousAwayMs !== null && awayMs < previousAwayMs && hoursAndMinutes(awayMs) !== hoursAndMinutes(previousAwayMs)) text = `${comebacks}; time away fell from ${hoursAndMinutes(previousAwayMs)} to ${hoursAndMinutes(awayMs)}.`;
    else text = `${comebacks}. Every candle stayed lit.`;
  }
  return { candles: week.sessions, focusMs: week.focusMs, wanderings: week.distractions, previousWanderings, awayMs, previousAwayMs, text };
}
