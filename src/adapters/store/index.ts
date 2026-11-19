import { CloudflareHouseStore } from './cloudflare';
import { LocalHouseStore, MemoryStorage } from './local';
import type { HouseStore, KeyValueStorage } from './types';

export type StoreKind = 'local' | 'cloudflare';

export interface StoreEnv {
  VITE_HOUSE_STORE?: string;
  VITE_SYNC_URL?: string;
}

const HOUSE_ID_KEY = 'haunted-pomodoro/house-id';

function browserStorage(): KeyValueStorage {
  try {
    const storage = globalThis.localStorage;
    const probe = '__haunted_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return new MemoryStorage();
  }
}

export function storeKind(env: StoreEnv): StoreKind {
  return env.VITE_HOUSE_STORE === 'cloudflare' && Boolean(env.VITE_SYNC_URL) ? 'cloudflare' : 'local';
}

function houseId(storage: KeyValueStorage): string {
  const existing = storage.getItem(HOUSE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  storage.setItem(HOUSE_ID_KEY, id);
  return id;
}

export interface Stores {
  local: LocalHouseStore;
  /** The store chosen by env; the local store itself unless sync is configured. */
  primary: HouseStore;
}

export function createStores(env: StoreEnv, storage: KeyValueStorage = browserStorage()): Stores {
  const local = new LocalHouseStore(storage);
  if (storeKind(env) === 'cloudflare') {
    const primary = new CloudflareHouseStore(local, { baseUrl: env.VITE_SYNC_URL!.replace(/\/+$/, ''), houseId: houseId(storage) });
    return { local, primary };
  }
  return { local, primary: local };
}

export type { HouseStore, KeyValueStorage } from './types';
