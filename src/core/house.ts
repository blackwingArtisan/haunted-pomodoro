/**
 * The house. Every finished focus session lights one candle in the current room; when all of a
 * room's candles are lit the room is restored and the next room opens. Progress only moves
 * forward: a missed day, a reset or a skipped session never un-restores anything.
 */

export const CANDLES_PER_ROOM = 4;

export type RoomProp = 'clock' | 'books' | 'fern' | 'piano' | 'horse' | 'telescope';

export interface RoomDef {
  id: string;
  name: string;
  /** Shown while the room is still haunted. */
  haunted: string;
  /** Shown once it is restored. */
  restored: string;
  prop: RoomProp;
  /** Wallpaper colors once restored: base and pattern. */
  paper: [string, string];
}

export const ROOMS: readonly RoomDef[] = [
  {
    id: 'parlor',
    name: 'The Parlor',
    haunted: 'Dust sheets and a portrait that will not stop staring.',
    restored: 'The clock ticks again and the portrait rests.',
    prop: 'clock',
    paper: ['#5b2a3a', '#7a3d50'],
  },
  {
    id: 'library',
    name: 'The Library',
    haunted: 'Books whisper on their shelves, spines turned to the wall.',
    restored: 'The books face out again, ready to be read.',
    prop: 'books',
    paper: ['#24423a', '#33594e'],
  },
  {
    id: 'conservatory',
    name: 'The Conservatory',
    haunted: 'The ferns have gone grey and the glass is fogged.',
    restored: 'Green again, and the moon comes through clear glass.',
    prop: 'fern',
    paper: ['#2f4a2a', '#45663c'],
  },
  {
    id: 'music-room',
    name: 'The Music Room',
    haunted: 'A piano that plays one note at midnight.',
    restored: 'The piano is tuned and quiet, waiting for you.',
    prop: 'piano',
    paper: ['#3a2c5c', '#4f3f7a'],
  },
  {
    id: 'nursery',
    name: 'The Nursery',
    haunted: 'A rocking horse that rocks by itself.',
    restored: 'The horse is still. Somebody is sleeping well.',
    prop: 'horse',
    paper: ['#5c4a2a', '#7a6438'],
  },
  {
    id: 'observatory',
    name: 'The Observatory',
    haunted: 'The telescope points at nothing, the stars are smudged.',
    restored: 'Every star is back where it belongs.',
    prop: 'telescope',
    paper: ['#1f3550', '#2e4a6e'],
  },
];

export interface HouseState {
  /** Candles lit in the current room, 0 to CANDLES_PER_ROOM - 1. */
  candlesLit: number;
  /** Rooms restored over all time, across every house. */
  roomsRestored: number;
}

export const EMPTY_HOUSE: HouseState = { candlesLit: 0, roomsRestored: 0 };

export interface HouseView {
  room: RoomDef;
  roomIndex: number;
  candlesLit: number;
  /** How many whole houses have been restored. */
  housesRestored: number;
  /** Rooms restored in the house currently being worked on. */
  roomsInThisHouse: number;
}

export function viewHouse(house: HouseState): HouseView {
  const roomIndex = house.roomsRestored % ROOMS.length;
  return {
    room: ROOMS[roomIndex]!,
    roomIndex,
    candlesLit: house.candlesLit,
    housesRestored: Math.floor(house.roomsRestored / ROOMS.length),
    roomsInThisHouse: roomIndex,
  };
}

export interface CandleResult {
  house: HouseState;
  /** The room this candle finished restoring, if any. */
  restoredRoom: RoomDef | null;
  /** True when that room was the last one in the house. */
  houseRestored: boolean;
}

export function lightCandle(house: HouseState): CandleResult {
  const candlesLit = house.candlesLit + 1;
  if (candlesLit < CANDLES_PER_ROOM) {
    return { house: { ...house, candlesLit }, restoredRoom: null, houseRestored: false };
  }
  const room = viewHouse(house).room;
  const roomsRestored = house.roomsRestored + 1;
  return {
    house: { candlesLit: 0, roomsRestored },
    restoredRoom: room,
    houseRestored: roomsRestored % ROOMS.length === 0,
  };
}

/** Total candles ever lit, used to compare two copies of the same house. */
export function houseScore(house: HouseState): number {
  return house.roomsRestored * CANDLES_PER_ROOM + house.candlesLit;
}
