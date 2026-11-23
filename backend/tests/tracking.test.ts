import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { io, Socket } from "socket.io-client";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { Tracking } from "../src/tracking";
import { MapsSearch } from "../src/maps";
import { hash, Actor } from "../src/auth";
import { validateRuntime } from "../src/runtime";
const id = randomUUID(),
  outlet = "tracking-test-" + id;
let app: any,
  db: Database,
  tracking: Tracking,
  base: string,
  orderId: string,
  assignmentId: string;
let lease = "",
  publishingSocket: Socket;
const actors: Record<string, Actor> = {},
  tokens: Record<string, string> = {},
  sockets: Socket[] = [];
before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  tracking = app.get(Tracking);
  await db.outlet.create({
    data: { id: outlet, name: "Tracking test fixture" },
  });
  for (const role of [
    "customer",
    "other",
    "owner",
    "rider",
    "otherRider",
    "kitchen",
  ]) {
    const user = await db.user.create({
      data: {
        outletId: outlet,
        name: role,
        role:
          role === "other"
            ? "customer"
            : role === "otherRider"
              ? "rider"
              : role,
      },
    });
    actors[role] = user;
    const token = randomBytes(32).toString("hex");
    tokens[role] = token;
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hash(token),
        authMethod: "password",
        expiresAt: new Date(Date.now() + 600000),
      },
    });
  }
  const order = await db.order.create({
    data: {
      outletId: outlet,
      customerId: actors.customer.id,
      idempotencyKey: id,
      requestHash: id,
      fulfilment: "delivery",
      status: "out_for_delivery",
      paymentStatus: "paid",
      subtotalPaise: 1000,
      taxPaise: 0,
      deliveryPaise: 0,
      totalPaise: 1000,
      deliveryAddress: { latitude: 17.45, longitude: 78.12 },
      assignments: {
        create: { riderId: actors.rider.id, status: "picked_up" },
      },
    },
    include: { assignments: true },
  });
  orderId = order.id;
  assignmentId = order.assignments[0].id;
});
after(async () => {
  for (const socket of sockets) socket.disconnect();
  if (db) {
    await db.deliveryAssignment.deleteMany({ where: { orderId } });
    await db.order.deleteMany({ where: { outletId: outlet } });
    await db.session.deleteMany({ where: { user: { outletId: outlet } } });
    await db.user.deleteMany({ where: { outletId: outlet } });
    await db.outlet.deleteMany({ where: { id: outlet } });
  }
  await app?.close();
});
function point(extra: object = {}) {
  return {
    assignmentId,
    lease,
    latitude: 17.451,
    longitude: 78.123,
    accuracy: 8,
    heading: 90,
    recordedAt: new Date().toISOString(),
    ...extra,
  };
}
async function connect(token: string) {
  const socket = io(base, {
    transports: ["websocket"],
    path: "/api/tracking/socket.io",
    auth: { token },
    reconnection: false,
    forceNew: true,
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
    setTimeout(
      () => reject(new Error("Socket connection timed out")),
      5000,
    ).unref();
  });
  return socket;
}
test("tracking hides other customers, unrelated riders and kitchen access", async () => {
  await assert.rejects(() => connect("invalid-session"));
  await assert.rejects(() => connect(tokens.kitchen));
  for (const who of ["other", "otherRider", "kitchen"])
    await assert.rejects(() => tracking.snapshot(actors[who], orderId));
  await assert.rejects(() =>
    tracking.snapshot({ ...actors.owner, outletId: "another-outlet" }, orderId),
  );
  await assert.rejects(() => tracking.publish(actors.customer, point()));
  await assert.rejects(() => tracking.publish(actors.otherRider, point()));
  await assert.rejects(() =>
    tracking.publish(actors.rider, point({ latitude: 91 })),
  );
  await assert.rejects(() =>
    tracking.publish(
      actors.rider,
      point({ recordedAt: new Date(Date.now() - 60000).toISOString() }),
    ),
  );
  await assert.rejects(() =>
    tracking.publish(actors.rider, point({ accuracy: 101 })),
  );
});
test("area search caches valid provider results, throttles requests and fails closed during outages", async () => {
  const maps = app.get(MapsSearch) as MapsSearch;
  const original = global.fetch,
    endpoint = process.env.MAPS_GEOCODING_URL;
  let calls = 0;
  try {
    process.env.MAPS_GEOCODING_URL = "https://geocoding.test/api/";
    await assert.rejects(() => maps.search(actors.customer, "a"));
    global.fetch = async () => {
      calls++;
      return new Response(
        JSON.stringify({
          features: [
            {
              geometry: { coordinates: [78.1410641, 17.4538158] },
              properties: { name: "Sample landmark", city: "Shankarpally" },
            },
            {
              geometry: { coordinates: [900, 900] },
              properties: { name: "Invalid point" },
            },
          ],
        }),
      );
    };
    const first = await maps.search(actors.customer, "Sample landmark");
    assert.equal(first.places.length, 1);
    assert.equal(first.places[0].latitude, 17.4538158);
    assert.deepEqual(
      await maps.search(actors.customer, "Sample landmark"),
      first,
    );
    assert.equal(calls, 1);
    await assert.rejects(() =>
      maps.search(actors.customer, "Another landmark"),
    );
    await new Promise((r) => setTimeout(r, 1100));
    global.fetch = async () => {
      throw Error("Provider offline");
    };
    await assert.rejects(() =>
      maps.search(actors.customer, "Another landmark"),
    );
    const response = await original(base + "/api/maps/search?q=Shankarpally");
    assert.equal(response.status, 401);
  } finally {
    global.fetch = original;
    if (endpoint === undefined) delete process.env.MAPS_GEOCODING_URL;
    else process.env.MAPS_GEOCODING_URL = endpoint;
  }
});
test("real WebSocket sends authorized snapshots, restores on reconnect and rejects forged rooms", async () => {
  const customer = await connect(tokens.customer),
    rider = await connect(tokens.rider);
  publishingSocket = rider;
  const sharing = await rider.emitWithAck("tracking:start", { assignmentId });
  assert.equal(sharing.ok, true);
  lease = sharing.lease;
  const received = new Promise<any>((resolve, reject) => {
    customer.once("tracking:snapshot", resolve);
    setTimeout(() => reject(new Error("No authorized snapshot")), 5000).unref();
  });
  assert.equal(
    (await customer.emitWithAck("tracking:watch", { orderId })).ok,
    true,
  );
  assert.equal((await received).orderId, orderId);
  assert.equal(
    (await rider.emitWithAck("tracking:position", point())).ok,
    true,
  );
  const snapshot = await tracking.snapshot(actors.customer, orderId);
  assert.equal(snapshot.fresh, true);
  assert.equal((snapshot.location as any).latitude, 17.451);
  assert.equal(
    (await rider.emitWithAck("tracking:position", point())).ok,
    false,
  );
  const other = await connect(tokens.other);
  assert.equal(
    (await other.emitWithAck("tracking:watch", { orderId })).ok,
    false,
  );
  customer.disconnect();
  const reconnected = await connect(tokens.customer);
  assert.equal(
    (await reconnected.emitWithAck("tracking:watch", { orderId })).ok,
    true,
  );
  // Revocation closes an existing subscription, rather than leaving it in an authenticated room.
  const ended = new Promise<void>((resolve, reject) => {
    reconnected.once("disconnect", () => resolve());
    setTimeout(
      () => reject(new Error("Revoked socket stayed connected")),
      5500,
    ).unref();
  });
  await db.user.update({
    where: { id: actors.customer.id },
    data: { authVersion: { increment: 1 } },
  });
  await ended;
});
test("stopping sharing invalidates delayed packets and stale devices cannot stop a new lease", async () => {
  const previous = lease;
  await tracking.stop(actors.rider, assignmentId, previous);
  assert.equal((await tracking.snapshot(actors.owner, orderId)).sharing, false);
  await assert.rejects(() =>
    tracking.publish(actors.rider, point({ lease: previous })),
  );
  lease = (await tracking.begin(actors.rider, assignmentId)).lease;
  await tracking.stop(actors.rider, assignmentId, previous);
  assert.equal((await tracking.snapshot(actors.owner, orderId)).sharing, true);
  await tracking.publish(actors.rider, point());
  assert.equal((await tracking.snapshot(actors.owner, orderId)).fresh, true);
  // Let the publisher connection own the current lease for subsequent revocation checks.
  const owned = await publishingSocket.emitWithAck("tracking:start", {
    assignmentId,
  });
  lease = owned.lease;
  assert.equal(
    (await publishingSocket.emitWithAck("tracking:position", point())).ok,
    true,
  );
});
test("older fixes cannot overwrite a newer fix; routing uses provider data and survives outages", async () => {
  const stored = await db.deliveryAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
  });
  await db.deliveryAssignment.update({
    where: { id: assignmentId },
    data: { locationAt: new Date(Date.now() - 4000) },
  });
  await assert.rejects(() =>
    tracking.publish(
      actors.rider,
      point({
        recordedAt: new Date(
          stored.locationRecordedAt!.getTime() - 1000,
        ).toISOString(),
      }),
    ),
  );
  const original = global.fetch,
    endpoint = process.env.MAPS_ROUTING_URL;
  try {
    process.env.MAPS_ROUTING_URL = "https://routing.test";
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              duration: 180,
              distance: 950,
              geometry: {
                coordinates: [
                  [78.123, 17.451],
                  [78.12, 17.45],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    const route = (await tracking.route(actors.owner, orderId)) as any;
    assert.equal(route.durationSeconds, 180);
    assert.equal(route.trafficAware, false);
    assert.equal(route.coordinates.length, 2);
    // Move the fixture to bypass the short route cache, then simulate an unavailable provider.
    await db.deliveryAssignment.update({
      where: { id: assignmentId },
      data: {
        location: { latitude: 17.46, longitude: 78.13, accuracy: 8 },
        locationAt: new Date(),
      },
    });
    global.fetch = async () => {
      throw new Error("Provider offline");
    };
    assert.equal(
      (await tracking.route(actors.owner, orderId)).available,
      false,
    );
  } finally {
    global.fetch = original;
    if (endpoint === undefined) delete process.env.MAPS_ROUTING_URL;
    else process.env.MAPS_ROUTING_URL = endpoint;
  }
});
test("revoking the rider session closes its socket and removes the active GPS lease", async () => {
  const ended = new Promise<void>((resolve, reject) => {
    publishingSocket.once("disconnect", () => resolve());
    setTimeout(() => reject(Error("Publisher was not revoked")), 5500).unref();
  });
  await db.user.update({
    where: { id: actors.rider.id },
    data: { authVersion: { increment: 1 } },
  });
  await ended;
  const deadline = Date.now() + 5000;
  while (
    (
      await db.deliveryAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      })
    ).locationLease !== null
  ) {
    if (Date.now() > deadline)
      throw Error("Revoked publisher retained its lease");
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal((await tracking.snapshot(actors.owner, orderId)).location, null);
  await assert.rejects(() => tracking.authenticate(tokens.rider));
});
test("stale and terminal delivery states never appear as a live rider", async () => {
  await db.deliveryAssignment.update({
    where: { id: assignmentId },
    data: { locationAt: new Date(Date.now() - 60000) },
  });
  assert.equal((await tracking.snapshot(actors.owner, orderId)).fresh, false);
  await db.order.update({
    where: { id: orderId },
    data: { status: "delivered" },
  });
  const final = await tracking.snapshot(actors.owner, orderId);
  assert.equal(final.location, null);
  assert.equal(final.rider, null);
  assert.equal(final.sharing, false);
  await assert.rejects(() => tracking.publish(actors.rider, point()));
  assert.equal((await tracking.route(actors.owner, orderId)).available, false);
});

async function makeOrder(
  status: string,
  events: { action: string; at: number }[] = [],
  assignment?: {
    status: string;
    at: number;
    events: { action: string; at: number }[];
  },
) {
  const key = randomUUID();
  const order = await db.order.create({
    data: {
      outletId: outlet,
      customerId: actors.customer.id,
      idempotencyKey: key,
      requestHash: key,
      fulfilment: "delivery",
      status,
      paymentStatus: "paid",
      subtotalPaise: 1000,
      taxPaise: 0,
      deliveryPaise: 0,
      totalPaise: 1000,
      deliveryAddress: { latitude: 17.46, longitude: 78.13 },
      events: {
        create: events.map((e) => ({
          actorId: actors.owner.id,
          action: e.action,
          createdAt: new Date(e.at),
        })),
      },
      ...(assignment
        ? {
            assignments: {
              create: {
                riderId: actors.rider.id,
                status: assignment.status,
                isActive: status !== "delivered",
                createdAt: new Date(assignment.at),
                events: {
                  create: assignment.events.map((e) => ({
                    actorId: actors.rider.id,
                    action: e.action,
                    createdAt: new Date(e.at),
                  })),
                },
              },
            },
          }
        : {}),
    },
  });
  return order.id;
}
async function removeOrders(ids: string[]) {
  await db.assignmentEvent.deleteMany({
    where: { assignment: { orderId: { in: ids } } },
  });
  await db.deliveryAssignment.deleteMany({ where: { orderId: { in: ids } } });
  await db.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
}

test("delivery estimate is staged, labelled and ranged without inventing a route", async () => {
  const saved = process.env.MAPS_ROUTING_URL;
  process.env.MAPS_ROUTING_URL = "";
  (tracking as any).etaHistory.clear();
  await db.outlet.update({
    where: { id: outlet },
    data: { latitude: 17.4538, longitude: 78.1411 },
  });
  const now = Date.now();
  const ids: string[] = [];
  try {
    const preparing = await makeOrder("preparing", [
      { action: "accept", at: now - 5 * 60000 },
    ]);
    ids.push(preparing);
    const eta = (await tracking.eta(actors.owner, preparing)) as any;
    assert.equal(eta.available, true);
    assert.deepEqual(
      eta.stages.map((s: any) => s.key),
      ["prep", "assign", "pickup", "travel", "handoff"],
    );
    assert.equal(eta.stages[0].minutes, 10);
    assert.equal(eta.stages[0].source, "default");
    assert.equal(eta.stages[3].source, "estimate");
    assert.equal(eta.confidence, "rough");
    assert.equal(eta.trafficAware, false);
    assert.ok(eta.minutesLow < eta.totalMinutes);
    assert.ok(eta.minutesHigh > eta.totalMinutes);
    await assert.rejects(() => tracking.eta(actors.other, preparing));
    await assert.rejects(() => tracking.eta(actors.kitchen, preparing));

    const rolling = await makeOrder("out_for_delivery", [], {
      status: "picked_up",
      at: now,
      events: [{ action: "picked_up", at: now }],
    });
    ids.push(rolling);
    const onTheWay = (await tracking.eta(actors.customer, rolling)) as any;
    assert.equal(onTheWay.available, true);
    assert.deepEqual(
      onTheWay.stages.map((s: any) => s.key),
      ["travel", "handoff"],
    );
  } finally {
    process.env.MAPS_ROUTING_URL = saved;
    await removeOrders(ids);
    await db.outlet.update({
      where: { id: outlet },
      data: { latitude: null, longitude: null },
    });
  }
});

test("delivery estimate uses this outlet's own history once it has five samples", async () => {
  const saved = process.env.MAPS_ROUTING_URL;
  process.env.MAPS_ROUTING_URL = "";
  (tracking as any).etaHistory.clear();
  await db.outlet.update({
    where: { id: outlet },
    data: { latitude: 17.4538, longitude: 78.1411 },
  });
  const day = Date.now() - 86400000;
  const ids: string[] = [];
  try {
    for (let i = 0; i < 5; i++)
      ids.push(
        await makeOrder(
          "delivered",
          [
            { action: "accept", at: day },
            { action: "ready", at: day + 20 * 60000 },
          ],
          {
            status: "delivered",
            at: day + 22 * 60000,
            events: [{ action: "picked_up", at: day + 30 * 60000 }],
          },
        ),
      );
    const fresh = await makeOrder("accepted", [
      { action: "accept", at: Date.now() },
    ]);
    ids.push(fresh);
    const eta = (await tracking.eta(actors.owner, fresh)) as any;
    const prep = eta.stages.find((s: any) => s.key === "prep");
    assert.equal(prep.source, "history");
    assert.equal(prep.minutes, 20);
    assert.equal(eta.stages.find((s: any) => s.key === "assign").minutes, 2);
    assert.equal(eta.stages.find((s: any) => s.key === "pickup").minutes, 8);
  } finally {
    process.env.MAPS_ROUTING_URL = saved;
    (tracking as any).etaHistory.clear();
    await removeOrders(ids);
    await db.outlet.update({
      where: { id: outlet },
      data: { latitude: null, longitude: null },
    });
  }
});
