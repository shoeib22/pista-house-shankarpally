# Auto-assigning riders

Added 22 November 2026 (API 0.6.0). **Off by default.** The owner switches it on in the owner app (`Auto-assign riders`); manual assignment keeps working at all times and is the fallback.

## What it does

Every 15 seconds (`DISPATCH_INTERVAL_SECONDS`) the server looks at each outlet with auto-dispatch on:

1. **Housekeeping.** Offers that timed out become `expired`. Offers whose order is no longer `ready`, already has a rider, or whose rider went offline become `cancelled`.
2. **Orders in the window.** Paid delivery orders that are `ready`, have no active assignment and no live offer, oldest first (up to 50).
3. **Riders.** Online, enabled riders with no active delivery and no live offer.
4. **Cost matrix** (orders x riders), then **Kuhn-Munkres (Hungarian) minimum-cost matching** (`backend/src/matching.ts`). Beyond 80 orders or riders it falls back to a greedy pass in priority order, so a surge cannot stall the cycle.
5. **Offers.** Each matched pair gets a time-limited offer (30 s, `DISPATCH_OFFER_SECONDS`). The rider sees it in the delivery app and accepts or declines. Accepting creates the normal delivery assignment, so pickup, tracking, delivery-code verification and failure handling are unchanged. A rider who declines or lets an offer lapse is not offered that order again; if every online rider has been tried, the owner app says the order needs manual assignment.

## Cost function

```
cost(order, rider) = lastMile + 1.5*firstMile + 0.8*wait
                   + 0.4 * (deliveries by the rider in the last 3 h)
                   + 1.0 * (offers declined or missed in 24 h)
                   - 0.05 * (idle minutes, max 60)
                   - 0.5 * (minutes the order has waited)
```

- `lastMile` is the same for every rider on an order (outlet to customer, estimated from straight-line distance); `wait` is 0 because only ready orders are dispatched.
- `firstMile` is a fixed default (3 min) for everyone. **Idle riders do not share a location** (no off-shift tracking), so distance to the outlet cannot be measured. The practical effect is fair rotation: the least-loaded, longest-idle, most reliable rider is offered first, and older orders are served first when there are fewer riders than orders.

## No double-booking

Two partial unique indexes on `DeliveryOffer` allow **one live offer per rider and one per order**; the database rejects a second, so concurrent cycles cannot race. Accepting re-checks the order is still `ready`, paid and unassigned and bumps its version in the same transaction, exactly like manual assignment.

## Privacy

An offer shows only the area (landmark, city, PIN), straight-line distance, item count and pickup name. The customer's name, phone and street are revealed only after accepting, through the normal task data.

## Deliberately not built

- **Just-in-time early dispatch.** An order can only be assigned once it is `ready`; changing that would alter the payment and fulfilment state machine. Offers go out when food is ready.
- **Order batching/stacking.** A rider holds one active delivery (batch cap 1). The rider app, location sharing and delivery codes are per delivery.
- **Redis, H3/geohash, zone sharding.** One outlet and a handful of riders do not need them; Postgres provides the locking.
- **Live-traffic ETAs and per-rider road ETAs.** First-mile is a default, last-mile uses a straight-line estimate, and no machine-learning model is used.
- **Surge fees, incentives and rejection penalties.** Declines only lower a rider's priority for later offers.

## Rider map

The rider app has an in-app **Map** on active deliveries: the rider's position, the outlet (before pickup), the customer's pin and the road route with a time and distance per leg (`GET /rider/tasks/{id}/route`). The position is sent only to draw the route and is not stored. Navigate still opens an external maps app.

## Endpoints

`GET /rider/offer`, `POST /rider/offers/{id}/respond`, `GET /rider/tasks/{id}/route`, `GET /dispatch/status`, `PATCH /outlet/auto-dispatch` (owner only).
