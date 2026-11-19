import type { AppModel } from '../../core/model';

/**
 * Where the house is kept. The app always works from this device's copy first, so focus never waits
 * on the network; a store may also keep a copy somewhere else.
 */
export interface HouseStore {
  readonly kind: 'local' | 'cloudflare';
  /** The best available copy, or null when nothing has been saved yet. */
  load(): Promise<AppModel | null>;
  save(model: AppModel): Promise<void>;
}

/** The part of the Web Storage API the local store needs; lets tests pass an in-memory map. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
