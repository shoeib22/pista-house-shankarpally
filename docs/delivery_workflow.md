# Delivery workflow

The server owns delivery state, assignments and verification. Dispatch is manual. There is no automatic routing, continuous GPS tracking, cash collection or third-party delivery network.

## Serviceability and checkout

Delivery checkout requires a recipient, valid-format contact number, address, city and postcode. The server checks a matching active outlet postal zone and applies its integer-paise fee. Production zones must be approved; development-only zones are rejected when development adapters are disabled. The seeded postcode `000000`, address examples and INR 20 charge are illustrative. No real outlet service area has been approved. Map pin selection and saved addresses remain future work.

## Assignment and handoff

1. A paid delivery order proceeds through acceptance, preparation and ready.
2. Counter/owner selects an online outlet rider. The order version is checked atomically. A database partial unique index prevents two active assignments for one order.
3. The rider confirms pickup. Assignment becomes `picked_up`; order becomes `out_for_delivery` in the same transaction.
4. The owning customer requests a delivery code from their app. Only that customer receives the code, and the app can reopen its cached code until expiry.
5. The assigned rider enters the code at handoff. Successful verification atomically marks the assignment/order delivered, closes the active assignment, and records events/outbox/audit. Repeated or stale completion requests cannot duplicate fulfilment.

Assignments retain their own history. An assigned job can be unassigned by staff before pickup; a replacement is a new record. Going offline does not discard existing jobs.

## Code protection

Codes have six digits and are generated server-side. Storage contains a salted HMAC, never plaintext; the stable server secret stays outside source control. Codes expire after ten minutes. Each assignment permits five guesses and up to three issuances; renewal requires a one-minute cooldown and never resets the guess count. Failed guesses commit their counters even though the HTTP response is an error. Exhausted verification requires outlet intervention; staff cannot override a delivery to completed. No SMS is sent by this workflow.

## Exceptions and reconnection

A rider can report a failure with a reason after pickup. Assignment remains active/failed; order becomes `delivery_failed`; payment remains unchanged. Counter/owner must confirm physical return before the order becomes ready for another assignment. Failure never implies cancellation or refund. Owner suspension also revokes rider access immediately: uncollected tasks are unassigned, while picked-up tasks move to delivery exceptions pending physical return. Payment remains unchanged.

The rider app never optimistically marks pickup/completion. An interrupted response is shown as unconfirmed; the app refreshes server state and disables mutations while disconnected. If the server completed the action before the connection dropped, a successful refresh reconciles it without sending another completion. State versions reject stale updates. Queue persistence across an app process restart remains future work.

## Privacy

Riders list only their own tasks. Contacts and addresses are returned only for their active assigned/picked-up jobs and removed from failed/history responses. Riders cannot request customer codes, browse outlet orders, or use dispatch controls. Kitchen order responses omit addresses. Tests exercise these restrictions through HTTP against PostgreSQL.
