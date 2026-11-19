import type { AppModel } from '../../core/model';
import { mergeModels, parseModel, serializeModel } from '../../core/snapshot';
import type { LocalHouseStore } from './local';
import type { HouseStore } from './types';

export interface CloudflareSyncOptions {
  /** Base URL of the sync Worker in worker/sync-worker.ts, without a trailing slash. */
  baseUrl: string;
  /** A random house id; knowing it is what grants access, so it is kept like a password. */
  houseId: string;
  fetch?: typeof fetch;
  now?: () => number;
}

/**
 * The real sync path: keeps the local copy as the source of truth and mirrors it to a Cloudflare
 * Worker backed by Workers KV, so the same house opens on another device. Selected with
 * VITE_HOUSE_STORE=cloudflare. It is written and type-checked, and its request shapes are unit
 * tested against a stubbed fetch; it is not called by the app or the tests by default.
 */
export class CloudflareHouseStore implements HouseStore {
  readonly kind = 'cloudflare' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(
    private readonly local: LocalHouseStore,
    private readonly options: CloudflareSyncOptions,
  ) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
  }

  private url(): string {
    return `${this.options.baseUrl}/v1/houses/${encodeURIComponent(this.options.houseId)}`;
  }

  /** Pulls the synced copy and merges it into the local one. Offline or failing sync falls back to local. */
  async load(): Promise<AppModel | null> {
    const local = this.local.loadSync();
    let remote: AppModel | null = null;
    try {
      const res = await this.fetchImpl(this.url(), { method: 'GET', headers: { accept: 'application/json' } });
      if (res.ok) remote = parseModel(await res.json(), this.now());
    } catch {
      remote = null;
    }
    if (!remote) return local;
    const merged = local ? mergeModels(local, remote) : remote;
    this.local.saveSync(merged);
    return merged;
  }

  /** Saves locally at once, then pushes. A 409 means another device wrote newer data: merge and retry once. */
  async save(model: AppModel): Promise<void> {
    this.local.saveSync(model);
    try {
      const res = await this.put(model);
      if (res.status === 409) {
        const remote = parseModel(await res.json(), this.now());
        const merged = mergeModels(model, remote);
        this.local.saveSync(merged);
        await this.put(merged);
      }
    } catch {
      // Offline: the local copy is already saved and the next save will push again.
    }
  }

  private put(model: AppModel): Promise<Response> {
    return this.fetchImpl(this.url(), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: serializeModel(model),
    });
  }
}
