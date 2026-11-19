import type { AppModel } from '../../core/model';
import { STORAGE_KEY, deserializeModel, serializeModel } from '../../core/snapshot';
import type { HouseStore, KeyValueStorage } from './types';

/** The default store: one JSON document in this browser's localStorage. Free, offline, private. */
export class LocalHouseStore implements HouseStore {
  readonly kind = 'local' as const;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string = STORAGE_KEY,
    private readonly now: () => number = Date.now,
  ) {}

  /** Synchronous read so the first paint already shows the right room. */
  loadSync(): AppModel | null {
    try {
      return deserializeModel(this.storage.getItem(this.key), this.now());
    } catch {
      return null;
    }
  }

  async load(): Promise<AppModel | null> {
    return this.loadSync();
  }

  /** Writes synchronously; storage can be full or blocked, which must never break the timer. */
  saveSync(model: AppModel): boolean {
    try {
      this.storage.setItem(this.key, serializeModel(model));
      return true;
    } catch {
      return false;
    }
  }

  async save(model: AppModel): Promise<void> {
    this.saveSync(model);
  }

  clear(): void {
    try {
      this.storage.removeItem(this.key);
    } catch {
      // Nothing to clear when storage is unavailable.
    }
  }
}

/** A Storage stand-in for tests and for browsers where localStorage throws. */
export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}
