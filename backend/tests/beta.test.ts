import "reflect-metadata";
import "dotenv/config";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { hash } from "../src/auth";
import { passwordHash } from "../src/accounts/passwords";
import { betaEnabled, validateRuntime } from "../src/runtime";
const run = randomUUID(),
  outlet = "test-beta-" + run,
  ip = "test-beta-ip-" + run,
  product = "test-beta-item-" + run,
  handle = "test.beta." + run.replaceAll("-", "").slice(0, 12),
  password = randomBytes(24).toString("hex");
let app: INestApplication,
  db: Database,
  base: string,
  customerToken: string,
  ownerToken: string,
  riderToken: string;
const original = { ...process.env },
  orderIds: string[] = [];
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  key?: string,
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  return { status: r.status, data: await r.json() };
}
before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  assert.equal(new URL(env.DATABASE_URL).pathname, "/pista_beta");
  Object.assign(process.env, env);
  app = await NestFactory.create(AppModule, { logger: false });
  app.use((req: any, _res: any, next: () => void) => {
    Object.defineProperty(req, "ip", { value: ip, configurable: true });
    next();
  });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  await db.outlet.create({
    data: { id: outlet, name: "Isolated beta test fixture" },
  });
  const customer = await db.user.create({
    data: {
      outletId: outlet,
      name: "Sample beta customer",
      role: "customer",
      credential: {
        create: { handle, passwordHash: await passwordHash(password) },
      },
    },
  });
  const owner = await db.user.create({
      data: { outletId: outlet, name: "Sample beta owner", role: "owner" },
    }),
    rider = await db.user.create({
      data: {
        outletId: outlet,
        name: "Sample beta rider",
        role: "rider",
        riderAvailable: true,
      },
    });
  for (const [user, set] of [
    [owner, (v: string) => (ownerToken = v)],
    [rider, (v: string) => (riderToken = v)],
  ] as const) {
    const token = randomBytes(32).toString("hex");
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hash(token),
        authMethod: "password",
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    set(token);
  }
  await db.product.create({
    data: {
      id: product,
      outletId: outlet,
      name: "Sample beta food",
      description: "Test fixture only",
      category: "Test",
      pricePaise: 1000,
      vegetarian: true,
    },
  });
  await db.deliveryZone.create({
    data: {
      outletId: outlet,
      postalCode: "000000",
      name: "Test-only zone",
      deliveryPaise: 2000,
      developmentOnly: true,
    },
  });
  const signed = await call("/auth/login", "POST", {
    handle,
    password,
    audience: "customer",
  });
  assert.equal(signed.status, 201);
  customerToken = signed.data.token;
});
after(async () => {
  try {
    if (db) {
      await db.$transaction(async (tx) => {
        const users = await tx.user.findMany({
            where: { outletId: outlet },
            select: { id: true },
          }),
          assignments = await tx.deliveryAssignment.findMany({
            where: { orderId: { in: orderIds } },
            select: { id: true },
          });
        await tx.assignmentEvent.deleteMany({
          where: { assignmentId: { in: assignments.map((a) => a.id) } },
        });
        await tx.deliveryAssignment.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.paymentEvent.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.orderEvent.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
        await tx.outboxEvent.deleteMany({ where: { outletId: outlet } });
        await tx.auditEvent.deleteMany({ where: { outletId: outlet } });
        await tx.session.deleteMany({
          where: { userId: { in: users.map((u) => u.id) } },
        });
        await tx.credential.deleteMany({
          where: { userId: { in: users.map((u) => u.id) } },
        });
        await tx.user.deleteMany({ where: { outletId: outlet } });
        await tx.product.deleteMany({ where: { outletId: outlet } });
        await tx.deliveryZone.deleteMany({ where: { outletId: outlet } });
        await tx.outlet.deleteMany({ where: { id: outlet } });
        await tx.authThrottle.deleteMany({
          where: {
            key: {
              in: [hash(`login:ip:${ip}`), hash(`login:identity:${handle}`)],
            },
          },
        });
      });
    }
  } finally {
    if (app) await app.close();
    for (const key of [
      "NODE_ENV",
      "PISTA_BETA_MODE",
      "DEV_ADAPTERS",
      "DATABASE_URL",
      "HOST",
      "PORT",
      "DELIVERY_OTP_SECRET",
    ]) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
test("beta startup cannot expose the development database or run in production", () => {
  assert.equal(betaEnabled(), true);
  assert.throws(() =>
    validateRuntime({
      NODE_ENV: "production",
      PISTA_BETA_MODE: "true",
      DEV_ADAPTERS: "false",
      DATABASE_URL: "postgresql://localhost/pista_beta",
    }),
  );
  assert.throws(() =>
    validateRuntime({
      NODE_ENV: "staging",
      PISTA_BETA_MODE: "true",
      DEV_ADAPTERS: "false",
      DATABASE_URL: "postgresql://localhost/pista",
    }),
  );
  assert.throws(() =>
    validateRuntime({
      NODE_ENV: "staging",
      PISTA_BETA_MODE: "true",
      DEV_ADAPTERS: "true",
      DATABASE_URL: "postgresql://localhost/pista_beta",
    }),
  );
  assert.throws(() =>
    validateRuntime({
      NODE_ENV: "staging",
      PISTA_BETA_MODE: "true",
      DEV_ADAPTERS: "false",
      DATABASE_URL: "postgresql://localhost/pista_beta",
      HOST: "0.0.0.0",
    }),
  );
});
test("private beta customer can complete a simulated delivery while anonymous development access stays disabled", async () => {
  assert.equal(
    (await call("/auth/development", "POST", { identity: "owner" })).status,
    503,
  );
  assert.equal((await call("/orders")).status, 401);
  const body = {
    fulfilment: "delivery",
    items: [{ productId: product, quantity: 1 }],
    deliveryAddress: {
      recipient: "Sample beta recipient",
      phone: "9000000000",
      line1: "Sample beta address only",
      city: "Sample city",
      postalCode: "000000",
    },
  };
  const created = await call(
    "/orders",
    "POST",
    body,
    customerToken,
    randomUUID(),
  );
  assert.equal(created.status, 201);
  let order = created.data;
  orderIds.push(order.id);
  assert.equal(order.totalPaise, 3000);
  assert.equal(
    (
      await call(
        `/orders/${order.id}/development-payment`,
        "POST",
        { eventId: randomUUID() },
        customerToken,
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/beta-payment`,
        "POST",
        { eventId: randomUUID() },
        ownerToken,
      )
    ).status,
    403,
  );
  const eventId = randomUUID();
  const paid = await call(
    `/orders/${order.id}/beta-payment`,
    "POST",
    { eventId },
    customerToken,
  );
  assert.equal(paid.status, 201);
  order = paid.data;
  assert.equal(
    (
      await call(
        `/orders/${order.id}/beta-payment`,
        "POST",
        { eventId },
        customerToken,
      )
    ).status,
    201,
  );
  assert.equal(
    (await db.paymentEvent.findUniqueOrThrow({ where: { id: eventId } }))
      .provider,
    "beta_simulated",
  );
  for (const action of ["accept", "prepare", "ready"]) {
    const r = await call(
      `/orders/${order.id}/actions`,
      "POST",
      { action, version: order.version },
      ownerToken,
    );
    assert.equal(r.status, 201);
    order = r.data;
  }
  const rider = await db.user.findFirstOrThrow({
    where: { outletId: outlet, role: "rider" },
  });
  const assigned = await call(
    `/orders/${order.id}/assignment`,
    "POST",
    { riderId: rider.id, version: order.version },
    ownerToken,
  );
  assert.equal(assigned.status, 201);
  assert.equal(
    (
      await call(
        `/rider/tasks/${assigned.data.id}/actions`,
        "POST",
        { action: "pickup", version: assigned.data.version },
        riderToken,
      )
    ).status,
    201,
  );
  const code = await call(
    `/orders/${order.id}/delivery-code`,
    "POST",
    {},
    customerToken,
  );
  assert.equal(code.status, 201);
  const task = (
    await call("/rider/tasks", "GET", undefined, riderToken)
  ).data.tasks.find((t: { id: string }) => t.id === assigned.data.id);
  assert.equal(
    (
      await call(
        `/rider/tasks/${task.id}/complete`,
        "POST",
        { code: code.data.code, version: task.version },
        riderToken,
      )
    ).status,
    201,
  );
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    "delivered",
  );
});
test("beta customer password and simulated-payment routes fail closed when beta mode is disabled", async () => {
  process.env.PISTA_BETA_MODE = "false";
  try {
    assert.equal(
      (
        await call("/auth/login", "POST", {
          handle,
          password,
          audience: "customer",
        })
      ).status,
      503,
    );
    assert.equal(
      (
        await call(
          `/orders/${orderIds[0]}/beta-payment`,
          "POST",
          { eventId: randomUUID() },
          customerToken,
        )
      ).status,
      503,
    );
  } finally {
    process.env.PISTA_BETA_MODE = "true";
  }
});
