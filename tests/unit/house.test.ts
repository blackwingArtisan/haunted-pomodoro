import { describe, expect, it } from 'vitest';
import { CANDLES_PER_ROOM, EMPTY_HOUSE, ROOMS, houseScore, lightCandle, viewHouse } from '../../src/core/house';

describe('the house', () => {
  it('lights candles in the first room', () => {
    const r = lightCandle(EMPTY_HOUSE);
    expect(r.house).toEqual({ candlesLit: 1, roomsRestored: 0 });
    expect(r.restoredRoom).toBeNull();
  });

  it('restores a room on the last candle and opens the next', () => {
    let house = EMPTY_HOUSE;
    let restored = null;
    for (let i = 0; i < CANDLES_PER_ROOM; i++) ({ house, restoredRoom: restored } = lightCandle(house));
    expect(restored?.id).toBe('parlor');
    expect(viewHouse(house)).toMatchObject({ roomIndex: 1, candlesLit: 0, roomsInThisHouse: 1 });
    expect(viewHouse(house).room.id).toBe('library');
  });

  it('restores the whole house and starts another', () => {
    let house = { candlesLit: CANDLES_PER_ROOM - 1, roomsRestored: ROOMS.length - 1 };
    const r = lightCandle(house);
    expect(r.houseRestored).toBe(true);
    house = r.house;
    expect(viewHouse(house)).toMatchObject({ roomIndex: 0, housesRestored: 1 });
  });

  it('scores progress so copies can be compared', () => {
    expect(houseScore({ candlesLit: 2, roomsRestored: 3 })).toBe(3 * CANDLES_PER_ROOM + 2);
  });
});
