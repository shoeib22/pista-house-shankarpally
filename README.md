# Pista House · Shankarpally

Single-outlet ordering platform. Three Flutter mobile apps, an internal React employee dashboard, and a shared NestJS/PostgreSQL backend. The physical-server architecture and commercial scope remain defined by `PISTA_HOUSE_BUILD_HANDOFF.md`.

## Current build

The connected development workflow supports pickup and delivery: sample catalogue → saved order and authoritative totals → explicit test payment → staff acceptance → kitchen preparation → pickup collection, or manual rider assignment → rider pickup → customer-code verified delivery. The owner app processes orders, assigns riders, handles returned deliveries and pauses new orders.

All catalogue content is illustrative. No live restaurant data or actual payments. Public customer web ordering is outside scope.

Staff/rider password sign-in, owner invitations/recovery, suspension, passphrase changes and session revocation are now connected. These work independently of development login. Customer phone verification remains separate and unconfigured.

## Local setup

Requirements: Node 22+, Docker Desktop with Linux containers, Flutter 3.44+/Dart 3.12+. Windows can build Android; iOS compilation and signing require macOS/Xcode.

1. `npm ci`
2. Copy `infrastructure/.env.example` to `infrastructure/.env`; set a unique development database password.
3. Copy `backend/.env.example` to `backend/.env`; use that password in `DATABASE_URL`, explicitly set `DEV_ADAPTERS=true`, and set `DELIVERY_OTP_SECRET` to at least 32 random characters. Keep it private and stable across API restarts.
4. `docker compose -p pista-house -f infrastructure/compose.yaml --env-file infrastructure/.env up -d`
5. `npm run db:generate`
6. `npm run db:migrate`
7. `npm run db:seed`
8. In separate terminals: `npm run dev:api` and `npm run dev:dashboard`.

Open http://127.0.0.1:5173. Use **Sign in** for password accounts or **Use invitation** to activate a staff code. For samples choose **Test access**, then a counter/kitchen/owner identity. Development access is explicitly opt-in and refused in production. Previously issued test sessions and development-only password accounts also stop working when development adapters are disabled.

There is no default owner password. First-owner setup uses masked interactive `npm run auth:bootstrap`, temporarily enabled by `ALLOW_OWNER_BOOTSTRAP=true`. See `docs/account_access.md` for the full procedure. No real owner was provisioned by the build.

### Mobile apps

Run from the appropriate app folder (`apps/customer_app`, `apps/owner_app`, `apps/delivery_app`):

```powershell
flutter pub get
flutter run --dart-define=ALLOW_DEVELOPMENT_LOGIN=true --dart-define=API_URL=http://10.0.2.2:3001/api
```

`10.0.2.2` is the Android emulator's host address. For a physical test phone, configure the development computer's LAN URL and set `HOST=0.0.0.0` deliberately on a trusted network. Release builds require HTTPS, production signing and a production identity provider. Debug Android manifests permit development HTTP; release manifests do not.

The customer can browse before signing in. Add items, open the order, save it, review the authoritative total and confirm the test payment. The verified order then appears at the employee order desk. Counter staff accept it; counter/kitchen staff start preparation and mark it ready; counter staff confirm pickup. The owner can pause new checkouts. Existing pending payments can still complete while paused.

For delivery, select Delivery at checkout and enter a sample address with postcode `000000`. This is a development-only service zone with an illustrative INR 20 delivery charge, not a real approved area. Sign in to the delivery app and go online. Assign the ready order in the employee Delivery view or owner app; confirm pickup in the rider app. The customer requests a delivery code from their order, shares it at handoff, and the rider verifies it. Codes expire after ten minutes and lock after five failed guesses. No SMS is sent.

Failed deliveries remain paid and require staff to confirm physical return before reassignment. Task history preserves earlier riders; customer contacts are removed from rider history. See `docs/delivery_workflow.md` for the exact rules.

## Checks

```powershell
npm run build
npm test
npm run contract:generate
# In each Flutter app:
flutter analyze
flutter test
```

API integration tests require the seeded, dedicated development database. They create unique orders and remove only their own test records. No database reset or truncation is performed. See `docs/BUILD_STATUS.md` for observed results and verification limits.

`docs/api_contract.yaml` is an OpenAPI 3.0 contract serialized as JSON (valid YAML). `npm run contract:generate` validates it and regenerates TypeScript definitions and Dart DTOs. Both applications use shared API transports; fully generated endpoint clients remain a later refinement. To populate the order desk with three explicit development orders, run `npm run demo:orders` while the API is running. Each invocation creates new test orders.

`npm run demo:delivery` creates two explicit sample deliveries and marks the sample rider online. Each invocation creates new test records; it never submits an actual restaurant order.

## Configuration and next gates

Customer phone authentication, live gateway/refund handling, restaurant-approved catalogue/taxes/service zones, saved addresses/map pin selection, rewards/coupons, push/SMS and production operations remain further build gates. Serviceability currently checks approved postcode zones, not distance or polygons. The transactional outbox is written, but no notification worker is running. Petpooja is not configured and remains separately scoped.

On Windows, if Flutter/Gradle cannot replace read-only generated artifacts, run `pwsh -File scripts/repair-flutter-cache.ps1` from the repository root. This changes attributes only inside the three apps' generated folders; it does not delete data or follow links.

See `docs/account_access.md`, `docs/permissions.md`, `docs/order_workflow.md`, `docs/operations.md`, and the API contract. Never commit `.env`, signing material or real provider credentials.
