import { describe, expect, it } from 'vitest';
import { CloudflareHouseStore } from '../../src/adapters/store/cloudflare';
import { createStores } from '../../src/adapters/store';
import { LocalHouseStore, MemoryStorage } from '../../src/adapters/store/local';
import { createModel } from '../../src/core/model';
import { serializeModel } from '../../src/core/snapshot';
import { handle, type KvNamespace } from '../../worker/sync-worker';

const HOUSE = '6f1c2b8e-4a1d-4c3e-9b7a-2d5e8f0a1b2c';
const BASE = 'https://sync.example.com';

class MemoryKv implements KvNamespace {
  readonly map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.map.set(key, value);
  }
}

/** Routes the client's fetch calls into the Worker handler, so both halves are tested together. */
function workerFetch(kv: MemoryKv, calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(String(input), init);
    calls.push(`${request.method} ${new URL(request.url).pathname}`);
    return handle(request, { HOUSES: kv, ALLOWED_ORIGINS: 'https://app.example.com' });
  }) as typeof fetch;
}

describe('sync worker', () => {
  it('stores and returns a house', async () => {
    const kv = new MemoryKv();
    const body = serializeModel(createModel(100));
    const put = await handle(new Request(`${BASE}/v1/houses/${HOUSE}`, { method: 'PUT', body }), { HOUSES: kv });
    expect(put.status).toBe(200);
    const get = await handle(new Request(`${BASE}/v1/houses/${HOUSE}`), { HOUSES: kv });
    expect(await get.text()).toBe(body);
  });

  it('refuses an older copy with 409 and the newer one', async () => {
    const kv = new MemoryKv();
    const env = { HOUSES: kv };
    await handle(new Request(`${BASE}/v1/houses/${HOUSE}`, { method: 'PUT', body: serializeModel(createModel(500)) }), env);
    const res = await handle(new Request(`${BASE}/v1/houses/${HOUSE}`, { method: 'PUT', body: serializeModel(createModel(100)) }), env);
    expect(res.status).toBe(409);
    expect((await res.json()).updatedAt).toBe(500);
  });

  it('rejects bad ids, bad JSON and other methods', async () => {
    const env = { HOUSES: new MemoryKv() };
    expect((await handle(new Request(`${BASE}/v1/houses/not-a-uuid`), env)).status).toBe(404);
    expect((await handle(new Request(`${BASE}/v1/houses/${HOUSE}`, { method: 'PUT', body: '{' }), env)).status).toBe(400);
    expect((await handle(new Request(`${BASE}/v1/houses/${HOUSE}`, { method: 'PUT', body: '{}' }), env)).status).toBe(400);
    expect((await handle(new Request(`${BASE}/v1/houses/${HOUSE}`, { method: 'DELETE' }), env)).status).toBe(405);
    expect((await handle(new Request(`${BASE}/v1/houses/${HOUSE}`), env)).status).toBe(404);
  });

  it('answers CORS preflight for allowed origins only', async () => {
    const env = { HOUSES: new MemoryKv(), ALLOWED_ORIGINS: 'https://app.example.com' };
    const ok = await handle(new Request(`${BASE}/v1/houses/${HOUSE}`, { method: 'OPTIONS', headers: { origin: 'https://app.example.com' } }), env);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    const other = await handle(new Request(`${BASE}/v1/houses/${HOUSE}`, { method: 'OPTIONS', headers: { origin: 'https://evil.example.net' } }), env);
    expect(other.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
  });
});

describe('Cloudflare house store (against a stubbed fetch)', () => {
  it('pushes saves and merges a pulled copy into the local one', async () => {
    const kv = new MemoryKv();
    const calls: string[] = [];
    const deviceA = new CloudflareHouseStore(new LocalHouseStore(new MemoryStorage()), { baseUrl: BASE, houseId: HOUSE, fetch: workerFetch(kv, calls) });
    const progressed = { ...createModel(1_000), house: { candlesLit: 1, roomsRestored: 2 } };
    await deviceA.save(progressed);
    expect(calls).toEqual([`PUT /v1/houses/${HOUSE}`]);

    const localB = new LocalHouseStore(new MemoryStorage());
    localB.saveSync(createModel(500));
    const deviceB = new CloudflareHouseStore(localB, { baseUrl: BASE, houseId: HOUSE, fetch: workerFetch(kv) });
    const loaded = await deviceB.load();
    expect(loaded?.house).toEqual({ candlesLit: 1, roomsRestored: 2 });
    expect(localB.loadSync()?.house).toEqual({ candlesLit: 1, roomsRestored: 2 });
  });

  it('merges and retries once on a conflict', async () => {
    const kv = new MemoryKv();
    kv.map.set(`house:${HOUSE}`, serializeModel({ ...createModel(9_000), house: { candlesLit: 0, roomsRestored: 4 } }));
    const calls: string[] = [];
    const local = new LocalHouseStore(new MemoryStorage());
    const store = new CloudflareHouseStore(local, { baseUrl: BASE, houseId: HOUSE, fetch: workerFetch(kv, calls) });
    await store.save({ ...createModel(1_000), house: { candlesLit: 2, roomsRestored: 1 } });
    expect(calls).toHaveLength(2);
    expect(local.loadSync()?.house).toEqual({ candlesLit: 0, roomsRestored: 4 });
  });

  it('falls back to the local copy when offline', async () => {
    const local = new LocalHouseStore(new MemoryStorage());
    local.saveSync({ ...createModel(1), house: { candlesLit: 3, roomsRestored: 0 } });
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const store = new CloudflareHouseStore(local, { baseUrl: BASE, houseId: HOUSE, fetch: offline });
    expect((await store.load())?.house.candlesLit).toBe(3);
    await expect(store.save(createModel(2))).resolves.toBeUndefined();
  });

  it('is chosen by env and keeps a stable house id', () => {
    const storage = new MemoryStorage();
    const first = createStores({ VITE_HOUSE_STORE: 'cloudflare', VITE_SYNC_URL: `${BASE}/` }, storage);
    expect(first.primary.kind).toBe('cloudflare');
    const id = storage.getItem('haunted-pomodoro/house-id');
    createStores({ VITE_HOUSE_STORE: 'cloudflare', VITE_SYNC_URL: BASE }, storage);
    expect(storage.getItem('haunted-pomodoro/house-id')).toBe(id);
  });
});
