# Customer accounts and saved addresses

Added 22 November 2026 (API 0.7.0).

## Sign-up and sign-in (private beta)

- `POST /api/auth/register` creates a customer account from **name, mobile number and passphrase** and signs the customer in. The Indian mobile number (any usual way of writing it: `9000000000`, `+91 90000 00000`, `09000000000`) is the account handle, so the customer signs in with it. Existing beta test accounts with a username still sign in with that username.
- Passphrases are at least 12 characters and stored only as salted scrypt hashes, like staff accounts.
- The role is always `customer` and the outlet is the configured default (`DEFAULT_OUTLET_ID`, `shankarpally`). The endpoint is strict: extra fields such as `role` or `outletId` are rejected.
- Sign-up is available only where customer password sign-in already is (the isolated private beta). Set `CUSTOMER_REGISTRATION=off` to close it. It is throttled per number and per IP, and a duplicate number returns a clear "sign in instead" message.
- **Email verification and passphrase reset** (see below) are available. **The mobile number is not verified.** No SMS provider is configured, so anyone can register any number. The sign-up page says so. Verifying a *phone* needs an SMS/OTP provider (and DLT registration in India), which is not set up. Until then, treat registration as beta-only.

## Saved addresses

- Per-customer address book on the server (`/api/addresses`): list (default first), save, edit, delete, make default. Up to 10 per customer. The first address is the default automatically; at most one default exists (database-enforced); deleting the default promotes the most recent one.
- Saving the same street address and postcode again updates that entry, so "Save this address for next time" at checkout is safe to repeat.
- Each entry keeps the optional map pin. Fields follow the same rules as an order's delivery address. **PIN-code serviceability and delivery fees are still decided by the server when the order is placed**, not when the address is saved.
- Orders copy the address they use. Editing or deleting a saved address never changes a past order, and the rider still sees the order's own snapshot.
- Only the customer can read or change their addresses; owners, staff and riders get 403, and another customer's id returns 404.

## In the app

- Account tab: **Sign in** / **Create account** (full-screen page), then the customer's name and number, **Saved addresses**, and **Sign out**.
- Saved addresses: list with Default badge and map-pin indicator, add, edit, delete (with confirmation), make default.
- Checkout (delivery): the default address is filled in automatically; chips switch between saved addresses; **Save this address for next time** (on by default for new addresses) saves it after the order is created. A failed address save never blocks the order.

## Email verification and passphrase reset (API 0.8.0)

A free-tier email provider replaces SMS for account recovery. The customer's **email** is optional at the API (older app versions still register) but required by the sign-up page.

- **Sign-up** takes an email and sends a 6-digit code. The customer can enter it straight away or skip; ordering never needs it. **Account tab > email** adds, changes or verifies it later (`POST /auth/email`, `/auth/email/resend`, `/auth/email/verify`, `GET /auth/me`).
- **Forgot passphrase** (`POST /auth/forgot`, `POST /auth/reset`): by mobile number or email. A code is sent **only to a verified email**. The answer is identical whether or not an account matches, so it cannot be used to discover who has an account. A correct code sets the new passphrase and **signs the account out everywhere**.
- **Codes**: 6 digits, stored only as an HMAC; valid 10 minutes; single use; a newer code replaces older ones; 5 wrong guesses kill a code; one new code per minute; the old code never works for another account.
- **One verified owner per email**: a unique index applies only to *verified* emails, so typing someone else's address (unverified) cannot block them, and an address already verified elsewhere cannot be verified again (409).
- **Free-tier protection**: at most `MAIL_DAILY_LIMIT` (default 80) emails a day across the server, inside Resend's 100/day.
- Throttled per IP and per identifier, and closed together with sign-up by `CUSTOMER_REGISTRATION=off`.

### Turning on real email

Set in `backend/.env.beta` (never commit keys), then restart the API:

```
MAIL_PROVIDER=resend            # or brevo
MAIL_FROM=no-reply@your-domain  # a sender verified with the provider
RESEND_API_KEY=...              # or BREVO_API_KEY=...
```

- **Resend**: free tier about 3,000 emails/month and 100/day (check their current terms). Sending to arbitrary customers needs a domain you verify (DNS records). Without a domain Resend only delivers to the account owner's own address.
- **Brevo**: free tier of roughly 300 emails/day (check current terms). Verify a sender address or domain.
- **No key yet (`MAIL_PROVIDER=log`, the default)**: nothing leaves the server. The email, **including the code**, is written to the API log (`tmp/testflight/api.log` on the PC beta server) so you can test the whole flow yourself. Anyone with access to that log can see codes, so use real email before inviting other people.
