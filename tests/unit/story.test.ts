import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/core/dates';
import { CANDLES_PER_ROOM, ROOMS, lightCandle, type HouseState } from '../../src/core/house';
import {
  ALL_RETURN_LINES,
  FOLLOW_LINES,
  JOURNAL_FINALE,
  JOURNAL_PAGES,
  diaryLine,
  followLine,
  hoursAndMinutes,
  journalFor,
  pageForRoom,
  returnLine,
  weeklyReflection,
} from '../../src/core/story';

const TODAY = '2026-11-18'; // a Wednesday
const MIN = 60_000;
const log = (sessions: number, distractions: number, minutes = sessions * 25) => ({ sessions, focusMs: minutes * MIN, distractions });

/** Words the ghost never uses: it is lonely, not hostile (the never-punish rule). */
const HARSH = /\b(fail|failed|failure|lazy|shame|ashamed|disappoint|lost|lose|punish|wasted?|guilt|bad|should have)\b/i;

describe('the ghost’s journal', () => {
  // Req 12.2, 12.3
  it('has one page per room, in room order, plus a finale', () => {
    expect(JOURNAL_PAGES.map((p) => p.roomId)).toEqual(ROOMS.map((r) => r.id));
    expect(JOURNAL_FINALE.text.length).toBeGreaterThan(40);
    for (const page of [...JOURNAL_PAGES, JOURNAL_FINALE]) expect(page.text).not.toMatch(HARSH);
  });

  // Req 12.1
  it('unlocks one page for each room restored in this house', () => {
    let house: HouseState = { candlesLit: 0, roomsRestored: 0 };
    expect(journalFor(house).pages.filter((p) => p.unlocked)).toHaveLength(0);
    for (let i = 0; i < 2 * CANDLES_PER_ROOM; i++) house = lightCandle(house).house;
    const j = journalFor(house);
    expect(j.pages.filter((p) => p.unlocked).map((p) => p.page.roomId)).toEqual(['parlor', 'library']);
    expect(j.finished).toBe(false);
  });

  // Req 12.3
  it('finishes the book with the sixth room, then starts a new house with the finale kept', () => {
    let house: HouseState = { candlesLit: CANDLES_PER_ROOM - 1, roomsRestored: ROOMS.length - 1 };
    const r = lightCandle(house);
    expect(r.houseRestored).toBe(true);
    house = r.house;
    const j = journalFor(house);
    expect(j.finished).toBe(true);
    expect(j.booksFinished).toBe(1);
    expect(j.pages.filter((p) => p.unlocked)).toHaveLength(0);
  });

  // Req 12.1
  it('finds the page a room gives back', () => {
    expect(pageForRoom('library')?.title).toBe('II. The Library');
    expect(pageForRoom('cellar')).toBeNull();
  });
});

describe('the ghost’s voice when you come back', () => {
  // Req 12.4, 12.7
  it('has about fifteen distinct lines, none of them harsh', () => {
    expect(new Set(ALL_RETURN_LINES).size).toBe(ALL_RETURN_LINES.length);
    expect(ALL_RETURN_LINES.length).toBeGreaterThanOrEqual(15);
    for (const line of ALL_RETURN_LINES) expect(line).not.toMatch(HARSH);
  });

  // Req 12.4
  it('greets the first return with a line about the room it waited in', () => {
    expect(returnLine('parlor', 1)).toBe('There you are. I kept your candle lit.');
    expect(returnLine('library', 1)).toMatch(/shelf/);
    expect(new Set(ROOMS.map((r) => returnLine(r.id, 1))).size).toBe(ROOMS.length);
  });

  // Req 12.4
  it('changes with the count and varies by room, and an unknown room falls back to the parlor', () => {
    expect(returnLine('parlor', 2)).not.toBe(returnLine('parlor', 3));
    expect(returnLine('parlor', 3)).not.toBe(returnLine('library', 3));
    expect(returnLine('parlor', 9)).toBe(returnLine('parlor', 4));
    expect(returnLine('cellar', 1)).toBe(returnLine('parlor', 1));
    expect(returnLine('parlor', 0)).toBe(returnLine('parlor', 1));
  });
});

describe('the Hearth diary', () => {
  // Req 12.5, 12.8
  it('writes about yesterday in the room’s voice', () => {
    const days = { [addDays(TODAY, -1)]: log(3, 2) };
    expect(diaryLine(days, TODAY, 'library')).toBe('Yesterday you lit three candles and left me twice. I counted the books while I waited.');
  });

  // Req 12.5, 12.7
  it('names the weekday for older days and celebrates a day without wandering', () => {
    const days = { [addDays(TODAY, -2)]: log(1, 0) };
    expect(diaryLine(days, TODAY, 'parlor')).toBe('Monday you lit one candle and never once left me. I did not know what to do with myself.');
    expect(diaryLine({ [addDays(TODAY, -3)]: log(2, 3) }, TODAY, 'parlor')).toBe('Sunday you lit two candles and left me three times. I dusted the portrait while I waited.');
  });

  // Req 12.5
  it('says nothing when there is no earlier day, and ignores today and empty days', () => {
    expect(diaryLine({}, TODAY, 'parlor')).toBeNull();
    expect(diaryLine({ [TODAY]: log(4, 1), [addDays(TODAY, -1)]: log(0, 2) }, TODAY, 'parlor')).toBeNull();
  });
});

describe('the weekly reflection', () => {
  const away = (day: ReturnType<typeof log>, minutes: number) => ({ ...day, awayMs: minutes * MIN });

  // Req 12.6, 12.8, 12.10
  it('sums the last seven days, counts comebacks and says when time away went down', () => {
    const days = {
      [TODAY]: away(log(3, 1, 75), 1),
      [addDays(TODAY, -2)]: away(log(4, 2, 100), 2),
      [addDays(TODAY, -6)]: away(log(4, 3, 100), 3),
      [addDays(TODAY, -7)]: away(log(5, 14, 125), 14), // the week before
    };
    const r = weeklyReflection(days, TODAY)!;
    expect(r).toMatchObject({ candles: 11, focusMs: 275 * MIN, wanderings: 6, previousWanderings: 14, awayMs: 6 * MIN, previousAwayMs: 14 * MIN });
    expect(r.text).toBe('This week: 11 candles, 4 h 35 min focused, 6 comebacks; time away fell from 14 min to 6 min.');
  });

  // Req 12.6, 12.7, 12.10
  it('never scolds when time away went up or there is nothing to compare', () => {
    const up = weeklyReflection({ [TODAY]: away(log(2, 5), 9), [addDays(TODAY, -8)]: away(log(2, 1), 2) }, TODAY)!;
    expect(up.text).toBe('This week: 2 candles, 50 min focused, 5 comebacks. Every candle stayed lit.');
    expect(up.text).not.toMatch(HARSH);
    const first = weeklyReflection({ [TODAY]: log(1, 0) }, TODAY)!;
    expect(first.previousWanderings).toBeNull();
    expect(first.text).toBe('This week: 1 candle, 25 min focused, and you never once left. The ghost is speechless.');
    const one = weeklyReflection({ [TODAY]: log(1, 1) }, TODAY)!;
    expect(one.text).toBe('This week: 1 candle, 25 min focused, 1 comeback. Every candle stayed lit.');
  });

  // Req 12.10
  it('compares time away only when the week before logged some, and only when the change shows', () => {
    // Saves from before time away was logged have none, so there is nothing to compare.
    const older = weeklyReflection({ [TODAY]: away(log(2, 2), 3), [addDays(TODAY, -8)]: log(2, 6) }, TODAY)!;
    expect(older.previousAwayMs).toBeNull();
    expect(older.text).toBe('This week: 2 candles, 50 min focused, 2 comebacks. Every candle stayed lit.');
    // Both weeks round to the same words: no "fell from 1 min to 1 min".
    const same = weeklyReflection({ [TODAY]: { ...log(2, 2), awayMs: 61_000 }, [addDays(TODAY, -8)]: { ...log(2, 2), awayMs: 70_000 } }, TODAY)!;
    expect(same.text).toBe('This week: 2 candles, 50 min focused, 2 comebacks. Every candle stayed lit.');
  });

  // Req 12.6
  it('is empty until the week has a session', () => {
    expect(weeklyReflection({}, TODAY)).toBeNull();
    expect(weeklyReflection({ [addDays(TODAY, -9)]: log(3, 1) }, TODAY)).toBeNull();
  });

  // Req 12.6
  it('formats hours and minutes', () => {
    expect(hoursAndMinutes(0)).toBe('0 min');
    expect(hoursAndMinutes(30_000)).toBe('under 1 min');
    expect(hoursAndMinutes(120 * MIN)).toBe('2 h');
    expect(hoursAndMinutes(275 * MIN)).toBe('4 h 35 min');
  });
});

describe('the follow window’s lines', () => {
  // Req ghost-follows-you:11.2, 11.4, 11.5
  it('are kind: no harsh word, and no mention of leaving, closing, counts or time away', () => {
    expect(FOLLOW_LINES).toHaveLength(6);
    expect(new Set(FOLLOW_LINES).size).toBe(6);
    for (const line of FOLLOW_LINES) {
      expect(line).not.toMatch(HARSH);
      expect(line).not.toMatch(/\b(left|leave|leaving|away|clos\w*|gone|miss\w*|again|\d+)\b/i);
    }
  });

  // Req ghost-follows-you:6.7
  it('gives the same line for the same minute, and is deterministic', () => {
    for (const ms of [0, 1, 59_999, 60_000, 12 * MIN + 1, 25 * MIN]) {
      expect(followLine(ms)).toBe(followLine(ms));
      expect(FOLLOW_LINES).toContain(followLine(ms));
    }
    expect(followLine(3 * MIN - 1)).toBe(followLine(2 * MIN + 1));
    expect(followLine(2 * MIN)).toBe(followLine(2 * MIN - 59_000));
    expect(followLine(MIN)).not.toBe(followLine(2 * MIN));
  });
});
