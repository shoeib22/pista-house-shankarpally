# Payments

Added 23 November 2026 (API 0.9.0). **What exists: the payment page, the server APIs, the webhook, refunds and reconciliation, all written against a provider interface.** What does not exist yet: a live gateway account, the gateway's mobile SDK in the app, and any real money moving. Today the private beta uses the built-in **simulated** provider (no money).

## The one rule

**The server decides when an order is paid, never the app.** An order becomes paid in exactly one place (`Payments.settle`), reached only from:

1. a **signature-verified webhook** from the gateway, or
2. the server **asking the gateway directly** (when the app says it finished, and on a one-minute sweep for anything a webhook missed).

The app's "I paid" is only a prompt to check. If the gateway hands the app a signed proof, the server verifies it *and still* asks the gateway. The amount always comes from the order's stored total, and the gateway's reported amount must match it or the payment is parked as `mismatch` for the owner.

## Flow

```
order saved (pending) -> POST /orders/{id}/payments   -> {paymentId, amount, public checkout values}
app opens the gateway checkout (SDK)                   -> customer pays in their bank / UPI app
gateway -> POST /payments/webhook/{provider}           -> verified, applied once  -> order paid
app    -> POST /payments/{id}/confirm                  -> server checks gateway   -> order paid
sweep  (every 60 s)                                    -> catches missed webhooks, expires sessions
app    -> GET  /orders/{id}/payment                    -> paid / failed / expired / still pending
```

## Payment states

`Payment.status`: `created` (waiting) -> `paid` | `failed` | `expired` | `cancelled` | `mismatch`. A late success on a `failed` or `expired` session still pays the order. The order's own `paymentStatus` stays `pending` until paid, then `paid`, and `refunded` after a full refund.

- **Sessions** last 15 minutes. One live session per order is reused, so a double tap cannot create two. At most **5 attempts** per order.
- **Failed attempt** -> the app offers "Try again", which creates a fresh session.
- **Slow UPI** -> the app keeps asking for about 90 seconds, then tells the customer *not to pay again*; the sweep keeps checking until the session expires.
- **Abandoned order**: an unpaid order older than `UNPAID_ORDER_MINUTES` (default 30) with no open payment is closed as `rejected` with the event `payment.timeout`. (The database only allows the existing statuses, so `rejected` is used rather than inventing `cancelled`.)

## Money that arrives when it should not

If a payment succeeds for an order that is **already paid** or **already closed**, the order is not touched and a **refund is created and sent to the gateway automatically** (`duplicate_payment` / `order_not_open`), with an audit record and an outbox event. Nothing is silently kept or lost.

## Refunds (owner only)

`POST /orders/{id}/refunds` with an `Idempotency-Key` header and `{reason, amountPaise?}` (default: everything left).
- Never more than was paid; repeating a key returns the same refund; a refund that the gateway rejects is saved as `failed` with the reason and can be retried with a new key.
- A **full** refund is refused while the order is still being prepared or delivered (reject or complete it first), and marks the order `refunded`. Partial refunds leave it `paid`.
- Rejecting an order still only creates a `refund.review_required` record; **refunds are never automatic except the duplicate/closed-order case above**, because refund policy is the restaurant's decision.
- `GET /payments/reconcile` lists payments open too long, amount mismatches and failed or stuck refunds; `POST /payments/reconcile/run` checks now.

## Providers

`PAYMENT_PROVIDER` picks the adapter (`backend/src/payments/providers.ts`).

| Provider | State |
|---|---|
| `simulated` (default) | Works. Moves no money. Refused unless the server is in explicit development or private-beta mode. The app shows a test checkout where you choose success, decline or "pending". |
| `razorpay` | **Written from Razorpay's documentation and covered by signature and fake-gateway tests, but never run against a real Razorpay account.** Test it end to end in Razorpay test mode first. |

To add another gateway, implement the `PaymentProvider` interface (create session, check status, verify webhook, refund) and register it in `currentProvider()`/`providerNamed()`. Nothing else changes.

## Go-live checklist (what you still need to do)

1. **Create the gateway account** and complete its business verification (KYC). Start with **test mode** keys.
2. **Put the secrets on the server only**, in `backend/.env` (never in the app or git):
   `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (a *separate* secret you choose when you create the webhook). Restart the API.
3. **A stable HTTPS address for the webhook.** In the gateway dashboard add the webhook `https://<your-host>/api/payments/webhook/razorpay` and enable `payment.captured`, `payment.failed`, `refund.processed` and `refund.failed`. The PC's temporary tunnel address changes on every restart, so it is only good for a short test; real payments need the proper server.
4. **Turn on auto-capture** in the gateway dashboard. A payment that is only *authorized* and never captured is refunded by the gateway after a few days and the order would never be marked paid.
5. **Install the gateway's checkout in the customer app.** One file: `apps/customer_app/lib/features/payment/payment_launcher.dart`, class `GatewayLauncher` (the comments give the Razorpay steps). Add the plugin, follow its Android/iOS setup, return the gateway's proof. Nothing else in the app changes. Until then a non-simulated provider shows "this build does not include the checkout".
6. **Test in the gateway's test mode**: a successful payment, a declined card, a UPI payment left pending, closing the checkout, paying twice, a webhook arriving before the app finishes, and a refund (full and partial).
7. **Verify the settlement details** with the gateway (fees, settlement schedule, GST invoices) and the restaurant's refund and cancellation policy. Those are business decisions, not code.
8. Check the owner's `payments/reconcile` view after the tests, then switch to live keys.

## Known limits

- Only Razorpay is written, and it is unverified against the live service. Event and field names were taken from its documentation; confirm them in test mode.
- One payment method flow (the gateway's hosted checkout). Saved cards, wallets and cash on delivery are not built; COD is out of scope.
- Refund policy (when to refund, how much) is manual by design.
- The owner app has no refund screen yet; refunds use the API (`POST /orders/{id}/refunds`).
- The old `development-payment` and `beta-payment` endpoints still exist for builds installed before this change and work only in development/beta. They can be removed once those builds are retired.
