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
  // Req 1.9, 8.1
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

  // Req 8.3
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

  // Req 4.6, 11.5, 11.6
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

  // Req 3.20, 4.6
  it('keeps the time away through a save, a damaged value and a merge, and reads older saves without it', () => {
    const base = busyModel();
    const withAway = { ...base, days: { '2026-11-17': { sessions: 3, focusMs: 4_500_000, distractions: 2, awayMs: 90_000 } } };
    expect(deserializeModel(serializeModel(withAway), 0)?.days['2026-11-17']).toEqual(withAway.days['2026-11-17']);
    expect(deserializeModel(serializeModel(base), 0)?.days['2026-11-17']).not.toHaveProperty('awayMs');
    const damaged = JSON.parse(serializeModel(withAway));
    damaged.days['2026-11-17'].awayMs = 'soon';
    expect(parseModel(damaged, 0).days['2026-11-17']?.awayMs).toBe(0);
    const remote = { ...base, days: { '2026-11-17': { sessions: 1, focusMs: 1_500_000, distractions: 4, awayMs: 30_000 } } };
    expect(mergeModels(withAway, remote).days['2026-11-17']).toEqual({ sessions: 3, focusMs: 4_500_000, distractions: 4, awayMs: 90_000 });
    expect(mergeModels(base, remote).days['2026-11-17']).toEqual({ sessions: 3, focusMs: 4_500_000, distractions: 4, awayMs: 30_000 });
  });

  // Req 8.1
  it('selects the local store unless sync is fully configured', () => {
    expect(storeKind({})).toBe('local');
    expect(storeKind({ VITE_HOUSE_STORE: 'cloudflare' })).toBe('local');
    expect(storeKind({ VITE_HOUSE_STORE: 'cloudflare', VITE_SYNC_URL: 'https://sync.example.com' })).toBe('cloudflare');
    const stores = createStores({}, new MemoryStorage());
    expect(stores.primary).toBe(stores.local);
  });
});

describe('the follow setting in a saved copy', () => {
  // Req ghost-follows-you:12.2, 12.3
  it('reads a copy without the field, "true" or 1 as off', () => {
    const old = JSON.parse(serializeModel(createModel(1)));
    delete old.settings.ghostFollows;
    expect(parseModel(old, 3).settings.ghostFollows).toBe(false);
    for (const bad of ['true', 1, null, {}]) {
      old.settings.ghostFollows = bad;
      expect(parseModel(old, 3).settings.ghostFollows).toBe(false);
    }
  });

  // Req ghost-follows-you:12.1
  it('keeps true through a save and a load', () => {
    const model = reduceApp(createModel(1), { type: 'updateSettings', patch: { ghostFollows: true } }, 2).model;
    expect(parseModel(JSON.parse(serializeModel(model)), 3).settings.ghostFollows).toBe(true);
  });
});
