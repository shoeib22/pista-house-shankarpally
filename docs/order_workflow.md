# First order workflow

Pickup and delivery are implemented as development workflows. Delivery requires an address snapshot and an active approved postal zone; the single sample zone 000000 works only with explicit development adapters. See `delivery_workflow.md` for dispatch and verification.

1. Customer sends product IDs and quantities with `Idempotency-Key`.
2. A serializable database transaction revalidates outlet availability and product prices. Integer-paise totals and purchased item snapshots are saved before payment.
3. Payment remains `pending`. The counter cannot accept the order.
4. The development payment adapter records one payment event, changes payment to `paid`, and writes an outbox event atomically. This is not a gateway callback.
5. Counter accepts (`accepted`), kitchen starts (`preparing`) and marks `ready`.
6. Counter confirms pickup (`collected`).

Every fulfilment action includes the last observed order version. A conditional update permits one winner; stale or invalid changes return 409. Audit and order events are part of the same transaction. Duplicate create requests with the same key and payload return the existing order; a changed payload with that key is rejected. The unique customer/key constraint is durable across API restarts.

Declining requires a reason. A paid declined order remains paid and creates a `refund.review_required` outbox record. There is no claim that a refund occurred. Automated refunds and rejection policy remain future work.

The catalogue currently uses illustrative tax-inclusive prices with zero additional tax. Delivery charges come from the validated zone (sample INR 20). No production tax, fee, coupon or delivery policy is inferred from proposal images.

The dashboard polls every four seconds and disables actions after connection failures. Stale-version rejection protects concurrent sessions. Mobile checkout retains its idempotency key during a timeout within the running app. The rider app marks an interrupted mutation unconfirmed and reconciles against server state before permitting further changes. Durable mobile retry/session storage across process termination remains unimplemented.
