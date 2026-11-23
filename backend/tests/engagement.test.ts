import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { Engagement } from "../src/engagement";
import { hash } from "../src/auth";
import { validateRuntime } from "../src/runtime";

const id = randomUUID(),
  outlet = "engage-test-" + id;
let app: any, db: Database, e: Engagement, base: string;
const tokens: Record<string, string> = {},
  users: Record<string, any> = {},
  products: Record<string, string> = {};

before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  for (const f of [
    "NOTIFICATIONS_POLL_DISABLED",
    "NOTIFICATIONS_CAMPAIGNS_DISABLED",
    "ENGAGEMENT_DISABLED",
    "SUPPORT_SWEEP_DISABLED",
    "PAYMENTS_SWEEP_DISABLED",
    "DISPATCH_DISABLED",
  ])
    process.env[f] = "true";
  process.env.PUSH_PROVIDER = "none";
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  e = app.get(Engagement);
  await db.outlet.create({ data: { id: outlet, name: "Engagement fixture" } });
  for (const [key, role] of [
    ["alice", "customer"],
    ["bob", "customer"],
    ["carol", "customer"],
    ["owner", "owner"],
    ["counter", "counter"],
    ["kitchen", "kitchen"],
  ] as const) {
    users[key] = await db.user.create({
      data: { outletId: outlet, name: key, role },
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
  for (const [k, name, price] of [
    ["biryani", "Chicken Biryani", 25000],
    ["haleem", "Haleem", 22000],
    ["kebab", "Kebab", 18000],
  ] as const) {
    products[k] = `${k}-${id}`;
    await db.product.create({
      data: {
        id: products[k],
        outletId: outlet,
        name,
        description: name,
        category: "Mains",
        pricePaise: price,
        vegetarian: false,
        available: true,
      },
    });
  }
});
after(async () => {
  if (db) {
    const ids = Object.values(users).map((u: any) => u.id);
    const orders = (
      await db.order.findMany({
        where: { outletId: outlet },
        select: { id: true },
      })
    ).map((o) => o.id);
    await db.orderRating.deleteMany({ where: { outletId: outlet } });
    await db.offer.deleteMany({ where: { outletId: outlet } });
    await db.notification.deleteMany({ where: { userId: { in: ids } } });
    await db.notificationPreference.deleteMany({
      where: { userId: { in: ids } },
    });
    await db.orderItem.deleteMany({ where: { orderId: { in: orders } } });
    await db.orderEvent.deleteMany({ where: { orderId: { in: orders } } });
    await db.order.deleteMany({ where: { outletId: outlet } });
    await db.product.deleteMany({ where: { outletId: outlet } });
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

async function order(
  who: string,
  status = "delivered",
  ageMinutes = 60,
  items: [string, number][] = [],
) {
  const key = randomUUID();
  const at = new Date(Date.now() - ageMinutes * 60000);
  return db.order.create({
    data: {
      outletId: outlet,
      customerId: users[who].id,
      idempotencyKey: key,
      requestHash: key,
      fulfilment: "pickup",
      status,
      paymentStatus: "paid",
      subtotalPaise: 1000,
      taxPaise: 0,
      deliveryPaise: 0,
      totalPaise: 1000,
      createdAt: at,
      events: {
        create: { actorId: users.owner.id, action: "deliver", createdAt: at },
      },
      items: {
        create: items.map(([p, q]) => ({
          productId: products[p],
          name: p,
          quantity: q,
          unitPaise: 100,
        })),
      },
    },
  });
}
const optIn = (who: string) =>
  db.notificationPreference.upsert({
    where: { userId: users[who].id },
    create: {
      userId: users[who].id,
      promotions: true,
      reminders: true,
      quietStart: 0,
      quietEnd: 0,
    },
    update: { promotions: true, reminders: true, quietStart: 0, quietEnd: 0 },
  });

test("a customer rates a finished order once, and only their own", async () => {
  const done = await order("alice");
  const open = await order("alice", "preparing", 5);
  assert.equal(
    (await call("POST", `/api/orders/${open.id}/rating`, "alice", { stars: 5 }))
      .status,
    400,
    "not finished yet",
  );
  assert.equal(
    (await call("POST", `/api/orders/${done.id}/rating`, "bob", { stars: 5 }))
      .status,
    404,
    "someone else's order",
  );
  assert.equal(
    (await call("POST", `/api/orders/${done.id}/rating`, "alice", { stars: 0 }))
      .status,
    400,
  );
  assert.equal(
    (await call("POST", `/api/orders/${done.id}/rating`, "alice", { stars: 6 }))
      .status,
    400,
  );
  assert.equal(
    (
      await call("POST", `/api/orders/${done.id}/rating`, "alice", {
        stars: 5,
        extra: 1,
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("POST", `/api/orders/${done.id}/rating`, "owner", { stars: 5 }))
      .status,
    403,
    "staff cannot rate",
  );
  const ok = await call("POST", `/api/orders/${done.id}/rating`, "alice", {
    stars: 5,
    comment: "Hot and tasty",
  });
  assert.equal(ok.status, 201);
  assert.equal(
    (await call("POST", `/api/orders/${done.id}/rating`, "alice", { stars: 1 }))
      .status,
    409,
    "only once",
  );
  assert.deepEqual(
    (await call("GET", `/api/orders/${done.id}/rating`, "alice")).json,
    { stars: 5, comment: "Hot and tasty" },
  );
  assert.equal(
    (await call("POST", `/api/orders/${done.id}/rating`, null, { stars: 5 }))
      .status,
    401,
  );
});

test("low ratings alert the owner and counter, and the owner sees an honest summary", async () => {
  const o = await order("bob");
  await call("POST", `/api/orders/${o.id}/rating`, "bob", {
    stars: 2,
    comment: "Arrived cold",
  });
  for (const who of ["owner", "counter"]) {
    const rows = await db.notification.findMany({
      where: { userId: users[who].id, kind: "staff.low_rating" },
    });
    assert.equal(rows.length, 1, who);
    assert.match(rows[0].body, /Arrived cold/);
  }
  assert.equal(
    await db.notification.count({
      where: { userId: users.kitchen.id, kind: "staff.low_rating" },
    }),
    0,
  );
  const s = await call("GET", "/api/ratings/summary", "owner");
  assert.equal(s.status, 200);
  assert.equal(s.json.count, 2);
  assert.equal(s.json.average, 3.5);
  assert.deepEqual(s.json.distribution, [0, 1, 0, 0, 1]);
  assert.match(s.json.note, /Fewer than 20/);
  assert.equal(s.json.lowRatings[0].comment, "Arrived cold");
  assert.equal(
    (await call("GET", "/api/ratings/summary", "alice")).status,
    403,
  );
  assert.equal(
    (await call("GET", "/api/ratings/summary", "kitchen")).status,
    403,
  );
});

test("a rating prompt goes out once, 30 minutes to 6 hours after, only to opted-in customers, and not if already rated", async () => {
  const carolOrder = await order("carol", "delivered", 45);
  const tooNew = await order("carol", "delivered", 5);
  await optIn("carol");
  const aliceDone = await db.order.findFirst({
    where: { customerId: users.alice.id, status: "delivered" },
  });
  await optIn("alice");
  const sent = await e.runRatingPrompts();
  const mine = await db.notification.findMany({
    where: { userId: users.carol.id, kind: "order.rate" },
  });
  assert.equal(mine.length, 1, "one prompt for the order that is old enough");
  assert.equal((mine[0].data as any).orderId, carolOrder.id);
  assert.ok(sent >= 1);
  assert.equal(
    await db.notification.count({
      where: { userId: users.alice.id, kind: "order.rate" },
    }),
    0,
    "already rated: no prompt",
  );
  assert.ok(aliceDone);
  assert.equal(
    await db.notification.count({
      where: {
        userId: users.carol.id,
        data: { path: ["orderId"], equals: tooNew.id },
      },
    }),
    0,
  );
  await e.runRatingPrompts();
  assert.equal(
    await db.notification.count({
      where: { userId: users.carol.id, kind: "order.rate" },
    }),
    1,
    "never twice",
  );
  const bobOrder = await order("bob", "delivered", 60);
  await e.runRatingPrompts();
  assert.equal(
    await db.notification.count({
      where: {
        userId: users.bob.id,
        data: { path: ["orderId"], equals: bobOrder.id },
      },
    }),
    0,
    "bob did not opt in to reminders",
  );
});

test("only the owner can create offers, with sensible limits", async () => {
  const good = {
    title: "Haleem is ready",
    body: "Fresh haleem from 6 pm tonight.",
    productId: products.haleem,
  };
  for (const who of ["alice", "counter", "kitchen"])
    assert.equal(
      (await call("POST", "/api/offers", who, good)).status,
      403,
      who,
    );
  assert.equal((await call("POST", "/api/offers", null, good)).status, 401);
  assert.equal(
    (await call("POST", "/api/offers", "owner", { ...good, title: "x" }))
      .status,
    400,
  );
  assert.equal(
    (await call("POST", "/api/offers", "owner", { ...good, productId: "nope" }))
      .status,
    400,
    "unknown dish",
  );
  assert.equal(
    (
      await call("POST", "/api/offers", "owner", {
        ...good,
        audience: "everyone",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("POST", "/api/offers", "owner", {
        ...good,
        startsAt: new Date(Date.now() - 3600000),
      })
    ).status,
    400,
    "in the past",
  );
  assert.equal(
    (
      await call("POST", "/api/offers", "owner", {
        ...good,
        startsAt: new Date(Date.now() + 40 * 86400000),
      })
    ).status,
    400,
    "too far ahead",
  );
  const made = await call("POST", "/api/offers", "owner", {
    ...good,
    startsAt: new Date(Date.now() + 86400000),
  });
  assert.equal(made.status, 201, JSON.stringify(made.json));
  assert.equal(made.json.status, "scheduled");
  assert.equal(
    (await call("POST", `/api/offers/${made.json.id}/cancel`, "owner")).status,
    201,
  );
  assert.equal(
    (await call("POST", `/api/offers/${made.json.id}/cancel`, "owner")).status,
    404,
    "already cancelled",
  );
  assert.equal((await call("GET", "/api/offers", "alice")).status, 403);
});

test("an offer is sent once, only to opted-in customers in its audience, and the daily limit holds", async () => {
  await db.offer.deleteMany({ where: { outletId: outlet } });
  await db.notification.deleteMany({
    where: {
      userId: { in: Object.values(users).map((u: any) => u.id) },
      kind: "offer",
    },
  });
  await optIn("alice");
  await db.notificationPreference.deleteMany({
    where: { userId: users.bob.id },
  });
  const made = await call("POST", "/api/offers", "owner", {
    title: "Haleem is ready",
    body: "Fresh haleem from 6 pm tonight.",
    productId: products.haleem,
  });
  assert.equal(made.status, 201);
  const sent = await e.runOffers();
  assert.ok(sent >= 2, "alice and carol are opted in");
  assert.equal(
    await db.notification.count({
      where: { userId: users.alice.id, kind: "offer" },
    }),
    1,
  );
  assert.equal(
    await db.notification.count({
      where: { userId: users.bob.id, kind: "offer" },
    }),
    0,
    "bob never opted in",
  );
  assert.equal(
    await db.notification.count({
      where: { userId: users.owner.id, kind: "offer" },
    }),
    0,
    "staff are not customers",
  );
  const row = await db.notification.findFirstOrThrow({
    where: { userId: users.alice.id, kind: "offer" },
  });
  assert.equal(row.priority, "p2");
  assert.equal(
    row.body,
    "Fresh haleem from 6 pm tonight.",
    "exactly what the owner wrote",
  );
  assert.equal((row.data as any).productId, products.haleem);
  assert.equal(await e.runOffers(), 0, "never sent twice");
  const list = await call("GET", "/api/offers", "owner");
  assert.equal(list.json[0].status, "sent");
  assert.ok(list.json[0].sentCount >= 2);
  const active = await call("GET", "/api/me/offers", "alice");
  assert.equal(active.json.length, 1);
  assert.equal(active.json[0].title, "Haleem is ready");
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await call("POST", "/api/offers", "owner", {
          title: `Extra ${i}`,
          body: "Another note for you.",
        })
      ).status,
      201,
    );
  assert.equal(
    (
      await call("POST", "/api/offers", "owner", {
        title: "Too many",
        body: "One more than allowed.",
      })
    ).status,
    400,
  );
});

test("audiences: lapsed and recent customers are chosen by their last order", async () => {
  for (const name of ["dave", "erin"])
    users[name] = await db.user.create({
      data: { outletId: outlet, name, role: "customer" },
    });
  await order("dave", "delivered", 60 * 24 * 30);
  await order("erin", "delivered", 60 * 24 * 3);
  const now = new Date();
  const lapsed = (await e["audience"](outlet, "lapsed", now)) as string[];
  const recent = (await e["audience"](outlet, "recent", now)) as string[];
  const all = (await e["audience"](outlet, "all", now)) as string[];
  assert.ok(lapsed.includes(users.dave.id) && !lapsed.includes(users.erin.id));
  assert.ok(recent.includes(users.erin.id) && !recent.includes(users.dave.id));
  assert.ok(all.includes(users.dave.id) && all.includes(users.erin.id));
  for (const list of [lapsed, recent, all])
    assert.ok(!list.includes(users.owner.id), "staff are never in an audience");
});

test("recommendations favour what the customer orders, then what is popular, with reasons", async () => {
  await db.order
    .deleteMany({
      where: { outletId: outlet, status: { in: ["delivered", "collected"] } },
    })
    .catch(() => {});
  const fresh = await db.order.findMany({
    where: { outletId: outlet },
    select: { id: true },
  });
  assert.ok(Array.isArray(fresh));
  await order("carol", "delivered", 60 * 24 * 2, [["biryani", 4]]);
  await order("carol", "delivered", 60 * 24 * 5, [["kebab", 1]]);
  await order("bob", "delivered", 60 * 24 * 3, [["haleem", 6]]);
  const r = await call("GET", "/api/me/recommendations", "carol");
  assert.equal(r.status, 200);
  assert.equal(r.json[0].name, "Chicken Biryani");
  assert.equal(r.json[0].reason, "You order this often");
  const haleem = r.json.find((x: any) => x.name === "Haleem");
  assert.ok(haleem, "popular items still appear");
  assert.equal(haleem.reason, "Popular this month");
  assert.ok(r.json.every((x: any) => x.productId && x.pricePaise > 0));
  await db.product.update({
    where: { id: products.kebab },
    data: { available: false },
  });
  const after = await call("GET", "/api/me/recommendations", "carol");
  assert.ok(
    !after.json.some((x: any) => x.name === "Kebab"),
    "unavailable dishes are never suggested",
  );
  await db.product.update({
    where: { id: products.kebab },
    data: { available: true },
  });
  assert.equal(
    (await call("GET", "/api/me/recommendations", "owner")).status,
    403,
  );
  const cold = await call("GET", "/api/me/recommendations", "alice");
  assert.ok(cold.json.length > 0, "a new customer still gets popular dishes");
});
