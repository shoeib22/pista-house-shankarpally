# Maps and live delivery tracking

Implemented 22 November 2026. This extends the earlier scope to location sharing during active deliveries. It does not add automatic dispatch, route optimisation or off-shift tracking.

## Customer journey

- In delivery checkout, choose **Choose delivery pin on map**. The confirmed outlet is the gold store marker.
- Search an area/landmark explicitly, use the phone's current location, or tap and adjust the entrance pin. Search does not run on every keystroke. Approximate GPS prompts the customer to adjust the pin.
- Confirm the pin and complete the address fields. Both latitude and longitude are saved in the order address snapshot. PIN-code serviceability still applies; a map pin cannot approve a new delivery area.
- A paid delivery has **Track your order** in Orders. It shows the outlet, destination, active rider, road route, non-traffic-aware travel estimate, live/offline status, fulfilment milestones and the order's authoritative item/fee/tax/total snapshot.
- The rider's location appears only after an active picked-up delivery has an explicitly enabled sharing lease and an accepted GPS fix. Missing/stale GPS never produces a live marker. The arrival estimate is a labelled range (see the staged estimate section below) and falls back to clearly marked defaults rather than pretending to be exact.

## Rider journey

- Confirm pickup, then press **Share live location**. Location permission is requested at that explicit action, not at app launch.
- A server-issued lease is required for every update. Starting a newer lease replaces the older publisher; older devices cannot stop or publish over the new lease.
- Updates use real geolocator positions, approximately every 5-10 seconds while sharing, with a 10-metre movement stream and periodic stationary refreshes. Inaccurate fixes above 100 metres and outdated fixes are rejected.
- **Stop sharing** cancels GPS collection and invalidates the current server lease. Delayed packets using the old lease are rejected. A network outage can leave the last received point visible until it becomes stale; the UI does not label it live without fresh snapshots.
- Android foreground location service permissions and its notification configuration are present. iOS location usage descriptions, location background mode and visible background indicator are configured. Runtime behaviour in background/lock/low-power conditions still requires physical iOS and Android testing. Force-quit/relaunch durability is not claimed.
- Completion, failure and suspension clear stored GPS and the lease. Only the latest point is retained; this implementation is not a movement-history recorder.

## Connection and access

Socket.IO uses **WebSocket transport only**, on the API's existing HTTP(S) server at `/api/tracking/socket.io`. An HTTPS base URL results in WSS. Tokens are sent in handshake `auth.token`, never in URL query strings. Connection middleware authenticates before accepting the socket.

| Event | Request | Result |
| --- | --- | --- |
| `tracking:watch` | `{orderId, lease?}` | Acknowledgement and `tracking:snapshot`; lease is for a rider publisher's ownership check |
| `tracking:start` | `{assignmentId}` | Assigned rider only; `{ok:true, lease}` after pickup |
| `tracking:position` | `{assignmentId, lease, latitude, longitude, accuracy, heading?, recordedAt}` | Accepted fix or a generic rejection acknowledgement |
| `tracking:stop` | `{assignmentId, lease}` | Invalidates that lease and clears its point |
| `tracking:snapshot` | Server event | Authorised current order/location snapshot |
| `tracking:ended` | Server event | Access ended; client clears its snapshot |

Customers can watch only their own delivery orders. Assigned riders can watch their current task. Owner/counter access is outlet-scoped; kitchen and unrelated riders cannot subscribe. Sessions are revalidated for every incoming action and periodic outgoing snapshot. Revocation disconnects existing sockets and removes a publisher's lease. Invalid clients are rejected before subscription. Connections and message rates are bounded.

Snapshots reconcile current database state every two seconds, including state changes made by employee/owner workflows. Reconnects resubscribe and obtain a fresh snapshot. This single-PC implementation does not require Redis or a separate broker.

The server accepts at most one position per assignment every three seconds, rejects older recorded fixes, and gates writes by the active assignment, rider, order state and lease in one conditional database update. GPS updates do not alter business transition versions.

## Providers and configuration

- Tiles: OpenStreetMap raster tiles for testing, with stable app identification and always-visible attribution. `MAP_TILE_URL` is a compile-time override; changing providers also requires their applicable attribution. Respect the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). No offline bulk download is implemented.
- Routing: `MAPS_ROUTING_URL` is an OSRM-compatible base URL. Beta uses `https://router.project-osrm.org`. Results are validated, bounded and cached for 30 seconds. The route endpoint's travel time excludes traffic and preparation; an unavailable provider produces an unavailable route state (the staged estimate then uses a labelled straight-line fallback). See the [OSRM API](https://project-osrm.org/docs/v26.4.0/http).
- Area search: `MAPS_GEOCODING_URL` is a Photon-compatible search endpoint. Beta uses `https://photon.komoot.io/api/`. The backend allows one uncached lookup per second across the process, returns up to five validated results, and caches queries for a day with bounded storage. Searches use the outlet as a location bias; customer names, phone fields and full checkout addresses are not automatically forwarded. See [Photon's demo-server policy](https://github.com/komoot/photon#demo-server). A production provider/private instance and privacy review remain launch requirements.
- Provider defaults are not silently enabled in production. If routing/search URLs are absent, the app explains that they are unavailable; map-pin selection still works.
- A reverse proxy must support WebSocket Upgrade for `/api/tracking/socket.io` as well as normal `/api` routes. Cloudflare Tunnel can proxy the same API port. Do not expose PostgreSQL to phones.

## Confirmed outlet pin

The user supplied [this restaurant listing](https://share.google/nmI95WRHeHxgbUZjk), which resolved to Pista House Shankarpally, Baba's Complex, Shankarpalli - Hyderabad Road. Its Maps place coordinates were verified as **17.4538158, 78.1410641**. The outlet's nullable database latitude/longitude fields hold the pin; migrations configure the existing Shankarpally row and new sample setup supplies the same point. No delivery zones or fees were approved by this location change.

## Verification and release boundary

Database migrations add outlet coordinates and the latest GPS/lease fields without resetting orders or volumes. Tests cover identity/outlet isolation, WebSocket reconnects, session revocation, consent stop/late-packet races, obsolete devices, position ordering/accuracy, stale/terminal states, provider outages and search throttling/caching. A direct Dart-to-Nest Socket.IO smoke check also passed with a temporary loopback-only fixture.

Both Android debug apps compile. The browser QA uses the actual Flutter widgets and an isolated order with **simulated GPS**. Native sensor/background and phone-network behaviour remain device-test gates. Existing TestFlight builds predate these changes; no updated iOS upload is claimed.

## Staged delivery estimate and marker smoothing (API 0.5.0)

`GET /api/orders/{id}/eta` returns a labelled **range**, not a promise. Stages: preparation, rider assignment, rider pickup, road travel and handoff. Only the stages still ahead are included, and elapsed time in the current stage is subtracted.

- Preparation, assignment and pickup durations are the **median of this outlet's last 30 delivered orders** once there are at least five samples for that stage; otherwise labelled defaults are used (15, 4 and 6 minutes). Handoff is a fixed 3-minute default.
- Travel is the configured road-routing duration from the rider's fresh position, or from the outlet before pickup. Without a routing provider it falls back to straight-line distance at a modest urban speed and is labelled `estimate`.
- The range is about -15% to +30% (plus 2 minutes). `confidence` is `history` only when every non-handoff stage came from history or road routing; otherwise `rough`, and the apps say so.
- It is **not traffic-aware**, and uses no weather or machine-learning model. Access follows the tracking snapshot permissions (customer, owner, counter, rider; kitchen and other customers are refused).

Clients also smooth the rider marker (`RiderGlide`): it slides between real fixes and, if the rider was moving at 1 m/s or more between the last two fixes, carries on in that direction for at most 4 seconds and 60 m (dead reckoning) until the next real fix corrects it. It is disabled with reduced motion and never runs when updates stop. The server still stores only the latest real position.

The owner app shows the rider's latest position (`RiderLocationPage`) using the same WebSocket subscription as the customer; no history is kept.
