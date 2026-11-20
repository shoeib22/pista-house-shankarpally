# Build scope

The authoritative scope, pricing and commercial exclusions are recorded in `../PISTA_HOUSE_BUILD_HANDOFF.md`. This implementation starts the build; it does not represent completion of the full launch package.

## Implemented initial slice

- Three distinct Android/iPhone Flutter project identities, shared API transport, generated contract DTOs and branded widgets.
- Customer browse/search/category/vegetarian filter; pickup/delivery checkout with address snapshot and server-side postal serviceability; separate saved-order/payment states; own-order history and delivery-code display.
- Employee password sign-in, invitation activation and optional development access; new/accepted/preparing/ready queues; acceptance/decline reason; kitchen updates; pickup collection; availability controls; shift audit.
- Owner order processing, app-only completed-sales summary, store pause, rider assignment and physical-return confirmation.
- Delivery app availability, assigned tasks/history, customer contact and external navigation, pickup, failed-delivery escalation and code-verified completion. Reconnect reads back server state before permitting further actions.
- Owner-only invitations, staff/rider recovery and suspension, current-password changes, session revocation, initial-owner bootstrap, server-side permissions and outlet scoping. Development-only accounts remain blocked outside development mode.
- PostgreSQL migrations and constraints; atomic order/event/outbox writes; purchased-item snapshots; hashed expiring sessions; version-based updates; creation/payment retry protection.

## Still to build

Customer phone authentication and production security hardening; real gateway integration, reconciliation and refunds; restaurant-approved prices, taxes, charges, delivery areas and policy; variants/add-ons; saved addresses and map pin selection; rewards/coupons/favourites/reorder; notifications; remaining owner controls and reporting/export; durable mobile sessions/retries across process termination; production service packaging, HTTPS, backups, monitoring and release readiness.

Delivery is now a connected development workflow. The sample postcode 000000 is explicitly disabled outside development mode; it is not a real service area. Phone login/profile settings remain initial screens. Outbox records are durable intents; no external notification or refund worker consumes them yet.

## Exclusions preserved

No customer web storefront, COD, automatic dispatch, continuous GPS, multi-outlet management or VPS rental. Petpooja is not implemented and remains separately authorised/scoped. No development timeline commitments or commercial changes are introduced.
