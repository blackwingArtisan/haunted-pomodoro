import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/core/clock';
import { addDays, dayKey, daysBetween, isDayKey, lastDays } from '../../src/core/dates';
import { computeStreak } from '../../src/core/streak';

describe('day keys', () => {
  it('uses the local calendar day', () => {
    const clock = new ManualClock(new Date(2026, 10, 18, 23, 59).getTime());
    expect(dayKey(clock.now())).toBe('2026-11-18');
    clock.advance(2 * 60_000);
    expect(dayKey(clock.now())).toBe('2026-11-19');
  });

  it('counts days across month, year and daylight-saving boundaries', () => {
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(lastDays('2026-11-02', 3)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('validates keys', () => {
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-2-3')).toBe(false);
    expect(isDayKey('2026-11-18')).toBe(true);
  });
});

describe('the hearth streak', () => {
  it('is cold with no history', () => {
    expect(computeStreak([], '2026-11-18')).toEqual({ current: 0, best: 0, litToday: false, warmUntil: null, activeDays: 0 });
  });

  it('counts consecutive days', () => {
    const s = computeStreak(['2026-11-16', '2026-11-17', '2026-11-18'], '2026-11-18');
    expect(s).toMatchObject({ current: 3, best: 3, litToday: true, warmUntil: '2026-11-20' });
  });

  it('stays warm before today is lit', () => {
    const s = computeStreak(['2026-11-16', '2026-11-17'], '2026-11-18');
    expect(s).toMatchObject({ current: 2, litToday: false, warmUntil: '2026-11-19' });
  });

  it('forgives one missed day between active days', () => {
    const s = computeStreak(['2026-11-14', '2026-11-16', '2026-11-18'], '2026-11-18');
    expect(s.current).toBe(3);
  });

  it('survives one missed day before today', () => {
    expect(computeStreak(['2026-11-15', '2026-11-16'], '2026-11-18').current).toBe(2);
  });

  it('goes cold after two missed days but keeps the best streak', () => {
    const s = computeStreak(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'], '2026-11-16');
    expect(s).toMatchObject({ current: 0, best: 4, warmUntil: null, activeDays: 4 });
  });

  it('starts a new chain after a long gap', () => {
    const s = computeStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-17', '2026-11-18'], '2026-11-18');
    expect(s).toMatchObject({ current: 2, best: 3 });
  });

  it('honours a custom grace and ignores duplicates and future days', () => {
    expect(computeStreak(['2026-11-10', '2026-11-13'], '2026-11-13', 2).current).toBe(2);
    expect(computeStreak(['2026-11-18', '2026-11-18', '2026-11-25'], '2026-11-18')).toMatchObject({ current: 1, activeDays: 1 });
  });

  it('moves with an injectable clock across days', () => {
    const clock = new ManualClock(new Date(2026, 10, 16, 9).getTime());
    const days = [dayKey(clock.now())];
    clock.advance(86_400_000);
    days.push(dayKey(clock.now()));
    clock.advance(2 * 86_400_000);
    expect(computeStreak(days, dayKey(clock.now())).current).toBe(2);
    clock.advance(86_400_000);
    expect(computeStreak(days, dayKey(clock.now())).current).toBe(0);
  });
});
