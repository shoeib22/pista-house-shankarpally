# Staff, rider and owner access

Password accounts work independently of development login. Customer phone verification is a separate, unconfigured provider integration. Account access does not enable live payments or approve restaurant content.

## First owner

There is no default owner password or public owner registration route. No real owner was created during this build. Integration-test accounts belong to isolated fixtures and are removed afterwards.

On the trusted server/source checkout, after migrations and outlet configuration:

1. Temporarily set `ALLOW_OWNER_BOOTSTRAP=true` in ignored `backend/.env`.
2. Run `npm run auth:bootstrap` in an interactive terminal with project dependencies installed.
3. Enter the owner name, handle and a passphrase of 12–128 characters. Input is masked. The command refuses passwords in arguments, files or environment variables.
4. Set `ALLOW_OWNER_BOOTSTRAP=false` before serving the application.
5. Sign in through the employee dashboard or owner app. Configure HTTPS before entering real credentials over a network.

Bootstrap locks the outlet row and refuses another owner while an enabled owner password account exists. There is no HTTP bootstrap endpoint. Owner password loss requires trusted server recovery; a public owner-recovery flow is not provided.

## Invitations and recovery

Only an authenticated owner can invite counter, kitchen or rider accounts. The API cannot invite or promote owners. Codes bind outlet, handle and role, expire after 24 hours, and are single-use even under simultaneous acceptance. Only a token hash is stored; the owner sees the plaintext code once for private manual sharing. No email/SMS is sent and codes are not put in URLs.

The recipient selects **Use invitation** in the employee dashboard or delivery app, then chooses a passphrase. Staff codes activate in the dashboard; rider codes activate in the rider app. Expired/revoked codes fail. An unused code can be revoked and replaced.

Owners can issue recovery codes for enabled non-owner password accounts. Acceptance changes the passphrase, revokes sessions and other pending recovery codes, and preserves role and order history. Issuing a code does not change the passphrase until accepted.

## Passwords and sessions

Passphrases use versioned salted scrypt hashes: N=131072, r=8, p=1, with at most two concurrent derivations per API process. Plaintext is never stored. Unknown handles receive generic failures and perform derivation too. Parameters follow [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) using [Node crypto](https://nodejs.org/api/crypto.html).

Database-backed throttles limit login and invitation attempts by source and handle/code and survive restarts. Forwarded headers are not trusted. Configure trusted-proxy behavior deliberately before production, or proxied users will share a source bucket.

Sessions use random opaque tokens, stored only as hashes, with an eight-hour expiry. Every protected request checks expiry, suspension, authentication version and development restrictions. Roles/outlets cannot be supplied by clients.

Account screens show only the current user's sessions, creation/expiry dates, method and current-session marker. They do not identify physical devices. Users can revoke one session, sign out all, or change their passphrase with the current one. Password changes revoke other sessions and unused recovery codes, returning a replacement session for the current client.

Web tokens currently use session storage; mobile tokens remain in memory. Secure durable mobile storage, process-restart recovery, MFA, retention and a production security review remain further gates.

## Suspension and deliveries

Owners can suspend/re-enable non-owner outlet accounts. Suspension immediately revokes sessions and unused recovery codes and takes the rider offline. This worker route cannot suspend an owner.

Uncollected jobs are unassigned and returned to ready. Picked-up jobs become delivery exceptions: payment is unchanged, codes are invalidated, and staff must confirm physical return before reassignment. Assignment/account locks prevent dispatch races. Stale availability requests cannot turn revoked riders online.

+
## Development boundary

Sample users, their invitations and resulting accounts carry `developmentOnly`. They cannot sign in or activate codes when development adapters are off. Existing development sessions, including password sessions on sample accounts, are rejected too. An operator-bootstrapped owner is not a development identity.

For review, use **Test access → Owner**. Its invitations create development-only accounts. Before production disable `DEV_ADAPTERS`, set `NODE_ENV=production`, provision the real owner, configure HTTPS and complete the remaining production gates. Commercial terms and publishing rights are unchanged.
