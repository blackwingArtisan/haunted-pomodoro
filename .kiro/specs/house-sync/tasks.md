# Tasks: House sync

- [x] 1. `HouseStore` port and `LocalHouseStore` (Req 1.1)
- [x] 2. `mergeModels` with day maxima and forward-only house (Req 3.1 to 3.4)
- [x] 3. Sync Worker with id validation, size limit, 409 on older copies, CORS allow-list (Req 4.1 to 4.4)
- [x] 4. `CloudflareHouseStore` with pull-merge, push, 409 merge-and-retry, offline fallback (Req 1.3, 2.1 to 2.3)
- [x] 5. Env selection and stable house id (Req 1.1, 1.2)
- [x] 6. Unit tests for the Worker and the store against a stubbed fetch
- [ ] 7. Per-house secret header and a "link another device" screen with a QR code
