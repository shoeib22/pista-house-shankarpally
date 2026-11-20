# Build status · 20 November 2026

## Current result

The local build connects customer, employee, owner and rider workflows on one NestJS/PostgreSQL backend. Version 0.3 adds credential-backed operational accounts, owner invitations/recovery, account suspension, passphrase changes and session revocation. Pickup/delivery, kitchen updates and code-verified delivery remain working.

This is not a production launch. Customer phone verification, live payments/refunds, notifications and production hosting remain unconfigured. Catalogue, service zones and review orders are samples. No public customer storefront, COD or separately scoped Petpooja integration was added.

## Verified

| Check | Observed result |
|---|---|
| Backend tests | 18 pass, including real HTTP/PostgreSQL account, pickup and delivery journeys |
| Mobile tests | Owner 5, rider 4, customer 3 pass: 12 total |
| Total tests | 30 pass |
| Flutter analysis | Clean across all three apps |
| API/dashboard build | TypeScript and Vite builds pass |
| Android | All three current debug APKs compile/package successfully |
| OpenAPI | Version 0.3.0 validates; TypeScript definitions and Dart DTOs generated |
| PostgreSQL | Five versioned migrations applied; existing data preserved |
| Dependency audit | 0 reported advisories in the full npm dependency tree |
| Browser | In-app browser sign-in options, invitation form, test-owner access, Team metadata and Account/session view inspected |
| Setup boundary | Bootstrap helper refuses a second enabled owner; disabled CLI invocation fails closed |
| Fixture cleanup | 0 remaining account-test outlets; 0 real owner password accounts provisioned for Shankarpally |

## Account evidence

- Password sign-in works with development adapters off for non-development accounts. Invalid passwords, wrong app audience and unknown handles fail generically.
- Invitations bind role/outlet, expire, revoke and accept only once. Two simultaneous acceptance requests produce one account/session and one conflict. Only owners manage workers; owner promotion/creation is not an invitation option.
- Password changes and recovery invalidate previous sessions and pending recovery codes. Session lists expose only the current user's metadata; tokens/hashes are not returned.
- Suspension immediately revokes access. Dispatch racing with suspension cannot leave an uncollected job assigned to the disabled rider. Picked-up jobs become staff-review delivery exceptions without changing payment, and require physical-return confirmation.
- A stale request captured before rider suspension cannot restore availability. The rider app clears cached tasks and contacts after revocation.
- Seeded identities, their invitations and resulting password accounts remain development-only. Previously issued development sessions also stop working when development mode is disabled.
- Database-backed throttles persist attempt counts and reject forwarded-header bypass attempts in the isolated test server. Real proxy configuration/load remains unverified.
- Passwords use salted, versioned scrypt hashes with bounded derivation concurrency. No plaintext passwords or invitation tokens are stored in the database.
- Integration fixtures use isolated outlets, generated test passphrases and targeted cleanup. No database reset or truncation was performed. The first real owner still needs the operator's local setup.

## Existing order/delivery evidence

Pricing and validated zone charges remain authoritative integer paise with item snapshots. Duplicate checkout/payment retries do not duplicate orders/events. Concurrent acceptance/assignment produces one winner. Unpaid or skipped transitions are rejected.

Riders can read only their tasks. Active assigned/picked-up jobs include necessary customer details; failed/history responses strip them. Kitchen responses omit delivery addresses. Delivery codes expire, enforce issuance/cooldown limits and lock after five incorrect guesses; failures commit their attempt counts. Repeated completion cannot duplicate fulfilment. Failed delivery never automatically cancels/refunds an order.

Widget tests exercise customer checkout/address entry, owner sign-in/dispatch/return confirmation, invitation validation and rider verification/reconnection. The interrupted-response test keeps completion unconfirmed until a server read reconciles it.

## Browser review

The refreshed in-app browser successfully showed Sign in, Use invitation and Test access. Test-owner sign-in loaded outlet records, Team controls and private active-session metadata. The Team view remains available in the preview.

Evidence: `docs/qa/team-access-2026-11-20.jpg`.

No real credentials were entered or changed through browser automation. Invitation activation/password mutation are verified by HTTP integration and mobile form tests. Comprehensive tablet/keyboard testing, two simultaneous browser sessions and full real-account browser onboarding remain unverified.

## Native/build limits

All APKs are development packages with debug signing and explicit test-login support. They target the emulator host API at http://10.0.2.2:3001/api and require a running backend. They are not standalone offline demos or app-store releases. A physical test phone needs an appropriate rebuilt API URL.

No native device/emulator was connected; installation, navigation/calling and a physical-device journey remain unverified. iOS compilation/signing requires macOS/Xcode.

Windows read-only attributes on generated Flutter/Gradle folders initially blocked cache replacement. They were repaired within the project; all final native builds passed. A bounded helper is available at `scripts/repair-flutter-cache.ps1`; source assets and database records were not deleted.

The PostgreSQL driver still emits an upstream query-concurrency deprecation warning during race tests. No pg 9 upgrade or workaround is claimed.

## Production gates

No default owner password exists. Use the local masked `npm run auth:bootstrap` procedure in `account_access.md` to provision the actual owner; disable its opt-in setting afterwards. Password access does not mean the entire platform is production-ready.

Remaining gates include customer phone/SMS, selected gateway/refund reconciliation, approved menu/tax/delivery policy, saved addresses/map pins, rewards/coupons, outbox/notification workers, remaining owner reporting, secure durable mobile sessions, TLS/service packaging, rate limits across other endpoints, backups/restores, monitoring, load/device testing and store release. MFA, retention and production security review remain open. Trusted proxy behavior must be configured deliberately.

The sample postcode 000000 is not an approved real service area. The health `otp` field refers to customer phone authentication; `deliveryVerification` describes the separate configured in-app handoff-code mechanism. Petpooja remains disabled and separately scoped. Original commercial figures and exclusions are unchanged.

## Local review

API: http://127.0.0.1:3001/api. Dashboard: http://127.0.0.1:5173.

Run `npm run dev:api` and `npm run dev:dashboard`. For sample access choose **Test access → Owner**; Team and Account are in navigation. Team actions from this identity create development-only accounts. Environment files remain ignored and PostgreSQL data stays in the persistent project volume.

Debug APKs:

- `apps/customer_app/build/app/outputs/flutter-apk/app-debug.apk`
- `apps/owner_app/build/app/outputs/flutter-apk/app-debug.apk`
- `apps/delivery_app/build/app/outputs/flutter-apk/app-debug.apk`
