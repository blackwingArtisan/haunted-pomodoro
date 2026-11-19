import { describe, expect, it } from 'vitest';
import { LocalHouseStore, MemoryStorage } from '../../src/adapters/store/local';
import { createStores, storeKind } from '../../src/adapters/store';
import { createModel, reduceApp } from '../../src/core/model';
import { STORAGE_KEY, deserializeModel, mergeModels, parseModel, serializeModel } from '../../src/core/snapshot';

function busyModel() {
  let m = createModel(1_000);
  const send = (a: Parameters<typeof reduceApp>[1], now = 2_000) => (m = reduceApp(m, a, now).model);
  send({ type: 'addTask', id: 't1', title: 'Write the grant report', estimate: 3 });
  send({ type: 'addTask', id: 't2', title: 'Reply to the archive', estimate: 1 });
  send({ type: 'toggleTaskDone', id: 't2' });
  send({ type: 'updateSettings', patch: { focusMin: 40, muted: true, motion: 'reduced' } });
  send({ type: 'timer', action: { type: 'start' } }, 3_000);
  return { ...m, house: { candlesLit: 2, roomsRestored: 5 }, days: { '2026-11-17': { sessions: 3, focusMs: 4_500_000, distractions: 2 } } };
}

describe('persistence', () => {
  it('round-trips the whole model through localStorage', async () => {
    const storage = new MemoryStorage();
    const store = new LocalHouseStore(storage, STORAGE_KEY, () => 9_000);
    const model = busyModel();
    await store.save(model);
    expect(storage.getItem(STORAGE_KEY)).toContain('Write the grant report');
    expect(await store.load()).toEqual(model);
  });

  it('returns null when nothing is stored and when the text is not JSON', () => {
    expect(deserializeModel(null, 0)).toBeNull();
    expect(deserializeModel('{not json', 0)).toBeNull();
  });

  it('rebuilds a valid model from damaged data', () => {
    const m = parseModel(
      {
        version: 1,
        settings: { focusMin: -4, volume: 'loud', motion: 'wild' },
        tasks: [{ id: 'a', title: 'Keep me' }, { id: 'a', title: 'Duplicate' }, { title: 'No id' }, 7],
        activeTaskId: 'gone',
        days: { '2026-11-18': { sessions: 2 }, 'yesterday': { sessions: 1 }, '2026-02-31': {} },
        house: { candlesLit: 9, roomsRestored: -1 },
        timer: { phase: 'nap', status: 'running', endsAt: null, durationMs: 1_500_000 },
      },
      5,
    );
    expect(m.settings).toMatchObject({ focusMin: 1, volume: 0.6, motion: 'system' });
    expect(m.tasks.map((t) => t.title)).toEqual(['Keep me']);
    expect(m.activeTaskId).toBeNull();
    expect(Object.keys(m.days)).toEqual(['2026-11-18']);
    expect(m.house).toEqual({ candlesLit: 3, roomsRestored: 0 });
    expect(m.timer).toMatchObject({ phase: 'focus', status: 'idle', endsAt: null, hiddenSince: null });
  });

  it('ignores other versions', () => {
    expect(parseModel({ version: 2, tasks: [{ id: 'x', title: 'y' }] }, 0).tasks).toEqual([]);
  });

  it('never throws when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => undefined,
    };
    const store = new LocalHouseStore(blocked);
    expect(store.loadSync()).toBeNull();
    expect(store.saveSync(createModel(0))).toBe(false);
  });

  it('merges two copies without losing progress', () => {
    const local = busyModel();
    const remote = {
      ...createModel(0),
      updatedAt: local.updatedAt + 10,
      house: { candlesLit: 0, roomsRestored: 1 },
      days: { '2026-11-17': { sessions: 1, focusMs: 1_500_000, distractions: 5 }, '2026-11-18': { sessions: 1, focusMs: 1_500_000, distractions: 0 } },
    };
    const merged = mergeModels(local, remote);
    expect(merged.tasks).toEqual([]);
    expect(merged.house).toEqual(local.house);
    expect(merged.timer).toBe(local.timer);
    expect(merged.days['2026-11-17']).toEqual({ sessions: 3, focusMs: 4_500_000, distractions: 5 });
    expect(merged.days['2026-11-18']?.sessions).toBe(1);
    expect(JSON.parse(serializeModel(merged)).version).toBe(1);
  });

  it('selects the local store unless sync is fully configured', () => {
    expect(storeKind({})).toBe('local');
    expect(storeKind({ VITE_HOUSE_STORE: 'cloudflare' })).toBe('local');
    expect(storeKind({ VITE_HOUSE_STORE: 'cloudflare', VITE_SYNC_URL: 'https://sync.example.com' })).toBe('cloudflare');
    const stores = createStores({}, new MemoryStorage());
    expect(stores.primary).toBe(stores.local);
  });
});
