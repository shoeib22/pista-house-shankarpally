# Customer accounts and saved addresses

Added 22 November 2026 (API 0.7.0).

## Sign-up and sign-in (private beta)

- `POST /api/auth/register` creates a customer account from **name, mobile number and passphrase** and signs the customer in. The Indian mobile number (any usual way of writing it: `9000000000`, `+91 90000 00000`, `09000000000`) is the account handle, so the customer signs in with it. Existing beta test accounts with a username still sign in with that username.
- Passphrases are at least 12 characters and stored only as salted scrypt hashes, like staff accounts.
- The role is always `customer` and the outlet is the configured default (`DEFAULT_OUTLET_ID`, `shankarpally`). The endpoint is strict: extra fields such as `role` or `outletId` are rejected.
- Sign-up is available only where customer password sign-in already is (the isolated private beta). Set `CUSTOMER_REGISTRATION=off` to close it. It is throttled per number and per IP, and a duplicate number returns a clear "sign in instead" message.
- **The mobile number is not verified.** No SMS provider is configured, so anyone can register any number. The sign-up page says so. There is also **no passphrase reset** for customers yet: both need an SMS/OTP provider, which needs your account and credentials. Until then, treat registration as beta-only.

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
