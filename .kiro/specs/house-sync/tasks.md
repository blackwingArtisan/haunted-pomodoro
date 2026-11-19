# Tasks: House sync

A task is checked only when code and a test implement it.

- [x] 1. `HouseStore` port and `LocalHouseStore` (Req 1.1, 1.4)
- [x] 2. `mergeModels` with day maxima and forward-only house (Req 3.1 to 3.4)
- [ ] 3. Sync Worker with id validation, size limit, 409 on older copies, CORS allow-list (Req 4.1 to 4.9)
  - [ ] 3.1 Test the 256 KB limit. The code compares `text.length` (UTF-16 units), not bytes, so the limit is not exact for non-ASCII text; measure bytes and test both sides of the limit (Req 4.2)
- [x] 4. `CloudflareHouseStore` with pull-merge, push, 409 merge-and-retry, offline fallback (Req 1.3, 1.6 to 1.8, 2.1 to 2.3, 2.5)
- [x] 5. Env selection and stable house id (Req 1.1, 1.2, 1.4, 1.5)
- [x] 6. Unit tests for the Worker and the store against a stubbed fetch
- [ ] 7. Per-house secret header and a "link another device" screen with a QR code
- [ ] 8. Apply a pulled copy by merging it into the live model. `App.tsx` calls `controller.replace(pulled)`, which overwrites anything the person did while the request was in flight; add a controller method that merges with `getModel()` and test it (Req 1.9)
- [ ] 9. Move the four-second push debounce out of `App.tsx` into a small tested helper (Req 2.4)
- [ ] 10. Assert in the merge test that `updatedAt` is the later of the two copies (Req 3.5)
