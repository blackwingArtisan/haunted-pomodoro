# Design: House sync

- `HouseStore` port (`src/adapters/store/types.ts`): `load()` and `save(model)`.
- `LocalHouseStore`: one JSON document in localStorage, with synchronous `loadSync`/`saveSync` for the first paint.
- `CloudflareHouseStore`: wraps the local store. `load` merges a GET into the local copy; `save` writes locally, then PUTs; on 409 it merges with `mergeModels` and PUTs once more. Network errors are swallowed after the local write.
- `createStores(env)` chooses the store from env and keeps a stable house id under `haunted-pomodoro/house-id`.
- `worker/sync-worker.ts`: a Workers module with an exported `handle(request, env)` so it can be tested without the Workers runtime. KV key `house:{uuid}`. Configuration example in `worker/wrangler.toml.example`.
- The house id is a random UUID and acts as a capability. A later version can add a per-house secret header.

## Testing
- The Worker handler is tested with an in-memory KV.
- The Cloudflare store is tested by routing its `fetch` calls into the Worker handler, covering push, pull and merge, the 409 retry and offline fallback. No real network is used.
