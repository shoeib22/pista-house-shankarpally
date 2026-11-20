# Development operations and production gates

## Local database

Docker Compose runs PostgreSQL 17 with a named volume. Its host port is bound to loopback only. `docker compose ... stop` preserves data; do not use `down -v` against records that must be kept. Apply checked-in migrations with `npm run db:migrate`; seeding is opt-in development-only and never fabricates orders.

The API health route queries PostgreSQL and reports provider capability status. Sample sessions are hashed in storage and expire in eight hours. Secrets live in ignored local `.env` files. Staff screens use session storage; mobile tokens currently live in memory only.

## Production is not ready

Current Compose provisions the development database only. It is not a production deployment recipe. Do not expose the current development API publicly. Provision the real owner, disable test adapters and configure HTTPS before enabling real staff access.

Further required work: live signed gateway events and reconciliation; gateway idempotency; approval-based refunds; phone-authentication OTP/SMS throttling; secure mobile credential storage; notification/outbox worker and retries; approved delivery areas; endpoint rate limiting; HTTP hardening and privacy policy; approved catalogue and charge rules; TLS reverse proxy; API/dashboard service images; encrypted backups and off-site copies; monitoring; representative load tests and restore drills.

Delivery verification uses a separate stable `DELIVERY_OTP_SECRET` (minimum 32 random characters). Codes are HMAC protected, valid for ten minutes, limited to five guesses per assignment and three issuances with a one-minute renewal cooldown. A restart preserves limits and validity when the same secret is retained. Changing the secret invalidates outstanding codes. Checkout refuses delivery if verification is unconfigured. SMS and phone-authentication OTP remain separate unconfigured services.

No actual server capacity, backup recovery, public connectivity, live integration or app-store release has been verified. Petpooja remains disabled and separately scoped. Commercial figures in the handoff have not been changed.

Staff password access and owner invitations are implemented; see `account_access.md`. Initial-owner bootstrap is a local masked command, closed while an enabled owner password account exists. Authentication throttles use database buckets, ignore untrusted forwarded headers and need deliberate proxy configuration before production. Web sessions remain in session storage and mobile sessions in memory; durable mobile secure storage is still pending.

## Local review services

API: `http://127.0.0.1:3001/api`; employee dashboard: `http://127.0.0.1:5173`. The development API defaults to loopback. Set `HOST=0.0.0.0` only for deliberate physical-phone testing on a trusted LAN; keep the workstation firewall enabled. Operational password authentication is available; customer phone verification is unconfigured. Real-owner setup, HTTPS and production hardening are still required.
