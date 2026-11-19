import { describe, expect, it } from 'vitest';
import { CANDLES_PER_ROOM, EMPTY_HOUSE, ROOMS, candlesPerRoom, houseScore, lightCandle, viewHouse } from '../../src/core/house';

describe('the house', () => {
  // Req 4.1
  it('lights candles in the first room', () => {
    const r = lightCandle(EMPTY_HOUSE);
    expect(r.house).toEqual({ candlesLit: 1, roomsRestored: 0 });
    expect(r.restoredRoom).toBeNull();
  });

  // Req 4.3, 4.13
  it('restores a room on the last candle and opens the next', () => {
    let house = EMPTY_HOUSE;
    let restored = null;
    for (let i = 0; i < CANDLES_PER_ROOM; i++) ({ house, restoredRoom: restored } = lightCandle(house));
    expect(restored?.id).toBe('parlor');
    expect(viewHouse(house)).toMatchObject({ roomIndex: 1, candlesLit: 0, roomsInThisHouse: 1 });
    expect(viewHouse(house).room.id).toBe('library');
  });

  // Req 4.14
  it('restores the whole house and starts another', () => {
    let house = { candlesLit: CANDLES_PER_ROOM - 1, roomsRestored: ROOMS.length - 1 };
    const r = lightCandle(house);
    expect(r.houseRestored).toBe(true);
    house = r.house;
    expect(viewHouse(house)).toMatchObject({ roomIndex: 0, housesRestored: 1 });
  });

  // Req 4.3, 9.4
  it('needs four candles per room unless the house says otherwise', () => {
    expect(candlesPerRoom(EMPTY_HOUSE)).toBe(CANDLES_PER_ROOM);
    expect(viewHouse(EMPTY_HOUSE).candlesPerRoom).toBe(CANDLES_PER_ROOM);
    expect(candlesPerRoom({ candlesLit: 0, roomsRestored: 0, candlesPerRoom: 1 })).toBe(1);
    // A damaged value falls back to the normal size rather than restoring a room with no candles.
    expect(candlesPerRoom({ candlesLit: 0, roomsRestored: 0, candlesPerRoom: 0 })).toBe(CANDLES_PER_ROOM);
    expect(candlesPerRoom({ candlesLit: 0, roomsRestored: 0, candlesPerRoom: 1.5 })).toBe(CANDLES_PER_ROOM);
  });

  // Req 9.4
  it('restores a one-candle room on its first candle and keeps the room size for the next room', () => {
    const r = lightCandle({ candlesLit: 0, roomsRestored: 0, candlesPerRoom: 1 });
    expect(r.restoredRoom?.id).toBe('parlor');
    expect(r.house).toEqual({ candlesLit: 0, roomsRestored: 1, candlesPerRoom: 1 });
    expect(lightCandle(r.house).restoredRoom?.id).toBe('library');
  });

  // Req 4.6
  it('never moves backwards, whatever the room size', () => {
    for (const size of [undefined, 1, 4, 6]) {
      let house = { candlesLit: 0, roomsRestored: 0, ...(size ? { candlesPerRoom: size } : {}) };
      for (let i = 0; i < 30; i++) {
        const next = lightCandle(house).house;
        expect(houseScore(next)).toBeGreaterThanOrEqual(houseScore(house));
        expect(next.roomsRestored).toBeGreaterThanOrEqual(house.roomsRestored);
        house = next;
      }
    }
  });

  // Req 11.4
  it('scores progress so copies can be compared', () => {
    expect(houseScore({ candlesLit: 2, roomsRestored: 3 })).toBe(3 * CANDLES_PER_ROOM + 2);
  });
});
