# Initial permissions

The server resolves the actor from a hashed opaque session token. Clients cannot select a role or outlet per request. Seeded development identities belong to Shankarpally only. Operational password accounts and owner-issued invitations are implemented. Customer phone verification remains unconfigured; sample users are development-only.

| Action | Customer | Counter | Kitchen | Rider | Owner |
|---|---|---|---|---|---|
| Browse menu | Yes | Yes | Yes | Yes | Yes |
| Create pickup/delivery order | Own | No | No | No | No |
| Read orders | Own | Outlet | Outlet | No | Outlet |
| Accept/decline | No | Yes | No | No | Yes |
| Prepare/ready | No | Yes | Yes | No | Yes |
| Confirm collection | No | Yes | No | No | Yes |
| Availability | No | Yes | No | No | Yes |
| Store pause | No | No | No | No | Yes |
| Audit activity | No | Yes | No | No | Yes |
| List/assign/unassign riders | No | Yes | No | No | Yes |
| Confirm physical delivery return | No | Yes | No | No | Yes |
| Rider availability/tasks | No | No | No | Own | No |
| Pickup/fail/verify delivery | No | No | No | Assigned active task | No |
| Request delivery code | Own active delivery | No | No | No | No |
| Invite/recover/suspend staff or riders | No | No | No | No | Outlet |
| Change own password / revoke own sessions | No password account | Own | Own | Own | Own |

This is a conservative development matrix, subject to the restaurant's approval. Price editing, refund approval and reporting endpoints are not exposed. User administration is owner-only and cannot create/promote or suspend owners. Customer orders and staff writes are scoped by customer/outlet. Riders cannot list outlet orders, see other riders' tasks, or access staff dispatch controls. Delivery addresses and contacts appear only on their active assigned/picked-up jobs; they are stripped from failed and historical tasks. Kitchen order listings omit delivery addresses. Delivery-code hashes and secrets are never included in task/order responses.

Development identity selection is a test adapter, not a production login. It is explicitly opt-in, expires after eight hours and is refused in production. Operational account provisioning requires first-owner bootstrap and HTTPS. Customer phone-provider setup remains separate. See `account_access.md` for session, invitation and recovery rules.
