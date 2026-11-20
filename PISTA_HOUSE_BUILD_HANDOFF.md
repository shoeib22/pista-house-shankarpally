# Pista House Shankarpally — Build Handoff

Last updated: 16 November 2026. Time zone: Asia/Kolkata.

This file captures the product decisions, scope, design direction, commercial terms, architecture and build plan from the planning chat. Read it before implementing anything. Use the accompanying UI images and proposal as references.

## 1. Start here

Build a single-outlet direct-ordering system for **Pista House Shankarpally** with these four interfaces:

1. Customer mobile app, Android and iPhone.
2. Delivery-partner mobile app, Android and iPhone.
3. Owner mobile app, Android and iPhone.
4. **Employee web dashboard** for counter staff, kitchen coordination and rider dispatch, responsive for desktop and tablet.

All four use one shared backend and database on a client-owned physical server.

**There is no public customer web storefront in the agreed scope.** A customer ordering website was generated earlier by mistake and then explicitly removed. Do not restore it or treat it as an additional deliverable. The employee dashboard is the web interface.

The user requested this handoff to start implementation in another chat. Application development has not started. At handoff, this project contains documentation, proposal and design assets, not a working application. No server or hardware has been purchased, no developer accounts have been configured, and Petpooja API access has not been obtained.

Current workspace:

```text
C:\Users\Shoeii\Documents\ChatGPT\pista house
```

Keep the Pista House application in this repository. The unrelated `xerovolt` project previously held proposal outputs; do not modify or depend on that project. The current reference files have been copied here.

## 2. Source files and design references

All paths below are relative to this repository and are portable with the project:

| File | Purpose |
| --- | --- |
| `docs/proposal/Pista-House-Shankarpally-App-Proposal.pdf` | Latest 24-page proposal, including corrected employee dashboard scope |
| `docs/design/pista-house-official-logo.svg` | Official logo source; use this where practical |
| `docs/design/pista-house-official-logo.png` | Raster version of the official logo |
| `docs/design/app-home-transparent.png` | Customer home concept |
| `docs/design/app-menu-transparent.png` | Customer menu concept |
| `docs/design/app-checkout-transparent.png` | Customer checkout concept |
| `docs/design/app-delivery-transparent.png` | Delivery-partner task screen concept |
| `docs/design/app-owner-transparent.png` | Owner overview concept |
| `docs/design/app-employee-transparent.png` | Correct employee web dashboard concept |
| `docs/design/biryani-cover.png` | Generated food photography used in the proposal |
| `docs/design/biryani-menu.png` | Generated menu food photography |

The phone mockup images have transparent external backgrounds. Preserve that transparency when presenting them. The actual application should be built with native widgets or web components; do not implement it as a full-screen screenshot.

Reference screens are design concepts, not evidence of implemented functionality. Displayed prices, orders, counts, sales and other numbers are illustrative. Generated food images do not depict verified restaurant dishes. Obtain restaurant-approved content before production.

Starting design tokens, matching the current concepts:

```text
Primary interface green     #17613B
Warm white surface          #FFFEFA
Ivory background            #F7F3E9
Main text                   #202820
Restrained antique gold     #B59A5B
```

Preserve the official logo's own colours and proportions. Its source asset includes space and supporting text below the capsule; use the capsule badge portion in compact application headers, as shown in the concepts. Do not replace it with plain typed text or a newly invented logo.

Use a legible modern sans serif for controls and operational information. Reserve an editorial serif for selected customer-facing headlines. Keep employee controls practical and readable, with clear status labels, thin dividers and consistent spacing. No ornate flourishes, giant gold buttons, heavy gradients or decorative nested panels.

## 3. Important user decisions

- Keep Pista House's identity and official green-and-gold logo.
- The requested visual style is **clean, refined and royal**. Avoid generic luxury decoration.
- Use photorealistic generated food images for concepts; the user rejected illustrated food and drawn phone interfaces.
- Use clear spacing, restrained typography and Pista green controls on predominantly white/ivory surfaces.
- Remove studio backgrounds surrounding mockups; current concept files already have transparent backgrounds.
- Do not include competitor branding or mention the earlier restaurant benchmark in the product or proposal.
- No project timelines, week estimates or delivery-date commitments. Build order and acceptance gates are fine. Monthly/annual fees are billing terms, not development timelines.
- Physical server hosting replaces the earlier VPS idea. Do not reintroduce a monthly VPS rental.
- Delivery uses restaurant-managed riders and manual assignment initially.
- Employee web dashboard is internal and authenticated, not customer-facing.
- English interface at launch. Additional languages remain future work.
- Start with one outlet. Retain an outlet identifier in records and permissions, but do not build multi-outlet management as launch scope.

## 4. Commercial baseline

These are the figures requested for the proposal. Do not silently change them during scaffolding or implementation.

| Item | Amount / basis |
| --- | --- |
| One-time development package | **INR 75,987** |
| Estimated physical-server hardware package | **INR 34,000**, additional to development |
| Maintenance and support retainer | **INR 4,000 per month** from production go-live |
| Apple Developer Program | Published reference: **US$99 per membership year**, local checkout pricing applies |
| Google Play Console registration | Published reference: **US$25 one time**, local payment/tax treatment applies |
| Internet, public static IP, electricity and off-site backup storage | Additional, at actual cost |
| Domain registration / renewal | Additional |
| Gateway, OTP/SMS, maps and other metered third-party services | Additional as applicable |
| Future functionality beyond launch scope | Separately estimated and approved |
| Petpooja integration work and Petpooja charges | Separately scoped; not included in the INR 75,987 baseline |

The latest proposal includes customer, delivery and owner mobile interfaces plus employee web dashboard within the development package. Hardware, external services and the conditional Petpooja integration are separate.

The contractual monthly retainer is INR 4,000; that does not mean the server has no operating costs.

First-year base subtotal, excluding developer fees, operating costs, applicable taxes and extras:

```text
Development                  INR 75,987
Estimated hardware           INR 34,000
12 months support            INR 48,000
Base subtotal                INR 1,57,987
```

Proposed development payment milestones from the proposal:

- 20% kickoff: INR 15,197.40.
- 30% design approval: INR 22,796.10.
- 30% UAT-ready build: INR 22,796.10.
- 20% handover: INR 15,197.40.

Support covers routine monitoring, bug resolution, security patches and assistance with existing functionality. The proposal also includes staff training and a 30-day launch defect warranty. Support hours and response targets have not been agreed; do not invent an SLA or unlimited-development entitlement.

The physical hardware estimate is a planning allowance, not a supplier quotation or confirmed stock offer. Nothing has been ordered.

## 5. Customer application scope

### Discover and choose

- Browse the menu before authentication.
- Search products and browse categories.
- Show restaurant-supplied veg/non-veg and dietary information.
- Display descriptions, portions, variants, add-ons and availability.
- Support favourites and repeat ordering.
- Revalidate prices and availability when reordering historical items.

### Checkout

- Phone verification when needed for checkout.
- Saved addresses, map pin and landmark.
- Check approved delivery zones before allowing delivery checkout.
- Delivery and takeaway pickup modes.
- Server-calculated item prices, add-ons, discounts, taxes and charges.
- Online payments through the client's selected gateway.
- Clear pending, failed and successful payment states.
- Coupon limits and basic loyalty points.

### After ordering

- Order acknowledgement and supported preparation/dispatch updates.
- Order history and detail.
- Clear support action.
- Cancellation and refund status according to agreed restaurant rules.
- Reward points earned only for eligible completed orders; reversals handled for refunds.
- Notification preferences and permission handling.

COD is not established launch scope. Do not add cash collection or rider cash-settlement functionality without a separate decision.

## 6. Delivery-partner application scope

- Invited rider account and authenticated access.
- Availability / online status.
- Assigned-task list and delivery history.
- Pickup order details, item/bag information and payment status.
- Customer address and necessary contact details for the active assigned job.
- Pickup confirmation and delivery progress.
- Open an external navigation application.
- Delivery completion with OTP verification.
- Failed-delivery reason and escalation to the outlet.
- Notifications for assignments and relevant changes.

Riders must not browse other riders' tasks, unrelated customer data, owner analytics or payment administration.

Manual assignment by authorised staff/owner is included. Automatic dispatch, route optimisation, continuous background GPS tracking and third-party delivery-network integration remain future work.

Handle interrupted connectivity: show pending actions, retry safely and reconcile with server state. Do not display an unconfirmed offline action as a completed server-side delivery.

## 7. Owner application scope

- Owner authentication and outlet access.
- Sales and order summaries for data actually held by the system.
- Active order overview and actions requiring owner permission.
- Order acceptance and progress controls.
- Rider assignment.
- Menu availability / sold-out controls.
- Store pause and relevant outlet settings.
- Coupon settings.
- Refund approval with audit trail.
- Notifications, order history and reports/exports.

Without an approved reporting integration, the owner app reports our app's orders, not every dine-in, counter or aggregator sale in Petpooja. Do not label app-only revenue as total restaurant revenue.

## 8. Employee web dashboard scope

Build an authenticated staff operations application for desktop and tablet.

- Employee login, invitation and role-based access.
- New-order alerts with a visible acknowledgement path.
- Accept or decline orders, with restaurant-agreed reasons and rules.
- Kitchen queue grouped by new, preparing, ready and dispatched states.
- Preparation and ready-status updates.
- Delivery/pickup filters and order-ID search.
- Manual rider assignment and assignment status.
- Pickup collection confirmation.
- Menu item availability / sold-out controls, according to permission.
- Store pause, according to permission.
- Shift activity / operational audit history.
- Failed synchronisation and delivery exceptions where applicable.

Counter staff and kitchen staff should not automatically receive owner privileges. Refund approval, reporting access, menu-price editing and user administration require explicit permissions.

Do not build a public web shopping cart, customer website checkout or customer storefront as part of this interface.

## 9. Shared workflows and source of truth

Standalone order flow:

```text
Customer places order
  -> backend calculates and stores authoritative totals
  -> gateway payment is verified
  -> employee accepts / declines under agreed policy
  -> kitchen prepares
  -> order becomes ready
  -> rider assigned for delivery, or pickup collection confirmed
  -> rider confirms pickup
  -> delivery verified
  -> eligible rewards and reporting updated
```

Persist the order before initiating gateway payment; confirmation depends on verified payment state and restaurant workflow. Make cancelled, failed and payment-pending paths explicit. Agree what happens when payment succeeds but the outlet cannot fulfil the order.

Keep payment state separate from fulfilment state. For example:

```text
Payment: pending -> paid -> partially_refunded / refunded
         pending -> failed / expired, as supported by the gateway

Order: awaiting_acceptance -> accepted -> preparing -> ready
       ready -> out_for_delivery -> delivered
       ready -> collected                 (pickup)
       cancellation / rejection paths follow explicit rules
```

Delivery assignments have their own lifecycle and history. A failed delivery does not automatically mean a cancelled order or a completed refund.

The backend must enforce state transitions, permissions and idempotency. Multiple staff screens accepting the same order must result in one valid transition. Retried payment callbacks must not create duplicate orders, refunds or points.

## 10. Recommended technical architecture

This was the recommended starting architecture in the planning chat; no packages or project scaffolds have yet been created.

| Layer | Starting choice |
| --- | --- |
| Customer, delivery and owner apps | Flutter, Android and iPhone targets |
| Employee dashboard | React + TypeScript + Vite |
| API | NestJS + TypeScript, modules in one backend |
| Database | PostgreSQL |
| Data access | Prisma with versioned migrations |
| Contract | OpenAPI, generated Dart and TypeScript clients |
| Deployment | Linux physical server, Docker Compose or equivalent reproducible services |
| Edge | HTTPS reverse proxy serving dashboard, API and permitted media |
| Background work | Durable PostgreSQL-backed jobs / transactional outbox |

Use one modular backend initially. Keep integrations behind adapters. Avoid adding microservices, Kubernetes or a separate Redis dependency without a demonstrated requirement.

Flutter apps should share components, API models and infrastructure while keeping role-specific screens and navigation separate. Follow a feature-based layout with view models and repositories/services. Keep order pricing, permissions and financial rules on the backend.

The React dashboard can be served as static built files by the same reverse proxy. Mobile applications and the dashboard call the API; they never connect directly to PostgreSQL.

Use provider adapters for payment gateway, OTP/SMS, push notifications, navigation and Petpooja. Real credentials must stay server-side. Missing credentials must produce an explicit not-configured state; development mocks must be clearly labelled and disabled in production.

Mobile push may depend on FCM/APNs and OTP on an external provider. A physical backend does not remove those dependencies. iPhone builds and signing need a suitable macOS/Xcode build environment, separately from the Linux hosting server.

## 11. Proposed repository structure

```text
pista-house/
├── PISTA_HOUSE_BUILD_HANDOFF.md
├── apps/
│   ├── customer_app/
│   ├── delivery_app/
│   ├── owner_app/
│   └── employee_dashboard/
├── packages/
│   ├── mobile_ui/
│   ├── mobile_core/
│   ├── mobile_api/
│   └── web_api/
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   ├── users_permissions/
│   │   ├── outlet/
│   │   ├── menu/
│   │   ├── orders/
│   │   ├── payments_refunds/
│   │   ├── delivery/
│   │   ├── rewards_coupons/
│   │   ├── notifications/
│   │   ├── reports/
│   │   ├── audit_logs/
│   │   ├── jobs/
│   │   └── integrations/
│   │       └── petpooja/
│   ├── database/
│   │   ├── migrations/
│   │   └── seed/
│   └── tests/
├── infrastructure/
│   ├── compose.yaml
│   ├── reverse_proxy/
│   ├── backups/
│   └── monitoring/
├── assets/
│   ├── brand/
│   └── food/
└── docs/
    ├── design/                # Existing reference images
    ├── proposal/              # Existing latest PDF
    ├── scope.md
    ├── permissions.md
    ├── order_workflow.md
    ├── api_contract.yaml
    └── operations.md
```

Everything except this handoff and the copied reference folders is proposed structure, not existing code. In particular, a proposed `petpooja` folder does not mean an integration is implemented or included commercially.

Example Flutter feature layout:

```text
features/orders/
├── screens/
├── view_models/
├── repositories/
└── widgets/
```

Share generated API types, not database credentials or server-only business logic. Use distinct application identities and role-specific navigation for the three mobile apps; server permissions remain authoritative regardless of client identity.

## 12. Data model requirements

Core records:

- Access: users, roles/permissions, outlet memberships, invitations, sessions and notification devices.
- Catalogue: outlet, opening/ordering configuration, delivery zones, categories, products, variants, add-ons, dietary labels and availability.
- Ordering: orders, item/price snapshots, applied charges, addresses, fulfilment type, order events and cancellation reasons.
- Money: payment attempts, provider events, refunds, coupons/redemptions and reward ledger entries.
- Delivery: rider availability, assignments, assignment history, pickup/delivery events and expiring delivery verification challenges.
- Operations: notifications, audit events, background jobs/outbox and integration attempts.
- Conditional integration: provider outlet mapping, product/variant mapping, external order IDs, sync state, webhook events and reconciliation records.

Use INR integer paise for calculations and stored money amounts. Persist purchased item names, prices, variants, charges and tax information as snapshots so later menu edits do not change historic bills. Store timestamps consistently and display local operational dates in Asia/Kolkata.

Use constraints and transactions for order creation, payment-event deduplication, coupon limits and reward/refund updates. Maintain a traceable history rather than overwriting financial facts.

## 13. Physical server plan

Recommended budget configuration:

- Refurbished Dell OptiPlex 7060 Micro or equivalent business mini PC.
- Intel Core i5-8500T or equivalent six-core processor.
- 16 GB RAM.
- 512 GB SSD, preferably NVMe.
- Gigabit wired Ethernet.
- Ubuntu Server LTS with API, database, dashboard and reverse proxy.

Estimated one-time allowances:

| Component | Allowance |
| --- | ---: |
| Refurbished mini PC with RAM and SSD | INR 20,000 |
| UPS / power protection | INR 8,000 |
| External backup drive | INR 4,000 |
| Basic networking / cables | INR 2,000 |
| Total | **INR 34,000** |

Confirm supplier quote, CPU, disk health, cooling, warranty, final tax, stock and burn-in results. A matching Dell offer at INR 20,000 has not been verified as available. Router changes or failover equipment beyond this allowance may cost extra.

Operational prerequisites:

- Business broadband with a public static IP and inbound connectivity, or an explicitly approved alternative exposure method.
- Confirm no carrier-grade NAT or blocked ports for the chosen setup.
- Public HTTPS endpoints for apps, gateway callbacks and approved integration callbacks.
- Firewall, restricted admin access and no public database exposure.
- UPS for both server and network equipment; determine real runtime under load.
- Cool, secure installation away from kitchen heat.
- Local encrypted backup and separate off-site copy; test restore.
- Monitoring for availability, disk usage, errors, stuck orders and payment mismatches.
- Recovery procedure for host, disk, power and connection failure.

This is one physical host and a single point of failure. Do not promise high availability or treat a USB backup drive as an off-site backup. Do not expose an unauthenticated dashboard or direct database port to the internet.

Combined sizing assumptions for validation:

```text
50 customer app sessions
10 delivery-partner sessions
 5 owner / employee sessions
20 API requests per second combined
```

These are engineering test targets, not measured capacity, user forecasts or a performance guarantee. Exercise representative order writes, dashboard updates, rider events and payment callbacks. Proposed API targets are p95 below 1 second, error rate below 1%, and no duplicate or lost orders. Test asset delivery separately as part of the actual usage profile. Increase or change resources if the completed build fails the acceptance tests.

## 14. Petpooja integration — conditional extension

The user asked whether the system can link with Petpooja. The answer was yes in principle, subject to Petpooja enabling and approving integration access for this outlet. **No API access or outlet-specific capability has been confirmed.**

Potential capabilities to verify with Petpooja:

- Menu, item, variant, add-on, pricing and tax synchronisation.
- Item/store availability updates.
- Pushing custom-app orders into the POS.
- Supported acceptance, preparation, cancellation and other order callbacks.
- KOT/billing behaviour for integrated orders.
- Reporting access and whether it covers all outlet sales or only this integration's orders.

Do not assume the online-ordering API grants unrestricted inventory, reporting, accounting, refund or menu-write access. Generic marketing claims about integrations are not proof of permissions for this outlet.

Recommended architecture if Petpooja is enabled:

```text
Customer / rider / owner apps + employee dashboard
                    |
                Our backend
                    |
         Petpooja integration adapter
                    |
          Approved Petpooja API / POS
```

Recommended ownership split, pending API confirmation:

- Petpooja: master menu/pricing and POS billing/kitchen workflow.
- Our system: app accounts, app-specific loyalty, rider workflow and delivery verification.
- Employee dashboard: connected-order view, permitted actions, dispatch and sync exceptions.
- Owner reporting: label its scope accurately; show full-POS revenue only with approved reporting access and reconciliation.

Resolve overlaps before implementation. Do not let both systems independently edit the same menu field or accept an order without an agreed authority. Some dashboard actions may become read-only or be routed through supported API operations.

Petpooja adapter structure should isolate:

- Credentials and outlet/product mappings.
- Menu import and supported availability updates.
- Order submission and external ID persistence.
- Authenticated/validated callbacks according to supplied docs.
- Deduplication, retry rules, failure visibility and reconciliation.
- Audit trail and capability configuration.

Do not blindly retry an order submission after an ambiguous timeout: reconcile using the provider's supported idempotency/reference mechanism before creating another POS order. Payment gateway refunds and POS cancellations are separate operations and need explicit coordination.

Required before committing the integration:

1. Confirmation the outlet uses Petpooja and has authority to activate the connection.
2. Petpooja approval/onboarding and the current documentation supplied for this integration.
3. API credentials and outlet mapping through a secure configuration channel.
4. Test/sandbox arrangement or provider-approved test outlet/process.
5. Supported fields, callbacks, authentication, rate limits and acceptance/certification requirements.
6. Exact commercial fees and reporting access.

Treat integration development and any Petpooja fees as a separate estimate. The existing PDF was not revised to include a Petpooja implementation; this file carries the subsequent integration discussion. Keep the standalone workflow functional while access is unresolved, and put the adapter behind configuration so unavailable integration does not masquerade as working.

## 15. Build sequence — no timeline commitments

Implement in dependency order with a working result at each gate:

1. **Foundation:** inspect the workspace and applicable instructions; verify tools; initialise the repository layout, shared style tokens, environments, database migrations and API contract.
2. **Access and catalogue:** customer authentication adapter, invited owner/staff/rider accounts, server-side permissions, menu and availability.
3. **First complete order:** customer app order to employee acceptance, kitchen preparation and ready status using persisted backend data. A clearly labelled development payment adapter is acceptable before real gateway access.
4. **Real payments and refunds:** gateway integration, verified callbacks, duplicate-event protection, reconciliation, cancellations and refund approval.
5. **Delivery:** rider assignment, partner task screen, pickup, navigation, OTP delivery completion, failure handling and reconnect behaviour.
6. **Owner operations:** real order/sales summaries, menu controls, store pause, rider controls and reports with honest data coverage.
7. **Retention:** coupons, eligible reward transactions, favourites/reorder and notification settings.
8. **Petpooja extension, only if separately authorised and accessible:** mapping, synchronisation, supported actions, callbacks and reconciliation.
9. **Production readiness:** cross-role tests, server deployment, migrations, monitoring, backup/restore, combined load tests, staff training and app release preparation.

Reuse components and backend rules across apps. Begin with the complete customer-to-counter journey rather than building disconnected mock screens for every role. Generated reference data must not be presented as live restaurant activity.

## 16. Required verification

- Unauthorised roles cannot read or mutate protected resources.
- Customer sees only their own orders and addresses.
- Rider sees only assigned tasks and necessary active-delivery details.
- Staff cannot gain owner privileges by calling an endpoint directly.
- Totals are recalculated on the server; item/variant/add-on availability is validated at checkout.
- Simultaneous acceptance or assignment has one consistent result.
- Payment retries and repeated callbacks do not duplicate orders, refunds, coupons or points.
- Invalid fulfilment transitions are rejected.
- Delivery OTP is expiring, verified server-side and protected against repeated guesses.
- Refund/cancellation state and customer notifications remain consistent.
- Employee dashboard handles alerts, kitchen changes and dispatch correctly across multiple sessions.
- Interrupted network connections and queued actions reconcile safely.
- Responsive dashboard works on target desktop and tablet sizes.
- Backup restore and restart recovery work on representative data.
- Load targets are validated on the actual configured server.
- If Petpooja is enabled, duplicate callbacks, delayed callbacks, menu changes, POS downtime and ambiguous submission results are tested.

Do not claim checks passed unless they have actually been run. Record unavailable device, provider or hardware tests as unverified.

## 17. Missing inputs and external dependencies

Progress on scaffolding and local development need not wait for all of these, but do not invent production values:

- Confirmed restaurant menu, actual prices, tax/charge rules, variants and approved photography.
- Verified branch address, customer-support contact, store hours and legal/publishing entity.
- Delivery zones, rider operations, cancellation/refund policy and reward/coupon rules.
- Payment gateway account and credentials.
- OTP/SMS and push notification setup.
- Apple and Google developer accounts and signing/distribution setup.
- Employee/owner permission matrix and initial authorised accounts.
- Domain, connectivity/static IP and physical hardware procurement details.
- Support hours and incident escalation contacts.
- Petpooja access, documentation and commercial approval if pursuing that extension.

Keep credentials out of this file and source control. Create `.env.example` with names and descriptions only. Use safe test identities and explicitly non-production sample data.

## 18. Reference links and evidence limits

Previously reviewed official sources and reference pages:

- Official Pista House website: https://pistahouse.in/
- Official logo asset used: https://pistahouse.in/cdn/shop/files/pista_house_logo.svg?v=1730199164&width=480
- Existing Pista House iPhone app: https://apps.apple.com/in/app/pista-house/id6751495679
- Apple Developer enrollment fees: https://developer.apple.com/help/account/membership/program-enrollment
- Google Play registration fee: https://support.google.com/googleplay/android-developer/answer/6112435?hl=en
- Flutter architecture recommendations: https://docs.flutter.dev/app-architecture/recommendations
- Vite static deployment: https://vite.dev/guide/static-deploy
- NestJS authorization: https://docs.nestjs.com/security/authorization
- Prisma transactions: https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions
- Dell hardware specification: https://dl.dell.com/topicspdf/optiplex-7060-desktop_specifications3_en-us.pdf
- Refurbished hardware supplier category: https://newjaisa.com/collections/buy-refurbished-mini-pcs-online-at-best-price
- UPS price reference: https://apc.estorewale.com/product/apc-back-ups-1100va-230v-bx1100c-in/
- Petpooja online-ordering information: https://www.petpooja.com/poss/online-order-management-software
- Petpooja online-ordering API release note: https://petpooja1.zohodesk.com/portal/en/kb/articles/release-note-v117-0-1
- Petpooja integration activation release note: https://petpooja1.zohodesk.com/portal/en/kb/articles/release-note-v128-0-1
- API documentation landing page located during research: https://onlineorderingapisv210.docs.apiary.io/

The API documentation landing page required JavaScript and its detailed contract was not audited in the planning chat. Obtain the current provider-approved contract rather than implementing from third-party summaries or guessed endpoints.

Pista House already has a publicly listed brand app. Branch onboarding rights, shared-brand permissions and availability of that platform for Shankarpally remain unconfirmed. Confirm these before publishing a standalone branded app. Existing brand-app availability is not proof of our integration access.

Developer prices, stock, hardware prices and software documentation can change. Recheck the relevant primary sources before purchasing or implementing version-specific integrations. Do not replace agreed commercial figures without the user's instruction.

## 19. Suggested prompt for the next chat

> Read `PISTA_HOUSE_BUILD_HANDOFF.md` and inspect the latest proposal and six UI references in `docs/`. Build the Pista House Shankarpally system in this repository: customer app, delivery-partner app, owner app and employee web dashboard. Follow the shared-backend/physical-server architecture and approved design direction. Start by verifying tools and establishing the repository, database, permissions and API contract, then implement the customer-to-employee order flow as the first working vertical slice. Continue through the authorised launch scope with meaningful tests. Preserve the stated pricing and do not add project timelines or a customer web storefront. Petpooja is a conditional, separately scoped integration; do not claim it works without approved access. Keep external credentials configurable and clearly distinguish development mocks from live functionality. Report actual working results and remaining external dependencies.
