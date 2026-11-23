# Notifications

Order updates, reminders and campaigns for customers, riders and staff.
Everything is saved to an in-app inbox first; a push to the phone is the extra
step, and works only once Firebase is connected (see "What you must provide").

## Priority tiers

| Tier | What | Rules |
|---|---|---|
| p0 | Order lifecycle, rider offers/assignments, refunds, support replies, staff "new order" | Never capped, never held for quiet hours, no opt-in needed |
| p1 | Reorder and abandoned-cart reminders | Customer opt-in ("reminders"), daily cap, quiet hours 22:00–08:00 IST |
| p2 | Promotions and nudges (lapsed, rainy day) | Customer opt-in ("promotions"), daily cap, quiet hours |

Opt-ins default to **off** (consent). Caps: `PUSH_PROMO_DAILY_CAP`,
`PUSH_MARKETING_DAILY_CAP`. A message due during quiet hours is held and sent at 08:00.

## How alerts are produced

* A poller (every 3 s) reads new order, dispatch, offer and refund events past a
  per-stream cursor. The first run starts "now", so history is never replayed.
  Each alert has a unique dedupe key, so a repeat never double-sends.
* Support: a customer message alerts staff; a staff reply (not an internal note)
  alerts the customer. Internal notes and their photos never reach the customer.
* Campaigns run every 5 minutes: **reorder** (inside the customer's usual
  weekday/hour window), **abandoned cart** (cart idle 30–180 min, via
  `PUT /api/me/cart`), **lapsed** (14–90 days), **rainy day** (Open-Meteo).
* Send-time optimisation: a nudge goes out only inside the customer's own meal
  window (default lunch 12:30, dinner 19:30).
* Copy variants are chosen by a Thompson-sampling bandit from opened/sent counts.
* A deterministic holdout (`PUSH_HOLDOUT_PERCENT`, default 10 %) is not sent
  anything; orders placed within 24 h count as conversions. `GET
  /api/notifications/report` (owner) shows sends, opens, conversions and lift,
  and flags samples too small to trust.

## Push delivery

`PUSH_PROVIDER=none` (default) stores only. `fcm` uses Firebase Cloud Messaging
HTTP v1 with a service-account JWT; dead tokens are removed automatically.
The FCM adapter's request signing and message shape are tested against a fake
server; **it has not been run against a real Firebase project.**

## What you must provide

1. A Firebase project; put `FCM_PROJECT_ID` and the service-account key in the server env.
2. For iPhones: an APNs key uploaded to Firebase, plus the Push Notifications
   capability and provisioning in Apple's portal and Codemagic.
3. `google-services.json` / `GoogleService-Info.plist` in the apps and the
   `firebase_messaging` plugin. Until then the apps show the in-app inbox,
   bell and a banner while open, but a closed app is not woken.

## Ratings, offers and picks

* **Rating prompt.** 30 minutes to 6 hours after an order is delivered or
  collected, customers who turned on reminders get one prompt (never twice, never
  if already rated). Customers rate 1 to 5 stars with an optional note
  (`POST /api/orders/:id/rating`, once per order). A rating of 3 or less alerts
  the owner and counter. The owner sees the average, distribution and low
  ratings (`GET /api/ratings/summary`), with a warning below 20 ratings.
* **Owner offers** (this covers flash deals and festival or event messages). The
  owner writes the title and message; the server sends exactly that text to
  customers who opted in to promotions, to all customers, recent orderers or
  lapsed ones, now or scheduled up to 30 days ahead. Limits: 3 offers a day,
  caps and quiet hours still apply. Nothing is invented: there is no discount
  engine, so write only offers you will honour.
* **Picked for you.** `GET /api/me/recommendations` ranks available dishes by
  what this customer orders (recent orders count more) plus what is popular this
  month, each with a plain reason. It is simple counting, not a learned model.

## Not built (deliberately)

SMS/WhatsApp fallback, a discount or coupon engine, a trained uplift model and
the Swiggy-style taste-graph recommender (it needs far more order data than a
single outlet has). No discounts or crowd numbers are invented.

## Endpoints

`GET /api/notifications`, `/unread-count`, `/preferences` (GET/PUT), `POST
/read`, `POST /:id/open`, `GET /report`, `POST /test`, `POST|DELETE /api/devices`,
`PUT /api/me/cart`, `GET /api/me/offers`, `GET /api/me/recommendations`, `GET|POST /api/offers`, `POST /api/offers/:id/cancel`, `GET /api/ratings/summary`.
