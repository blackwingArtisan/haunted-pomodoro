import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/core/dates';
import { POSTCARD_LINES, postcardFor } from '../../src/core/postcard';

const TODAY = '2026-11-18';
const MIN = 60_000;
const day = (sessions: number, distractions: number, minutesAway = 0) => ({ sessions, focusMs: sessions * 25 * MIN, distractions, awayMs: minutesAway * MIN });

/** Words the ghost never uses: it is lonely, not hostile (the never-punish rule). */
const HARSH = /\b(fail|failed|failure|lazy|shame|ashamed|disappoint|lost|lose|punish|wasted?|guilt|bad|should have)\b/i;

describe('the end-of-week postcard', () => {
  // Req 12.11
  it('lights a lamp in every restored window and puts the ghost in the room lit today', () => {
    const card = postcardFor({ [TODAY]: day(1, 0) }, TODAY, { candlesLit: 1, roomsRestored: 2 });
    expect(card.windows).toEqual(['restored', 'restored', 'today', 'dark', 'dark', 'dark']);
    const quietToday = postcardFor({ [addDays(TODAY, -1)]: day(1, 0) }, TODAY, { candlesLit: 0, roomsRestored: 2 });
    expect(quietToday.windows[2]).toBe('dark');
    // A second house starts dark again.
    expect(postcardFor({}, TODAY, { candlesLit: 0, roomsRestored: 7 }).windows).toEqual(['restored', 'dark', 'dark', 'dark', 'dark', 'dark']);
  });

  // Req 12.11
  it('leads with the week’s candles and comebacks, and says when time away fell', () => {
    const days = {
      [addDays(TODAY, -10)]: day(3, 5, 30),
      [addDays(TODAY, -3)]: day(4, 2, 6),
      [TODAY]: day(2, 1, 2),
    };
    const card = postcardFor(days, TODAY, { candlesLit: 0, roomsRestored: 1 });
    expect(card.headline).toBe('6 candles · 3 comebacks');
    expect(card.detail).toBe('2 h 30 min focused · Time away fell from 30 min to 8 min');
    expect(card.ghostLine).toBe(POSTCARD_LINES.wandered);
    expect(card.dateLine).toBe('The week to 18 November 2026');
    expect(card.fileName).toBe('haunted-pomodoro-week-2026-11-18.png');
  });

  // Req 12.11
  it('says what was kept when time away did not fall, and has a line for a week without wandering', () => {
    const rose = postcardFor({ [addDays(TODAY, -9)]: day(1, 1, 2), [TODAY]: day(1, 1, 9) }, TODAY, { candlesLit: 0, roomsRestored: 3 });
    expect(rose.headline).toBe('1 candle · 1 comeback');
    expect(rose.detail).toBe('25 min focused · 3 rooms restored');
    const stayed = postcardFor({ [TODAY]: day(2, 0) }, TODAY, { candlesLit: 0, roomsRestored: 1 });
    expect(stayed.ghostLine).toBe(POSTCARD_LINES.stayed);
    expect(stayed.detail).toBe('50 min focused · 1 room restored');
  });

  // Req 12.11
  it('still reads kindly for a week with no sessions, and no line on it is harsh', () => {
    const quiet = postcardFor({}, TODAY, { candlesLit: 0, roomsRestored: 0 });
    expect(quiet.headline).toBe('A quiet week');
    expect(quiet.ghostLine).toBe(POSTCARD_LINES.quiet);
    for (const line of Object.values(POSTCARD_LINES)) expect(line).not.toMatch(HARSH);
  });
});
