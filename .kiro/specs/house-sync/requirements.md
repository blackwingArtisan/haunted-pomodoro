# Requirements: House sync (optional)

## Introduction
Some people use the timer on a laptop and a phone. Sync mirrors the house to a Cloudflare Worker backed by Workers KV. It is off by default; the local store remains the source of truth and the app never waits on the network.

## Requirement 1: Opt-in sync
1. THE system SHALL use the local store unless `VITE_HOUSE_STORE=cloudflare` and `VITE_SYNC_URL` are both set.
2. WHEN sync is enabled THEN the system SHALL create a random house id once per browser and reuse it.
3. WHEN sync is enabled and the app starts THEN the system SHALL pull the synced copy, merge it with the local copy and save the result locally.

## Requirement 2: Saving
1. WHEN the model changes THEN the system SHALL save locally at once and push to the Worker after a short debounce.
2. IF the Worker answers 409 with a newer copy THEN the system SHALL merge the two copies, save the merge locally and push it once.
3. IF the network fails THEN the system SHALL keep the local copy and try again on the next save.

## Requirement 3: Merging
1. THE system SHALL keep the newer copy's settings and tasks.
2. THE system SHALL keep the larger count for each day's sessions, focus time and wanderings.
3. THE system SHALL keep whichever house has more candles lit in total, so progress never goes backward.
4. THE system SHALL keep this device's running timer.

## Requirement 4: Worker
1. THE Worker SHALL accept GET and PUT on `/v1/houses/{uuid}` only, and answer 404 for anything else.
2. THE Worker SHALL reject bodies over 256 KB, invalid JSON, and documents without a numeric `updatedAt`.
3. IF the stored copy is newer than the incoming one THEN the Worker SHALL answer 409 with the stored copy.
4. THE Worker SHALL allow cross-origin requests only from configured origins.
