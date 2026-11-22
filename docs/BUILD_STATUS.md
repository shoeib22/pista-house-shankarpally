# Build status - 22 November 2026

> Latest handoff: a newer exact-reference home / liquid-glass navigation iteration is now in progress and the customer app currently has four compile errors. The verification results below describe the preceding maps/tracking baseline. Read `../handoff.md` for the current continuation point.

## Current result

The customer app now implements the user-supplied heritage design direction, product detail, delivery map-pin selection, explicit area/landmark search and active-order live delivery tracking. The rider app has opt-in real GPS sharing, using authenticated Socket.IO WebSocket transport on the shared NestJS/PostgreSQL backend. The employee dashboard and owner app retain their existing operational workflows, with the shared updated typography and palette in the mobile apps.

The confirmed Shankarpally outlet pin is stored at 17.4538158, 78.1410641. This does not approve any real delivery zone or change delivery fees. The only configured beta zone remains sample PIN 000000.

See `live_tracking.md` for permissions, provider setup, protocol and device-test limits. See `design/heritage-redesign.md` for the user's references, illustration generation prompt, font licensing and UI evidence. The user's promised Shankarpally logo remains pending; the customer header uses a temporary text wordmark and the existing logo asset is preserved.

## Verified

| Check | Result |
| --- | --- |
| Backend tests | 28 pass, including 7 map/tracking cases using the real database and WebSocket server |
| Mobile functional tests | Customer 4 ordinary + 3 beta, rider 4, owner 5: 16 pass |
| Direct Dart client smoke check | Passed starting a lease, receiving snapshots, stopping and rejecting delayed GPS through the real loopback Nest server |
| Flutter analysis | Clean for all three apps and the new shared tracking package |
| Backend compilation | TypeScript build passes |
| Employee dashboard | TypeScript/Vite build passes |
| API contract | API 0.4.0 validates; Dart/TypeScript models regenerated, including coordinate fields |
| Database | 9 migrations applied to the project's development and isolated beta databases; no data-volume reset |
| Android | Customer and rider debug APKs compile with maps, native location plugins and permissions |
| iOS metadata | Customer location usage and rider location/background declarations parse correctly |
| Visual evidence | Real Flutter home/detail renders; actual OSM tiles, Photon area search, retained delivery pin and OSRM route verified through the local API with simulated GPS; 430x932 and 320x700 tracking layouts checked |

The direct client/visual fixtures are temporary, loopback-only QA data. They do not use real customer locations or live restaurant payments. Generated tokens, test-account files, environment files, native build output and preview entrypoints remain ignored. The temporary QA outlet, its order/users/sessions and task-owned preview processes were cleaned up after evidence capture.

## Tracking guarantees

- A customer can watch only their own order. Owner/counter access is outlet-scoped, kitchen access is denied and unrelated riders cannot subscribe.
- Authentication is checked before socket acceptance, for incoming actions and for outgoing snapshots. Revocation closes existing subscriptions and removes a publisher's active lease.
- The rider must explicitly start a lease after pickup. Stops and obsolete devices cannot revive or overwrite a newer lease. Conditional database writes also enforce assignment state, rider ownership, throttling and fix ordering.
- GPS above 100-metre inaccuracy, old fixes and materially future-dated fixes are rejected. Stale/disconnected data is not shown as live; unavailable routing produces no invented arrival time.
- Only the latest GPS point is stored. Stops, completion, failed-delivery escalation and suspension remove current GPS access. No off-shift tracking or GPS history recorder was introduced.
- Map selection preserves server-side PIN-code serviceability. Payments, fulfilment, manual assignment, physical-return handling and delivery-code verification retain their separate state controls.

## Remaining launch/device gates

Physical iPhone/Android checks are still required for actual GPS accuracy, lock-screen/background delivery, permission denial, low-power/network loss, navigation/calling and relaunch behaviour. Force-quit durability is not claimed. The updated iOS apps have not been built or uploaded to TestFlight in this feature task.

OpenStreetMap tiles, the Photon demo search endpoint and the OSRM demo router are for moderate beta testing. Production needs approved map/search/routing providers, their usage/attribution/privacy setup and monitoring. ETA is road travel time without traffic or preparation time.

Other remaining gates include customer phone authentication, real gateway/refunds and reconciliation, restaurant-approved menu/taxes/zones/policies, variants/add-ons, saved address books, rewards/coupons/favourites/reorder, push/SMS workers, expanded owner reporting, durable mobile sessions/retries, production packaging/TLS, backups/restores, dependency advisory review, security/load testing and store release readiness. No COD, automatic dispatch, route optimisation, public customer storefront or Petpooja integration was added.

## Distribution history

The earlier three iOS apps were uploaded through the existing Qube Codemagic signing route. Customer 0.1.0 build 4 was verified Ready to Test; delivery 0.1.0 build 5 and the owner IPA uploaded successfully. Those uploads predate the maps/redesign work. They do not demonstrate that these new features are installed in TestFlight. App identifiers and signing references remain in `release/testflight-apps.json` and `codemagic.yaml`; unrelated Xerovolt configuration was not changed.

## Local operation

Keep secrets in ignored local files. Standard development uses `npm run dev:api` and `npm run dev:dashboard`. The separate PC beta supervisor is `node scripts/start-beta-server.mjs` with the isolated `backend/.env.beta`; its temporary HTTPS URL can change on restart. No old tunnel URL is asserted current here. The customer app's drawer contains Beta server settings.

A scoped helper, `scripts/repair-flutter-cache.ps1`, clears read-only attributes on this project's generated Flutter artifacts if Windows prevents asset replacement; it does not reset database volumes or remove source files. The existing PostgreSQL query-concurrency deprecation warning is still upstream and is not a test failure.


