import { describe, expect, it } from 'vitest';
import { createDemoModel, demoKindFrom } from '../../src/app/demo';
import { lightCandle, viewHouse } from '../../src/core/house';
import { createModel } from '../../src/core/model';
import { journalFor, weeklyReflection } from '../../src/core/story';
import { dayKey, lastDays } from '../../src/core/dates';

const now = Date.UTC(2026, 9, 31, 18, 0);
const settings = createModel(now).settings;

describe('demo kinds', () => {
  // Req 9.7
  it('reads the kind from the demo URL parameter', () => {
    expect(demoKindFrom(null)).toBeNull();
    expect(demoKindFrom('1')).toBe('arc');
    expect(demoKindFrom('')).toBe('arc');
    expect(demoKindFrom('finale')).toBe('finale');
    expect(demoKindFrom('week')).toBe('week');
  });

  // Req 9.4
  it('the arc demo starts in a fully haunted parlor', () => {
    const view = viewHouse(createDemoModel(now, settings).house);
    expect(view.room.name).toBe('The Parlor');
    expect(view.roomsInThisHouse).toBe(0);
  });

  // Req 9.7
  it('the finale demo starts in the last room, and one candle finishes the house and the book', () => {
    const model = createDemoModel(now, settings, 'finale');
    const before = viewHouse(model.house);
    expect(before.room.name).toBe('The Observatory');
    expect(before.roomsInThisHouse).toBe(5);
    expect(journalFor(model.house).finished).toBe(false);

    const lit = lightCandle(model.house);
    expect(lit.restoredRoom?.name).toBe('The Observatory');
    expect(lit.houseRestored).toBe(true);
    const after = viewHouse(lit.house);
    expect(after.housesRestored).toBe(1);
    expect(after.room.name).toBe('The Parlor');
    expect(journalFor(lit.house).finished).toBe(true);
  });

  // Req 9.2, 9.7
  it('keeps the rest of the demo house the same as the arc', () => {
    const arc = createDemoModel(now, settings, 'arc');
    const finale = createDemoModel(now, settings, 'finale');
    expect(finale.tasks).toEqual(arc.tasks);
    expect(finale.days).toEqual(arc.days);
    expect(finale.house.candlesPerRoom).toBe(1);
  });

  // Req 9.9
  it('the week demo has two rooms restored and two invented weeks in which comebacks and time away fall', () => {
    const model = createDemoModel(now, settings, 'week');
    expect(viewHouse(model.house).roomsInThisHouse).toBe(2);
    const today = dayKey(now);
    const fortnight = lastDays(today, 14);
    expect(Object.keys(model.days).every((d) => fortnight.includes(d))).toBe(true);
    expect(Object.keys(model.days).length).toBeGreaterThanOrEqual(10);
    expect(model.days[today]?.sessions).toBeGreaterThan(0);
    const week = weeklyReflection(model.days, today)!;
    expect(week.wanderings).toBeLessThan(week.previousWanderings!);
    expect(week.awayMs).toBeLessThan(week.previousAwayMs!);
    expect(week.text).toContain('time away fell from 55 min to 13 min');
  });
});
