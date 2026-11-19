# Requirements: House sync (optional)

## Introduction
Some people use the timer on a laptop and a phone. Sync mirrors the house to a Cloudflare Worker backed by Workers KV. It is off by default; the local store remains the source of truth and the app never waits on the network.

Every criterion is written in EARS form and states one testable behavior. Numbers never change; behaviors split out of an older criterion are appended at the end of the requirement. Importing a house file (`haunted-focus-timer` Requirement 11) uses the same merge as Requirement 3 here.

## Requirement 1: Opt-in sync
1. IF `VITE_HOUSE_STORE` is not `cloudflare` OR `VITE_SYNC_URL` is empty, THEN THE SYSTEM SHALL use the local store only.
2. WHERE sync is enabled, WHEN the app first needs a house id, THE SYSTEM SHALL create a random UUID and store it in this browser.
3. WHERE sync is enabled, WHEN the app starts, THE SYSTEM SHALL pull the synced copy from the Worker.
4. WHERE `VITE_HOUSE_STORE` is `cloudflare` AND `VITE_SYNC_URL` is set, THE SYSTEM SHALL use the Cloudflare store.
5. WHERE sync is enabled, WHEN the app starts again, THE SYSTEM SHALL reuse the stored house id.
6. WHEN a synced copy has been pulled, THE SYSTEM SHALL merge it with the current copy through `mergeModels`.
7. WHEN a synced copy has been merged, THE SYSTEM SHALL save the result locally.
8. IF the pull fails or finds no copy, THEN THE SYSTEM SHALL keep the local copy.
9. WHEN a pulled copy is applied, THE SYSTEM SHALL keep any change the person made while the pull was in flight.

## Requirement 2: Saving
1. WHEN the model changes, THE SYSTEM SHALL save it locally at once.
2. IF the Worker answers 409 with a newer copy, THEN THE SYSTEM SHALL merge the two copies and save the merge locally.
3. IF the network fails, THEN THE SYSTEM SHALL keep the local copy and try again on the next save.
4. WHEN the model changes AND four seconds pass without another change, THE SYSTEM SHALL push it to the Worker.
5. WHEN a 409 has been merged, THE SYSTEM SHALL push the merged copy once.

## Requirement 3: Merging
1. WHEN two copies are merged, THE SYSTEM SHALL keep the settings and tasks of the copy with the later `updatedAt`.
2. WHEN two copies are merged, THE SYSTEM SHALL keep the larger value of each day's sessions, focus time and wanderings.
3. WHEN two copies are merged, THE SYSTEM SHALL keep the house with the higher `houseScore`, so that progress never goes backward.
4. WHEN two copies are merged, THE SYSTEM SHALL keep this device's running timer.
5. WHEN two copies are merged, THE SYSTEM SHALL set `updatedAt` to the later of the two.

## Requirement 4: Worker
1. IF a request path is not `/v1/houses/{uuid}`, THEN THE WORKER SHALL answer 404.
2. IF a request body is larger than 256 KB, THEN THE WORKER SHALL reject it.
3. IF the stored copy is newer than the incoming one, THEN THE WORKER SHALL answer 409 with the stored copy.
4. THE WORKER SHALL answer cross-origin requests with the configured origin and SHALL NOT name an origin that is not configured.
5. IF a request to a valid path uses a method other than GET, PUT or OPTIONS, THEN THE WORKER SHALL answer 405.
6. IF a GET finds no stored copy, THEN THE WORKER SHALL answer 404.
7. IF a request body is not valid JSON, THEN THE WORKER SHALL answer 400.
8. IF a request body has no numeric `updatedAt`, THEN THE WORKER SHALL answer 400.
9. WHEN an OPTIONS request arrives for a valid path, THE WORKER SHALL answer 204 with the CORS headers.
