import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  randomUUID,
  randomBytes,
  generateKeyPairSync,
  createVerify,
} from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import {
  Notifications,
  betaSample,
  ist,
  COPY,
} from "../src/notifications/notifications";
import { FcmPush, memoryPush } from "../src/notifications/push";
import { hash } from "../src/auth";
import { validateRuntime } from "../src/runtime";

const id = randomUUID(),
  outlet = "notify-test-" + id;
let app: any, db: Database, n: Notifications, base: string;
const tokens: Record<string, string> = {},
  users: Record<string, any> = {};
const realFetch = globalThis.fetch;
const DEVICE = (who: string) => `fcm-token-${who}-${id}-0123456789abcdef`;

before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  for (const f of [
    "NOTIFICATIONS_POLL_DISABLED",
    "NOTIFICATIONS_CAMPAIGNS_DISABLED",
    "SUPPORT_SWEEP_DISABLED",
    "PAYMENTS_SWEEP_DISABLED",
    "DISPATCH_DISABLED",
  ])
    process.env[f] = "true";
  process.env.PUSH_PROVIDER = "memory";
  process.env.PUSH_HOLDOUT_PERCENT = "0"; // deterministic; the holdout test turns it on
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  n = app.get(Notifications);
  n.random = () => 0.5;
  await db.outlet.create({
    data: {
      id: outlet,
      name: "Notify fixture",
      latitude: 17.45,
      longitude: 78.14,
    },
  });
  for (const [key, role] of [
    ["alice", "customer"],
    ["bob", "customer"],
    ["owner", "owner"],
    ["counter", "counter"],
    ["kitchen", "kitchen"],
    ["rider", "rider"],
  ] as const) {
    users[key] = await db.user.create({
      data: { outletId: outlet, name: `${key} Test`, role },
    });
    tokens[key] = randomBytes(32).toString("hex");
    await db.session.create({
      data: {
        userId: users[key].id,
        tokenHash: hash(tokens[key]),
        authMethod: "password",
        expiresAt: new Date(Date.now() + 900000),
      },
    });
  }
});
after(async () => {
  globalThis.fetch = realFetch;
  if (db) {
    const ids = Object.values(users).map((u: any) => u.id);
    const orders = (
      await db.order.findMany({
        where: { outletId: outlet },
        select: { id: true },
      })
    ).map((o) => o.id);
    const tickets = (
      await db.supportTicket.findMany({
        where: { outletId: outlet },
        select: { id: true },
      })
    ).map((t) => t.id);
    await db.supportAttachment.deleteMany({
      where: { ticketId: { in: tickets } },
    });
    await db.supportMessage.deleteMany({
      where: { ticketId: { in: tickets } },
    });
    await db.supportTicket.deleteMany({ where: { outletId: outlet } });
    await db.deliveryOffer.deleteMany({ where: { outletId: outlet } });
    await db.refund.deleteMany({ where: { outletId: outlet } });
    await db.payment.deleteMany({ where: { outletId: outlet } });
    await db.assignmentEvent.deleteMany({
      where: { assignment: { orderId: { in: orders } } },
    });
    await db.deliveryAssignment.deleteMany({
      where: { orderId: { in: orders } },
    });
    await db.orderEvent.deleteMany({ where: { orderId: { in: orders } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: orders } } });
    await db.order.deleteMany({ where: { outletId: outlet } });
    await db.notification.deleteMany({ where: { userId: { in: ids } } });
    await db.deviceToken.deleteMany({ where: { userId: { in: ids } } });
    await db.notificationPreference.deleteMany({
      where: { userId: { in: ids } },
    });
    await db.cartSnapshot.deleteMany({ where: { userId: { in: ids } } });
    await db.auditEvent.deleteMany({ where: { outletId: outlet } });
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { outletId: outlet } });
    await db.outlet.deleteMany({ where: { id: outlet } });
  }
  await app?.close();
});

async function call(
  method: string,
  path: string,
  who: string | null,
  body?: unknown,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
const mine = (who: string) =>
  db.notification.findMany({
    where: { userId: users[who].id },
    orderBy: { createdAt: "asc" },
  });
/**
 * Polls and returns how many alerts were made for THIS file's users. The poll
 * itself is global, so other test files running at the same time against the
 * same database can add alerts for their own users; those must not be counted.
 */
async function polled() {
  const ids = Object.values(users).map((u: any) => u.id);
  const before = await db.notification.count({
    where: { userId: { in: ids } },
  });
  await n.pollEvents();
  return (
    (await db.notification.count({ where: { userId: { in: ids } } })) - before
  );
}
const kinds = async (who: string) => (await mine(who)).map((x) => x.kind);
async function register(who: string) {
  const r = await call("POST", "/api/devices", who, {
    token: DEVICE(who),
    platform: "android",
    app: who === "rider" ? "rider" : "customer",
  });
  assert.equal(r.status, 201);
}
async function reset() {
  const ids = Object.values(users).map((u: any) => u.id);
  await db.notification.deleteMany({ where: { userId: { in: ids } } });
  await db.deviceToken.deleteMany({ where: { userId: { in: ids } } });
  await db.notificationPreference.deleteMany({
    where: { userId: { in: ids } },
  });
  await db.cartSnapshot.deleteMany({ where: { userId: { in: ids } } });
  // Earlier tests' orders would otherwise count as "already ordered".
  const orders = (
    await db.order.findMany({
      where: { outletId: outlet },
      select: { id: true },
    })
  ).map((o) => o.id);
  await db.refund.deleteMany({ where: { orderId: { in: orders } } });
  await db.payment.deleteMany({ where: { orderId: { in: orders } } });
  await db.deliveryOffer.deleteMany({ where: { outletId: outlet } });
  await db.assignmentEvent.deleteMany({
    where: { assignment: { orderId: { in: orders } } },
  });
  await db.deliveryAssignment.deleteMany({
    where: { orderId: { in: orders } },
  });
  await db.orderEvent.deleteMany({ where: { orderId: { in: orders } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orders } } });
  await db.order.deleteMany({ where: { outletId: outlet } });
  await db.notificationCursor.deleteMany({});
  memoryPush.sent.length = 0;
  memoryPush.deadTokens.clear();
  await n.pollEvents(new Date()); // sets every cursor to "now": no history is replayed
}
async function order(who = "alice", over: object = {}) {
  const key = randomUUID();
  return db.order.create({
    data: {
      outletId: outlet,
      customerId: users[who].id,
      idempotencyKey: key,
      requestHash: key,
      fulfilment: "delivery",
      status: "awaiting_acceptance",
      paymentStatus: "paid",
      subtotalPaise: 29900,
      taxPaise: 0,
      deliveryPaise: 2000,
      totalPaise: 31900,
      items: {
        create: {
          productId: "chicken-biryani",
          name: "Chicken Dum Biryani",
          quantity: 1,
          unitPaise: 29900,
        },
      },
      ...over,
    },
  });
}
const event = (orderId: string, action: string, reason?: string) =>
  db.orderEvent.create({
    data: { orderId, actorId: users.owner.id, action, reason },
  });
const later = () => new Promise((r) => setTimeout(r, 15));

test("preferences are off by default, validated, and customer-only", async () => {
  await reset();
  assert.deepEqual(
    (await call("GET", "/api/notifications/preferences", "alice")).json,
    { promotions: false, reminders: false, quietStart: 22, quietEnd: 8 },
  );
  const set = await call("PUT", "/api/notifications/preferences", "alice", {
    reminders: true,
    quietStart: 23,
  });
  assert.equal(set.json.reminders, true);
  assert.equal(set.json.promotions, false, "unchanged settings stay off");
  assert.equal(set.json.quietStart, 23);
  for (const bad of [
    { quietStart: 24 },
    { quietEnd: -1 },
    { promotions: "yes" },
    { nonsense: true },
  ])
    assert.equal(
      (await call("PUT", "/api/notifications/preferences", "alice", bad))
        .status,
      400,
      JSON.stringify(bad),
    );
  assert.equal(
    (
      await call("PUT", "/api/notifications/preferences", "owner", {
        promotions: true,
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("GET", "/api/notifications/preferences", null)).status,
    401,
  );
});

test("devices register, move between accounts, and are removed", async () => {
  await reset();
  assert.equal(
    (
      await call("POST", "/api/devices", "alice", {
        token: "short",
        platform: "android",
        app: "customer",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("POST", "/api/devices", "alice", {
        token: DEVICE("a"),
        platform: "windows",
        app: "customer",
      })
    ).status,
    400,
  );
  await call("POST", "/api/devices", "alice", {
    token: DEVICE("shared"),
    platform: "ios",
    app: "customer",
  });
  await call("POST", "/api/devices", "bob", {
    token: DEVICE("shared"),
    platform: "ios",
    app: "customer",
  });
  const row = await db.deviceToken.findUniqueOrThrow({
    where: { token: DEVICE("shared") },
  });
  assert.equal(
    row.userId,
    users.bob.id,
    "a phone signed in as someone else moves to them",
  );
  assert.equal(
    (await call("DELETE", "/api/devices", "alice", { token: DEVICE("shared") }))
      .status,
    200,
  );
  assert.ok(
    await db.deviceToken.findUnique({ where: { token: DEVICE("shared") } }),
    "alice cannot remove bob's device",
  );
  await call("DELETE", "/api/devices", "bob", { token: DEVICE("shared") });
  assert.equal(
    await db.deviceToken.findUnique({ where: { token: DEVICE("shared") } }),
    null,
  );
});

test("order updates reach the customer and the outlet staff, in time order, once", async () => {
  await reset();
  await register("alice");
  const o = await order();
  const t = `#PH${String(o.number).padStart(4, "0")}`;
  await event(o.id, "beta_simulated.payment_verified");
  await later();
  await event(o.id, "accept");
  await later();
  await event(o.id, "prepare");
  await later();
  await event(o.id, "ready");
  assert.equal(
    await polled(),
    4 + 3,
    "four for the customer, new-order alerts for owner, counter and kitchen",
  );
  assert.deepEqual(await kinds("alice"), [
    "order.confirmed",
    "order.accepted",
    "order.preparing",
    "order.ready",
  ]);
  const first = (await mine("alice"))[0];
  assert.equal(first.title, `Order ${t} confirmed`);
  assert.equal(first.priority, "p0");
  assert.deepEqual(first.data, { route: "order", orderId: o.id });
  assert.equal(first.pushStatus, "sent");
  for (const who of ["owner", "counter", "kitchen"])
    assert.deepEqual(await kinds(who), ["staff.new_order"], who);
  assert.equal(
    (await mine("rider")).length + (await mine("bob")).length,
    0,
    "nobody else is told",
  );
  assert.equal(
    memoryPush.sent.length,
    4,
    "only the registered phone was pushed",
  );
  assert.equal(memoryPush.sent[0].message.priority, "p0");
  assert.equal(memoryPush.sent[0].message.data.route, "order");
  assert.equal(await polled(), 0, "polling again makes nothing new");
  await event(o.id, "reject", "Out of stock");
  await n.pollEvents();
  assert.match(
    (await mine("alice")).at(-1)!.body,
    /Out of stock\. If you paid, the outlet will refund you/,
  );
});

test("history is never replayed as alerts", async () => {
  await reset();
  const o = await order();
  await db.orderEvent.create({
    data: {
      orderId: o.id,
      actorId: users.owner.id,
      action: "accept",
      createdAt: new Date(Date.now() - 60000),
    },
  });
  assert.equal(await polled(), 0);
  assert.equal((await mine("alice")).length, 0);
});

test("delivery updates, rider assignment, offers and refunds each alert the right person", async () => {
  await reset();
  const o = await order("alice", { status: "ready" });
  const a = await db.deliveryAssignment.create({
    data: { orderId: o.id, riderId: users.rider.id },
  });
  for (const action of ["assigned", "picked_up", "delivered"]) {
    await db.assignmentEvent.create({
      data: { assignmentId: a.id, actorId: users.rider.id, action },
    });
    await later();
  }
  const failed = await order("bob", { status: "out_for_delivery" });
  const fa = await db.deliveryAssignment.create({
    data: { orderId: failed.id, riderId: users.rider.id },
  });
  await db.assignmentEvent.create({
    data: { assignmentId: fa.id, actorId: users.rider.id, action: "failed" },
  });
  await db.deliveryOffer.create({
    data: {
      outletId: outlet,
      orderId: o.id,
      riderId: users.rider.id,
      expiresAt: new Date(Date.now() + 30000),
    },
  });
  await db.refund.create({
    data: {
      paymentId: (
        await db.payment.create({
          data: {
            orderId: o.id,
            outletId: outlet,
            provider: "simulated",
            amountPaise: 31900,
            expiresAt: new Date(),
          },
        })
      ).id,
      orderId: o.id,
      outletId: outlet,
      amountPaise: 5000,
      reason: "x",
    },
  });
  await n.pollEvents();
  assert.deepEqual(await kinds("alice"), [
    "delivery.assigned",
    "delivery.on_the_way",
    "delivery.delivered",
    "refund.started",
  ]);
  assert.match((await mine("alice"))[0].body, /rider Test will deliver/);
  assert.deepEqual(await kinds("rider"), ["rider.assigned", "rider.offer"]);
  assert.deepEqual(await kinds("bob"), ["delivery.failed"]);
  assert.ok((await kinds("owner")).includes("staff.delivery_failed"));
  assert.ok((await kinds("counter")).includes("staff.delivery_failed"));
  assert.ok(
    !(await kinds("kitchen")).includes("staff.delivery_failed"),
    "the kitchen is not told about failed deliveries",
  );
  assert.match((await mine("alice")).at(-1)!.title, /Refund of ₹50 started/);
});

test("support alerts go to the right staff and back to the customer, never leaking notes", async () => {
  await reset();
  const t = (
    await call("POST", "/api/support/tickets", "alice", {
      category: "late",
      message: "Where is my order?",
    })
  ).json;
  assert.deepEqual(await kinds("owner"), ["support.new"]);
  assert.deepEqual(await kinds("counter"), ["support.new"]);
  assert.equal(
    (await mine("kitchen")).length +
      (await mine("rider")).length +
      (await mine("bob")).length,
    0,
  );
  await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
    body: "Checking now",
    internal: true,
  });
  assert.equal(
    (await mine("alice")).length,
    0,
    "a private note does not alert the customer",
  );
  await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
    body: "On its way!",
  });
  const alert = (await mine("alice")).at(-1)!;
  assert.equal(alert.kind, "support.reply");
  assert.deepEqual(alert.data, { route: "support", ticketId: t.id });
  assert.ok(
    !alert.body.includes("On its way"),
    "the alert carries the subject, not private text",
  );
  // Now assigned: the customer's reply goes only to the assignee.
  await reset();
  await call("POST", `/api/support/tickets/${t.id}/messages`, "alice", {
    body: "Thanks, any update?",
  });
  assert.deepEqual(await kinds("owner"), ["support.reply"]);
  assert.deepEqual(
    await kinds("counter"),
    [],
    "assigned to the owner, so the counter is not pinged",
  );
});

test("reminders and offers need an opt-in, are capped per day, and wait out quiet hours", async () => {
  await reset();
  const ask = (
    priority: "p1" | "p2",
    extra: object = {},
    now = new Date("2026-11-23T08:00:00Z"),
  ) =>
    n.notify(
      {
        userId: users.alice.id,
        kind: "campaign.test",
        priority,
        title: "t",
        body: "b",
        ...extra,
      },
      now,
    );
  assert.deepEqual(await ask("p2"), {
    status: "suppressed",
    reason: "not_opted_in",
  });
  assert.deepEqual(await ask("p1"), {
    status: "suppressed",
    reason: "not_opted_in",
  });
  await call("PUT", "/api/notifications/preferences", "alice", {
    promotions: true,
    reminders: true,
  });
  assert.equal((await ask("p2")).status, "created");
  assert.equal((await ask("p2")).status, "created");
  assert.deepEqual(
    await ask("p2"),
    { status: "suppressed", reason: "fatigue" },
    "two offers a day, no more",
  );
  assert.equal(
    (await ask("p1")).status,
    "created",
    "a reminder is still allowed",
  );
  assert.deepEqual(
    await ask("p1"),
    { status: "suppressed", reason: "fatigue" },
    "three nudges in total",
  );
  // Transactional alerts ignore every cap.
  for (let i = 0; i < 6; i++)
    assert.equal(
      (
        await n.notify({
          userId: users.alice.id,
          kind: "order.test",
          priority: "p0",
          title: "t",
          body: "b",
        })
      ).status,
      "created",
    );
  // Quiet hours: 23:00 IST is 17:30 UTC. Held until 08:00 IST, not sent now.
  await reset();
  await call("PUT", "/api/notifications/preferences", "alice", {
    promotions: true,
  });
  await register("alice");
  // Always the next 23:00 IST, so the 08:00 IST release is still in the future.
  const night = new Date();
  night.setUTCHours(17, 30, 0, 0);
  if (night.getTime() <= Date.now()) night.setUTCDate(night.getUTCDate() + 1);
  const r = await n.notify(
    {
      userId: users.alice.id,
      kind: "campaign.test",
      priority: "p2",
      title: "Offer",
      body: "b",
    },
    night,
  );
  assert.equal(r.status, "created");
  const held = await db.notification.findUniqueOrThrow({
    where: { id: r.id! },
  });
  assert.equal(held.pushStatus, null, "not delivered at night");
  assert.equal(ist(held.sendAt!).hour, 8, "scheduled for 08:00 IST");
  assert.equal(
    (await call("GET", "/api/notifications", "alice")).json.items.length,
    0,
    "not in the inbox until it is due",
  );
  assert.equal(memoryPush.sent.length, 0);
  await db.notification.update({
    where: { id: r.id! },
    data: { sendAt: new Date(Date.now() - 1000) },
  });
  assert.equal(await n.flushScheduled(), 1);
  assert.equal(memoryPush.sent.length, 1);
  assert.equal(
    (await call("GET", "/api/notifications", "alice")).json.items.length,
    1,
  );
});

test("a usual-time reorder reminder is sent once, with the favourite dish, only to those who opted in", async () => {
  await reset();
  await call("PUT", "/api/notifications/preferences", "alice", {
    reminders: true,
  });
  // Alice orders biryani on Mondays at about 13:00 IST. Monday 23 Nov 2026.
  const monday = (weeksAgo: number) =>
    new Date(Date.UTC(2026, 10, 23 - 7 * weeksAgo, 7, 30)); // 13:00 IST
  for (const w of [1, 2, 3])
    await order("alice", { createdAt: monday(w), status: "delivered" });
  await order("bob", { createdAt: monday(1) }); // bob has not opted in
  const before = new Date("2026-11-23T07:20:00Z"); // 12:50 IST, just before their usual 13:00
  const sent = await n.runCampaigns(before);
  assert.equal(sent.reorder, 1);
  const note = (await mine("alice")).find((x) => x.campaign === "reorder")!;
  assert.equal(note.priority, "p1");
  assert.ok(COPY.reorder.some((c) => c.key === note.variant));
  assert.match(note.title + note.body, /Chicken Dum Biryani/);
  assert.ok(!/\{/.test(note.title + note.body), "no unfilled placeholders");
  assert.equal((await mine("bob")).length, 0);
  assert.deepEqual(
    await n.runCampaigns(before),
    {},
    "not repeated within days",
  );
  // Not at a random time of day.
  await reset();
  await call("PUT", "/api/notifications/preferences", "alice", {
    reminders: true,
  });
  assert.deepEqual(
    await n.runCampaigns(new Date("2026-11-23T03:00:00Z")),
    {},
    "08:30 IST is nowhere near their window",
  );
  // Not if they already ordered today.
  await order("alice", { createdAt: new Date("2026-11-23T06:00:00Z") });
  assert.deepEqual(await n.runCampaigns(before), {});
});

test("an abandoned cart gets one nudge, and not if the customer ordered since", async () => {
  await reset();
  await call("PUT", "/api/notifications/preferences", "alice", {
    reminders: true,
  });
  assert.equal(
    (
      await call("PUT", "/api/me/cart", "alice", {
        itemCount: 2,
        totalPaise: 59800,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("PUT", "/api/me/cart", "owner", {
        itemCount: 1,
        totalPaise: 100,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("PUT", "/api/me/cart", "alice", {
        itemCount: -1,
        totalPaise: 0,
      })
    ).status,
    400,
  );
  const now = new Date();
  await db.cartSnapshot.update({
    where: { userId: users.alice.id },
    data: { updatedAt: new Date(now.getTime() - 10 * 60000) },
  });
  assert.deepEqual(await n.runCampaigns(now), {}, "too soon");
  await db.cartSnapshot.update({
    where: { userId: users.alice.id },
    data: { updatedAt: new Date(now.getTime() - 45 * 60000) },
  });
  assert.equal((await n.runCampaigns(now)).abandoned_cart, 1);
  const note = (await mine("alice")).find(
    (x) => x.campaign === "abandoned_cart",
  )!;
  assert.ok(!/\{/.test(note.body));
  assert.deepEqual(await n.runCampaigns(now), {}, "only once per cart");
  await reset();
  await call("PUT", "/api/notifications/preferences", "alice", {
    reminders: true,
  });
  await call("PUT", "/api/me/cart", "alice", { itemCount: 1, totalPaise: 100 });
  await db.cartSnapshot.update({
    where: { userId: users.alice.id },
    data: { updatedAt: new Date(now.getTime() - 45 * 60000) },
  });
  await order("alice", { createdAt: new Date(now.getTime() - 20 * 60000) });
  assert.deepEqual(
    await n.runCampaigns(now),
    {},
    "they ordered after filling the cart",
  );
  await call("PUT", "/api/me/cart", "alice", { itemCount: 0, totalPaise: 0 });
  assert.equal(
    await db.cartSnapshot.findUnique({ where: { userId: users.alice.id } }),
    null,
    "an empty cart is forgotten",
  );
});

test("win-back and rainy-day offers need the offers opt-in and a meal window", async () => {
  await reset();
  await call("PUT", "/api/notifications/preferences", "alice", {
    promotions: true,
  });
  await order("alice", {
    createdAt: new Date("2026-11-03T06:00:00Z"),
    status: "delivered",
  }); // 20 days ago
  const lunch = new Date("2026-11-23T07:05:00Z"); // 12:35 IST, default lunch window
  (n as any).rainingAtOutlet = async () => false;
  assert.equal((await n.runCampaigns(lunch)).lapsed, 1);
  const note = (await mine("alice")).find((x) => x.campaign === "lapsed")!;
  assert.equal(note.priority, "p2");
  assert.deepEqual(await n.runCampaigns(lunch), {}, "not again for two weeks");
  assert.deepEqual(
    await n.runCampaigns(new Date("2026-11-23T04:00:00Z")),
    {},
    "09:30 IST is outside every meal window",
  );
  await reset();
  await call("PUT", "/api/notifications/preferences", "bob", {
    promotions: true,
  });
  (n as any).rainingAtOutlet = async () => true;
  assert.equal(
    (await n.runCampaigns(lunch)).rainy_day,
    1,
    "bob has no history, so the default lunch window applies",
  );
  const rain = (await mine("bob")).find((x) => x.campaign === "rainy_day")!;
  assert.ok(
    !/₹|% off|discount/i.test(rain.title + rain.body),
    "no invented discounts",
  );
  delete (n as any).rainingAtOutlet;
});

test("copy that people open is chosen more often, but every variant keeps a chance", async () => {
  await reset();
  const rows = (variant: string, opened: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({
      userId: users.alice.id,
      kind: "campaign.reorder",
      priority: "p1",
      title: "t",
      body: "b",
      campaign: "reorder",
      variant,
      openedAt: i < opened ? new Date() : null,
    }));
  await db.notification.createMany({
    data: [
      ...rows("direct", 30, 30),
      ...rows("friendly", 0, 30),
      ...rows("warm", 0, 30),
    ],
  });
  n.random = Math.random;
  const picks: Record<string, number> = {};
  for (let i = 0; i < 40; i++) {
    const v = (await n.pickVariant("reorder")).key;
    picks[v] = (picks[v] ?? 0) + 1;
  }
  n.random = () => 0.5;
  assert.ok(picks.direct >= 36, JSON.stringify(picks));
  const sample = betaSample(5, 5, Math.random);
  assert.ok(sample > 0 && sample < 1);
});

test("a deliberate holdout lets the owner see what the nudges achieve", async () => {
  await reset();
  await call("PUT", "/api/notifications/preferences", "alice", {
    reminders: true,
  });
  process.env.PUSH_HOLDOUT_PERCENT = "100";
  const held = await n.sendCampaign(users.alice.id, "reorder", "p1", {
    dish: "biryani",
  });
  assert.deepEqual(held, { status: "suppressed", reason: "holdout" });
  const hidden = (await mine("alice"))[0];
  assert.equal(hidden.visible, false);
  assert.equal(hidden.pushStatus, "holdout");
  assert.equal(
    (await call("GET", "/api/notifications", "alice")).json.items.length,
    0,
    "never shown",
  );
  process.env.PUSH_HOLDOUT_PERCENT = "0";
  assert.equal(
    (await n.sendCampaign(users.alice.id, "reorder", "p1", { dish: "biryani" }))
      .status,
    "created",
  );
  // Both people order after being nudged (or not): the report compares them.
  const orderEvent = await order("alice");
  await event(orderEvent.id, "beta_simulated.payment_verified");
  await n.pollEvents(new Date(Date.now() - 1000));
  const rows = await db.notification.findMany({
    where: { userId: users.alice.id, campaign: "reorder" },
  });
  assert.ok(
    rows.every((r) => r.convertedAt),
    "an order after a nudge counts as a conversion",
  );
  const report = await call("GET", "/api/notifications/report", "owner");
  assert.equal(report.status, 200);
  const c = report.json.campaigns.reorder;
  assert.deepEqual(
    [c.sent, c.heldBack, c.converted, c.heldBackConverted],
    [1, 1, 1, 1],
  );
  assert.equal(c.liftPoints, 0);
  assert.equal(c.enoughData, false, "tiny samples are flagged, not celebrated");
  assert.equal(
    (await call("GET", "/api/notifications/report", "kitchen")).status,
    403,
  );
  assert.equal(
    (await call("GET", "/api/notifications/report", "alice")).status,
    403,
  );
  process.env.PUSH_HOLDOUT_PERCENT = "0";
});

test("the inbox lists, counts, marks read and tracks opens, privately", async () => {
  await reset();
  const a = await n.notify({
    userId: users.alice.id,
    kind: "order.test",
    priority: "p0",
    title: "One",
    body: "b",
  });
  await n.notify({
    userId: users.alice.id,
    kind: "order.test",
    priority: "p0",
    title: "Two",
    body: "b",
  });
  await n.notify({
    userId: users.bob.id,
    kind: "order.test",
    priority: "p0",
    title: "Bob's",
    body: "b",
  });
  const list = (await call("GET", "/api/notifications", "alice")).json;
  assert.equal(list.unread, 2);
  assert.deepEqual(
    list.items.map((i: any) => i.title),
    ["Two", "One"],
    "newest first",
  );
  assert.equal(
    (await call("GET", "/api/notifications/unread-count", "alice")).json.count,
    2,
  );
  assert.equal(
    (await call("POST", `/api/notifications/${a.id}/open`, "bob")).status,
    404,
    "cannot touch someone else's",
  );
  assert.equal(
    (await call("POST", `/api/notifications/${a.id}/open`, "alice")).status,
    201,
  );
  assert.equal(
    (await call("GET", "/api/notifications/unread-count", "alice")).json.count,
    1,
  );
  assert.ok(
    (await db.notification.findUniqueOrThrow({ where: { id: a.id! } }))
      .openedAt,
  );
  assert.equal(
    (await call("POST", "/api/notifications/read", "alice", {})).json.updated,
    1,
  );
  assert.equal(
    (await call("GET", "/api/notifications/unread-count", "alice")).json.count,
    0,
  );
  assert.equal(
    (await call("GET", "/api/notifications/unread-count", "bob")).json.count,
    1,
    "bob's is untouched",
  );
  assert.equal(
    (await call("POST", "/api/notifications/read", "alice", { ids: "x" }))
      .status,
    400,
  );
});

test("dead phones are dropped, and the owner can test push end to end", async () => {
  await reset();
  await register("owner");
  const test1 = await call("POST", "/api/notifications/test", "owner");
  assert.deepEqual(test1.json, { pushStatus: "sent", provider: "memory" });
  memoryPush.deadTokens.add(DEVICE("owner"));
  const test2 = await call("POST", "/api/notifications/test", "owner");
  assert.equal(test2.json.pushStatus, "failed");
  assert.ok(
    (
      await db.deviceToken.findUniqueOrThrow({
        where: { token: DEVICE("owner") },
      })
    ).disabledAt,
    "an uninstalled app's token is disabled",
  );
  assert.equal(
    (await call("POST", "/api/notifications/test", "alice")).status,
    403,
  );
  // No phone at all: still saved for the inbox.
  const r = await n.notify({
    userId: users.counter.id,
    kind: "x",
    priority: "p0",
    title: "t",
    body: "b",
  });
  assert.equal(
    (await db.notification.findUniqueOrThrow({ where: { id: r.id! } }))
      .pushStatus,
    "no_device",
  );
  // Push not configured: saved, reported as such.
  process.env.PUSH_PROVIDER = "none";
  await register("alice");
  const r2 = await n.notify({
    userId: users.alice.id,
    kind: "x",
    priority: "p0",
    title: "t",
    body: "b",
  });
  assert.equal(
    (await db.notification.findUniqueOrThrow({ where: { id: r2.id! } }))
      .pushStatus,
    "not_configured",
  );
  process.env.PUSH_PROVIDER = "memory";
});

test("Firebase push signs a real service-account login, sends the right message, and drops dead tokens", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.FCM_PROJECT_ID = "pista-test";
  process.env.FCM_SERVICE_ACCOUNT = JSON.stringify({
    client_email: "push@pista-test.iam.gserviceaccount.com",
    private_key: privateKey,
  });
  const calls: { url: string; init: any }[] = [];
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(
      input instanceof URL ? input.href : (input?.url ?? input),
    );
    if (
      !url.startsWith("https://oauth2.googleapis.com") &&
      !url.startsWith("https://fcm.googleapis.com")
    )
      return realFetch(input, init);
    calls.push({ url, init });
    if (url.includes("oauth2"))
      return new Response(
        JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
        { status: 200 },
      );
    const body = JSON.parse(init.body);
    if (body.message.token === "dead-token")
      return new Response(
        JSON.stringify({ error: { status: "UNREGISTERED" } }),
        { status: 404 },
      );
    return new Response(
      JSON.stringify({ name: "projects/pista-test/messages/1" }),
      { status: 200 },
    );
  }) as any;
  try {
    const fcm = new FcmPush();
    assert.equal(fcm.configured(), true);
    const results = await fcm.send(["good-token", "dead-token"], {
      title: "Order confirmed",
      body: "Thanks",
      priority: "p0",
      data: { route: "order", orderId: "o1" },
    });
    assert.deepEqual(
      results.map((r) => [r.token, r.ok, !!r.invalidToken]),
      [
        ["good-token", true, false],
        ["dead-token", false, true],
      ],
    );
    const tokenCall = calls[0];
    const form = new URLSearchParams(tokenCall.init.body);
    assert.equal(
      form.get("grant_type"),
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    const [h, c, sig] = form.get("assertion")!.split(".");
    assert.equal(
      JSON.parse(Buffer.from(h, "base64url").toString()).alg,
      "RS256",
    );
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    assert.equal(claims.iss, "push@pista-test.iam.gserviceaccount.com");
    assert.equal(
      claims.scope,
      "https://www.googleapis.com/auth/firebase.messaging",
    );
    assert.ok(
      createVerify("RSA-SHA256")
        .update(`${h}.${c}`)
        .verify(publicKey, Buffer.from(sig, "base64url")),
      "the login assertion is genuinely signed",
    );
    const send = calls.find((x) =>
      x.url.includes("fcm.googleapis.com/v1/projects/pista-test/messages:send"),
    )!;
    assert.equal(send.init.headers.authorization, "Bearer ya29.test");
    const msg = JSON.parse(send.init.body).message;
    assert.deepEqual(msg.notification, {
      title: "Order confirmed",
      body: "Thanks",
    });
    assert.deepEqual(msg.data, { route: "order", orderId: "o1" });
    assert.equal(msg.android.priority, "HIGH");
    assert.equal(msg.apns.headers["apns-priority"], "10");
    const tokenCalls = calls.filter((x) => x.url.includes("oauth2")).length;
    await fcm.send(["good-token"], {
      title: "t",
      body: "b",
      priority: "p2",
      data: {},
    });
    assert.equal(
      calls.filter((x) => x.url.includes("oauth2")).length,
      tokenCalls,
      "the access token is reused",
    );
    const promo = JSON.parse(calls.at(-1)!.init.body).message;
    assert.equal(
      promo.android.priority,
      "NORMAL",
      "offers are not time-critical",
    );
    assert.equal(promo.apns.headers["apns-priority"], "5");
    // Through the service: a dead token is switched off.
    process.env.PUSH_PROVIDER = "fcm";
    await reset();
    await db.deviceToken.create({
      data: {
        userId: users.alice.id,
        platform: "android",
        app: "customer",
        token: "dead-token",
      },
    });
    const r = await n.notify({
      userId: users.alice.id,
      kind: "x",
      priority: "p0",
      title: "t",
      body: "b",
    });
    assert.equal(
      (await db.notification.findUniqueOrThrow({ where: { id: r.id! } }))
        .pushStatus,
      "failed",
    );
    assert.ok(
      (
        await db.deviceToken.findUniqueOrThrow({
          where: { token: "dead-token" },
        })
      ).disabledAt,
    );
    // Missing credentials: nothing is sent and nothing crashes.
    delete process.env.FCM_SERVICE_ACCOUNT;
    const none = await new FcmPush().send(["t"], {
      title: "t",
      body: "b",
      priority: "p0",
      data: {},
    });
    assert.equal(none[0].ok, false);
  } finally {
    globalThis.fetch = realFetch;
    process.env.PUSH_PROVIDER = "memory";
    delete process.env.FCM_PROJECT_ID;
    delete process.env.FCM_SERVICE_ACCOUNT;
  }
});
