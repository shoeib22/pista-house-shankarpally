# Customer support

Added 23 November 2026 (API 0.10.0). A help desk that lives inside the apps, with no extra service to run.

## What a customer can do

- **Account tab > Help & support** (and **Get help with this order** on any order): pick what went wrong (missing or wrong item, quality, late, delivery, payment, refund, app, other), optionally pick the order, and describe it.
- Follow the **conversation** with the outlet in the app, reply, **close** a request, and **rate** it once it is resolved (1 to 5 stars).
- A blue/gold **New** marker and a count on the Account tab show unread replies. The app checks for new replies every 10 seconds while a conversation is open.
- Common answers (where is my order, failed payment, refunds, missing items) are built in.
- Limits: at most **3 open requests**, **5 new requests per hour**, messages up to 2,000 characters, and a short slow-down if someone floods one conversation.

## What the owner (or counter staff) can do

- **Owner app > headset icon** (badge shows requests needing a reply; orange when any are overdue): the inbox with filters **Needs reply / Waiting on customer / Finished / All**, a **Mine** switch and search by customer, subject or request number.
- The queue puts **overdue** requests first, then **high priority**, then the longest-waiting. Overdue means no staff reply within `SUPPORT_SLA_MINUTES` (default 60).
- A summary strip shows requests needing a reply, overdue, resolved today, **average first reply time** (7 days), **customer rating** (30 days) and how many are assigned to you.
- Opening a request shows the **customer** (name, number, how many earlier requests), the **order** (items, status, payment, total) with a **Refund** shortcut to the refund screen, and the whole conversation.
- Reply with one tap **canned replies**, **Send**, or **Send & resolve**; add a **private note** (yellow, never visible to the customer); **assign to me**, set **high priority**, **reopen** or **close**.
- Replying marks the request *waiting on customer*; a customer reply puts it back in *needs reply*. The first staff reply sets the first-response time once.

## Rules that protect customers and staff

- Customers see only their own requests. Another customer's request is a 404.
- **Private notes and the staff activity trail (assigned, priority, status changes) are never sent to the customer**, and the customer sees every staff reply as "Pista House support", not a person's name.
- A request can only be about the customer's **own** order.
- Resolved requests can be reopened by a customer reply for **7 days**; older resolved requests are closed automatically (every 10 minutes) and a new request must be started. Closed requests cannot be replied to by the customer; staff must reopen one first.
- Only the **owner and counter** roles can use the inbox (permission `support:manage`); kitchen, riders and customers get 403.
- Resolving or closing a request is written to the audit log.

## Not built (honest limits)

- **No push or SMS notifications.** Customers see replies when they open the app (or the conversation); staff see the badge when the owner app refreshes. There is no alert when the app is closed.
- **No photo or file attachments**, which food complaints often need. This needs file storage and a decision on privacy and retention.
- **Counter staff have no screen yet.** The server already allows the counter role, but the only staff apps are the owner app (which has this) and the web dashboard (which does not). A dashboard inbox is the next step.
- No live chat presence, no multiple outlets, no automatic routing or templates beyond the five canned replies, and no export or report beyond the summary strip.
- Refunds are decided and issued by the owner (see `payments.md`); the support desk only links to them.

## Photos

A request or reply may carry up to 3 photos (JPEG, PNG or WebP, 800 KB each,
base64 in the JSON body; the server accepts bodies up to 4 MB). The first bytes
must match the declared type, so renamed files and SVG are refused. Photos are
stored in the database and fetched with `GET /api/support/attachments/:id`,
only by the customer who owns the request (never from an internal note) and
support staff of the same outlet. Responses carry `nosniff` and a locked-down
CSP. Photos are deleted after `SUPPORT_ATTACHMENT_DAYS` (default 90); the
message text stays.

## Alerts

A customer message alerts owner/counter staff; a staff reply alerts the customer
(see notifications.md).
