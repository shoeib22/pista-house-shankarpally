import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { Dispatch } from "../src/dispatch";
import { Delivery } from "../src/delivery";
import { hash, Actor } from "../src/auth";
import { validateRuntime } from "../src/runtime";
import { INF, hungarian, greedy, assignBest } from "../src/matching";

const id = randomUUID(),
  outlet = "dispatch-test-" + id;
let app: any,
  db: Database,
  dispatch: Dispatch,
  delivery: Delivery,
  base: string;
const actors: Record<string, Actor> = {},
  tokens: Record<string, string> = {},
  orderIds: string[] = [];

before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  process.env.DISPATCH_DISABLED = "true"; // tests drive the cycle by hand
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  dispatch = app.get(Dispatch);
  delivery = app.get(Delivery);
  await db.outlet.create({
    data: {
      id: outlet,
      name: "Dispatch fixture",
      latitude: 17.4538,
      longitude: 78.1411,
    },
  });
  for (const [key, role] of [
    ["customer", "customer"],
    ["owner", "owner"],
    ["kitchen", "kitchen"],
    ["riderA", "rider"],
    ["riderB", "rider"],
  ] as const) {
    const user = await db.user.create({
      data: {
        outletId: outlet,
        name: key,
        role,
        riderAvailable: role === "rider",
      },
    });
    actors[key] = user;
    const token = randomBytes(32).toString("hex");
    tokens[key] = token;
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hash(token),
        authMethod: "password",
        expiresAt: new Date(Date.now() + 600000),
      },
    });
  }
});
after(async () => {
  if (db) {
    const ids = orderIds;
    await db.deliveryOffer.deleteMany({ where: { outletId: outlet } });
    await db.assignmentEvent.deleteMany({
      where: { assignment: { orderId: { in: ids } } },
    });
    await db.deliveryAssignment.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
    await db.auditEvent.deleteMany({ where: { outletId: outlet } });
    await db.order.deleteMany({ where: { outletId: outlet } });
    await db.session.deleteMany({ where: { user: { outletId: outlet } } });
    await db.user.deleteMany({ where: { outletId: outlet } });
    await db.outlet.deleteMany({ where: { id: outlet } });
  }
  await app?.close();
});

async function reset() {
  await db.deliveryOffer.deleteMany({ where: { outletId: outlet } });
  await db.assignmentEvent.deleteMany({
    where: { assignment: { order: { outletId: outlet } } },
  });
  await db.deliveryAssignment.deleteMany({
    where: { order: { outletId: outlet } },
  });
  await db.orderEvent.deleteMany({ where: { order: { outletId: outlet } } });
  await db.order.deleteMany({ where: { outletId: outlet } });
  await db.user.updateMany({
    where: { outletId: outlet, role: "rider" },
    data: { riderAvailable: true },
  });
  await db.outlet.update({
    where: { id: outlet },
    data: { autoDispatch: true },
  });
}
async function readyOrder(minutesAgo = 1) {
  const key = randomUUID();
  const o = await db.order.create({
    data: {
      outletId: outlet,
      customerId: actors.customer.id,
      idempotencyKey: key,
      requestHash: key,
      fulfilment: "delivery",
      status: "ready",
      paymentStatus: "paid",
      subtotalPaise: 1000,
      taxPaise: 0,
      deliveryPaise: 2000,
      totalPaise: 3000,
      deliveryAddress: {
        recipient: "Private Name",
        phone: "9000000000",
        line1: "Private street",
        city: "Shankarpally",
        postalCode: "501203",
        latitude: 17.46,
        longitude: 78.13,
      },
      events: {
        create: {
          actorId: actors.owner.id,
          action: "ready",
          createdAt: new Date(Date.now() - minutesAgo * 60000),
        },
      },
    },
  });
  orderIds.push(o.id);
  return o.id;
}
const live = (orderId: string) =>
  db.deliveryOffer.findMany({ where: { orderId, status: "offered" } });
async function api(method: string, path: string, who: string, body?: object) {
  const r = await fetch(base + path, {
    method,
    headers: {
      authorization: `Bearer ${tokens[who]}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

test("hungarian finds the cheapest assignment, including rectangular and forbidden pairs", () => {
  const cost = [
    [4, 1, 3],
    [2, 0, 5],
    [3, 2, 2],
  ];
  const best = hungarian(cost);
  const total = [...best].reduce((s, [r, c]) => s + cost[r][c], 0);
  // Brute force over all permutations.
  const perms = (a: number[]): number[][] =>
    a.length < 2
      ? [a]
      : a.flatMap((x, i) =>
          perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]),
        );
  const optimum = Math.min(
    ...perms([0, 1, 2]).map((p) => p.reduce((s, c, r) => s + cost[r][c], 0)),
  );
  assert.equal(total, optimum);
  assert.equal(best.size, 3);
  // More orders than riders: only two get served, and the cheapest two.
  const tall = hungarian([[5], [1], [3]]);
  assert.deepEqual([...tall], [[1, 0]]);
  // More riders than orders.
  const wide = hungarian([[9, 2, 7]]);
  assert.deepEqual([...wide], [[0, 1]]);
  // A forbidden pair is never returned.
  assert.equal(hungarian([[INF, INF]]).size, 0);
  assert.deepEqual(
    [
      ...hungarian([
        [INF, 3],
        [2, INF],
      ]),
    ].sort(),
    [
      [0, 1],
      [1, 0],
    ],
  );
  assert.equal(hungarian([]).size, 0);
});

test("greedy fallback serves orders in priority order and respects limits", () => {
  const g = greedy([
    [1, 2],
    [1, 2],
    [1, 2],
  ]);
  assert.deepEqual(
    [...g],
    [
      [0, 0],
      [1, 1],
    ],
  );
  const big = Array.from({ length: 90 }, () => Array(2).fill(1));
  assert.equal(assignBest(big).method, "greedy");
  assert.equal(assignBest([[1]]).method, "hungarian");
});

test("auto-dispatch is off by default and does nothing until switched on", async () => {
  await reset();
  await db.outlet.update({
    where: { id: outlet },
    data: { autoDispatch: false },
  });
  const order = await readyOrder();
  assert.equal((await dispatch.cycle(outlet)).method, "off");
  assert.equal((await live(order)).length, 0);
});

test("a ready order goes to the rider who has done less work", async () => {
  await reset();
  const order = await readyOrder();
  // Rider B has delivered twice recently, so rider A should be offered the order.
  for (let i = 0; i < 2; i++) {
    const done = await readyOrder();
    await db.deliveryAssignment.create({
      data: {
        orderId: done,
        riderId: actors.riderB.id,
        status: "delivered",
        isActive: false,
      },
    });
    await db.order.update({
      where: { id: done },
      data: { status: "delivered" },
    });
  }
  const result = await dispatch.cycle(outlet);
  assert.equal(result.offered, 1);
  const offers = await live(order);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].riderId, actors.riderA.id);
  assert.ok(offers[0].expiresAt.getTime() > Date.now());
});

test("concurrent cycles never double-book a rider or an order", async () => {
  await reset();
  const order = await readyOrder();
  await Promise.allSettled([
    dispatch.cycle(outlet),
    dispatch.cycle(outlet),
    dispatch.cycle(outlet),
  ]);
  assert.equal((await live(order)).length, 1);
  const second = await readyOrder();
  await Promise.allSettled([dispatch.cycle(outlet), dispatch.cycle(outlet)]);
  const riders = (
    await db.deliveryOffer.findMany({
      where: { outletId: outlet, status: "offered" },
    })
  ).map((o) => o.riderId);
  assert.equal(new Set(riders).size, riders.length);
  assert.equal((await live(second)).length, 1);
  // The database itself refuses a second live offer for the same rider.
  await assert.rejects(() =>
    db.deliveryOffer.create({
      data: {
        outletId: outlet,
        orderId: order,
        riderId: riders[0],
        expiresAt: new Date(Date.now() + 1000),
      },
    }),
  );
});

test("a declined offer moves to the next rider, then to manual assignment", async () => {
  await reset();
  const order = await readyOrder();
  await dispatch.cycle(outlet);
  const first = (await live(order))[0];
  const firstRider = first.riderId === actors.riderA.id ? "riderA" : "riderB";
  const other = firstRider === "riderA" ? "riderB" : "riderA";
  const declined = await delivery.respondOffer(actors[firstRider], first.id, {
    accept: false,
  });
  assert.equal(declined.accepted, false);
  await dispatch.cycle(outlet);
  const second = (await live(order))[0];
  assert.equal(second.riderId, actors[other].id, "next rider is offered");
  await delivery.respondOffer(actors[other], second.id, { accept: false });
  await dispatch.cycle(outlet);
  assert.equal((await live(order)).length, 0);
  const status = await dispatch.status(outlet);
  assert.deepEqual(
    status.needsManual.map((o) => o.orderId),
    [order],
  );
  assert.equal(status.enabled, true);
});

test("an unanswered offer expires and is passed on", async () => {
  await reset();
  const order = await readyOrder();
  await dispatch.cycle(outlet);
  const offer = (await live(order))[0];
  await db.deliveryOffer.update({
    where: { id: offer.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await dispatch.cycle(outlet);
  const stale = await db.deliveryOffer.findUniqueOrThrow({
    where: { id: offer.id },
  });
  assert.equal(stale.status, "expired");
  const next = await live(order);
  assert.equal(next.length, 1);
  assert.notEqual(next[0].riderId, offer.riderId);
  await assert.rejects(
    () =>
      delivery.respondOffer(
        actors[offer.riderId === actors.riderA.id ? "riderA" : "riderB"],
        offer.id,
        { accept: true },
      ),
    /expired|withdrawn/,
  );
});

test("accepting creates the assignment once, and only for the offered rider", async () => {
  await reset();
  const order = await readyOrder();
  await dispatch.cycle(outlet);
  const offer = (await live(order))[0];
  const who = offer.riderId === actors.riderA.id ? "riderA" : "riderB";
  const other = who === "riderA" ? "riderB" : "riderA";
  await assert.rejects(
    () => delivery.respondOffer(actors[other], offer.id, { accept: true }),
    /not found/i,
  );
  const shown = (await delivery.currentOffer(actors[who])) as any;
  assert.equal(shown.offer.id, offer.id);
  const text = JSON.stringify(shown);
  for (const secret of ["Private Name", "9000000000", "Private street"])
    assert.ok(!text.includes(secret), `offer must not reveal ${secret}`);
  assert.equal(
    ((await delivery.currentOffer(actors[other])) as any).offer,
    null,
  );
  const accepted = (await delivery.respondOffer(actors[who], offer.id, {
    accept: true,
  })) as any;
  assert.equal(accepted.accepted, true);
  const assignments = await db.deliveryAssignment.findMany({
    where: { orderId: order, isActive: true },
  });
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].riderId, actors[who].id);
  assert.equal(
    (await db.deliveryOffer.findUniqueOrThrow({ where: { id: offer.id } }))
      .status,
    "accepted",
  );
  await assert.rejects(
    () => delivery.respondOffer(actors[who], offer.id, { accept: true }),
    /expired|withdrawn/,
  );
  // A rider on a delivery is not offered more work (no batching).
  const second = await readyOrder();
  await dispatch.cycle(outlet);
  const offers = await live(second);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].riderId, actors[other].id);
});

test("a live offer is withdrawn if the order is assigned by hand or the rider goes offline", async () => {
  await reset();
  const order = await readyOrder();
  await dispatch.cycle(outlet);
  const offer = (await live(order))[0];
  const who = offer.riderId === actors.riderA.id ? "riderA" : "riderB";
  await db.user.update({
    where: { id: actors[who].id },
    data: { riderAvailable: false },
  });
  await dispatch.cycle(outlet);
  assert.equal(
    (await db.deliveryOffer.findUniqueOrThrow({ where: { id: offer.id } }))
      .status,
    "cancelled",
  );
  const next = await live(order);
  assert.equal(next.length, 1);
  assert.notEqual(next[0].riderId, actors[who].id);
});

test("only the owner can switch auto-dispatch; staff can read its status", async () => {
  await reset();
  assert.equal(
    (
      await api("PATCH", "/api/outlet/auto-dispatch", "kitchen", {
        enabled: false,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("PATCH", "/api/outlet/auto-dispatch", "riderA", {
        enabled: false,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("PATCH", "/api/outlet/auto-dispatch", "owner", {
        enabled: "yes",
      })
    ).status,
    400,
  );
  const off = await api("PATCH", "/api/outlet/auto-dispatch", "owner", {
    enabled: false,
  });
  assert.equal(off.status, 200);
  assert.equal(off.json.autoDispatch, false);
  const status = await api("GET", "/api/dispatch/status", "owner");
  assert.equal(status.status, 200);
  assert.equal(status.json.enabled, false);
  assert.equal(
    (await api("GET", "/api/dispatch/status", "customer")).status,
    403,
  );
  assert.equal((await api("GET", "/api/rider/offer", "customer")).status, 403);
  assert.equal((await api("GET", "/api/rider/offer", "riderA")).status, 200);
});

test("a rider's in-app route is private to their own active delivery", async () => {
  await reset();
  const saved = process.env.MAPS_ROUTING_URL;
  process.env.MAPS_ROUTING_URL = "";
  try {
    const order = await readyOrder();
    const assignment = await db.deliveryAssignment.create({
      data: { orderId: order, riderId: actors.riderA.id },
    });
    const url = `/api/rider/tasks/${assignment.id}/route`;
    const mine = await api("GET", `${url}?lat=17.45&lon=78.13`, "riderA");
    assert.equal(mine.status, 200);
    assert.equal(mine.json.available, false);
    assert.match(mine.json.reason, /not configured/i);
    assert.equal(
      (await api("GET", `${url}?lat=abc&lon=78.13`, "riderA")).status,
      400,
    );
    assert.equal(
      (await api("GET", `${url}?lat=95&lon=78.13`, "riderA")).status,
      400,
    );
    assert.equal(
      (await api("GET", `${url}?lat=17.45&lon=78.13`, "riderB")).status,
      404,
    );
    assert.equal(
      (await api("GET", `${url}?lat=17.45&lon=78.13`, "owner")).status,
      401,
    );
    assert.equal(
      (await api("GET", `${url}?lat=17.45&lon=78.13`, "customer")).status,
      401,
    );
  } finally {
    process.env.MAPS_ROUTING_URL = saved;
  }
});
