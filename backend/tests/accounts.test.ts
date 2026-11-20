import "reflect-metadata";
import "dotenv/config";
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { hash } from "../src/auth";
import { bootstrapOwner } from "../database/bootstrap-owner";
import { Delivery } from "../src/delivery";
let app: INestApplication,
  db: Database,
  base: string,
  ownerToken: string,
  otherOwnerToken: string;
const run = randomUUID().replaceAll("-", "").slice(0, 12),
  outlet = `test-accounts-${run}`,
  otherOutlet = `test-accounts-other-${run}`,
  ip = `accounts-test-${run}`;
const secret = () => randomBytes(24).toString("hex") + "aA9!";
const ownerPassword = secret(),
  ownerHandle = `test.owner.${run}`;
const worker = {
  id: "",
  handle: `test.counter.${run}`,
  password: secret(),
  token: "",
};
const keys = new Set<string>(),
  fixtureOrders: string[] = [];
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  extra: Record<string, string> = {},
) {
  const input = body as Record<string, string> | undefined;
  if (path === "/auth/login" && input?.handle)
    keys.add(hash(`login:identity:${input.handle.trim().toLowerCase()}`));
  if (path === "/auth/accept-invitation" && input?.token)
    keys.add(hash(`invitation:identity:${hash(input.token)}`));
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  return { status: r.status, data: await r.json() };
}
async function login(handle: string, password: string, audience = "employee") {
  return call("/auth/login", "POST", { handle, password, audience });
}
async function invite(handle: string, role = "counter") {
  const r = await call(
    "/team/invitations",
    "POST",
    { name: "Sample invited teammate", handle, role },
    ownerToken,
  );
  assert.equal(r.status, 201);
  return r.data;
}
before(async () => {
  assert.equal(process.env.NODE_ENV, "development");
  assert.equal(process.env.DEV_ADAPTERS, "true");
  app = await NestFactory.create(AppModule, { logger: false });
  // Isolated test server uses a synthetic source address to keep its rate-limit records separate.
  app.use((req: any, _res: any, next: () => void) => {
    Object.defineProperty(req, "ip", { value: ip, configurable: true });
    next();
  });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  await db.outlet.createMany({
    data: [
      { id: outlet, name: "Account test fixture" },
      { id: otherOutlet, name: "Other account test fixture" },
    ],
  });
  await bootstrapOwner(
    db,
    { name: "Sample test owner", handle: ownerHandle, password: ownerPassword },
    outlet,
  );
  await bootstrapOwner(
    db,
    {
      name: "Other sample test owner",
      handle: `test.other.${run}`,
      password: ownerPassword,
    },
    otherOutlet,
  );
  await db.user.updateMany({
    where: { outletId: otherOutlet, role: "owner" },
    data: { developmentOnly: true },
  });
  ownerToken = (await login(ownerHandle, ownerPassword)).data.token;
  otherOwnerToken = (await login(`test.other.${run}`, ownerPassword)).data
    .token;
});
beforeEach(async () => {
  for (const scope of ["login", "invitation"]) {
    const key = hash(`${scope}:ip:${ip}`);
    keys.add(key);
    await db.authThrottle.deleteMany({ where: { key } });
  }
});
after(async () => {
  try {
    if (db) {
      const users = await db.user.findMany({
        where: { outletId: { in: [outlet, otherOutlet] } },
        select: { id: true },
      });
      for (const u of users) {
        keys.add(hash(`password:ip:${u.id}`));
        keys.add(hash(`password:identity:${u.id}`));
      }
      await db.$transaction(async (tx) => {
        const assignments = await tx.deliveryAssignment.findMany({
          where: { orderId: { in: fixtureOrders } },
          select: { id: true },
        });
        await tx.assignmentEvent.deleteMany({
          where: { assignmentId: { in: assignments.map((a) => a.id) } },
        });
        await tx.deliveryAssignment.deleteMany({
          where: { orderId: { in: fixtureOrders } },
        });
        await tx.orderEvent.deleteMany({
          where: { orderId: { in: fixtureOrders } },
        });
        await tx.order.deleteMany({ where: { id: { in: fixtureOrders } } });
        await tx.outboxEvent.deleteMany({
          where: { outletId: { in: [outlet, otherOutlet] } },
        });
        await tx.auditEvent.deleteMany({
          where: { outletId: { in: [outlet, otherOutlet] } },
        });
        await tx.invitation.deleteMany({
          where: { outletId: { in: [outlet, otherOutlet] } },
        });
        await tx.session.deleteMany({
          where: { userId: { in: users.map((u) => u.id) } },
        });
        await tx.credential.deleteMany({
          where: { userId: { in: users.map((u) => u.id) } },
        });
        await tx.user.deleteMany({
          where: { outletId: { in: [outlet, otherOutlet] } },
        });
        await tx.outlet.deleteMany({
          where: { id: { in: [outlet, otherOutlet] } },
        });
        await tx.authThrottle.deleteMany({ where: { key: { in: [...keys] } } });
      });
    }
  } finally {
    if (app) await app.close();
  }
});
test("owner bootstrap closes after first owner; password sign-in works with development disabled", async () => {
  await assert.rejects(
    () =>
      bootstrapOwner(
        db,
        {
          name: "Duplicate sample owner",
          handle: `test.duplicate.${run}`,
          password: secret(),
        },
        outlet,
      ),
    /already exists/,
  );
  const signed = await login(ownerHandle, ownerPassword, "owner");
  assert.equal(signed.status, 201);
  assert.equal(signed.data.user.role, "owner");
  assert.ok(!JSON.stringify(signed.data).includes("passwordHash"));
  const development = await call("/auth/development", "POST", {
    identity: "counter",
  });
  assert.equal(development.status, 201);
  const previous = process.env.DEV_ADAPTERS;
  process.env.DEV_ADAPTERS = "false";
  try {
    assert.equal(
      (await call("/me", "GET", undefined, development.data.token)).status,
      401,
    );
    assert.equal(
      (await call("/me", "GET", undefined, signed.data.token)).status,
      200,
    );
    assert.equal((await login(ownerHandle, ownerPassword)).status, 201);
  } finally {
    process.env.DEV_ADAPTERS = previous;
  }
  await call("/session", "DELETE", undefined, development.data.token);
  assert.equal((await login(ownerHandle, "wrong passphrase")).status, 401);
  assert.equal((await login(ownerHandle, ownerPassword, "rider")).status, 401);
});
test("owner-only invitation is single use; expiry, revocation and concurrent acceptance are enforced", async () => {
  const invitation = await invite(worker.handle);
  assert.equal(invitation.token.length, 64);
  const accepted = await call("/auth/accept-invitation", "POST", {
    token: invitation.token,
    password: worker.password,
    audience: "employee",
  });
  assert.equal(accepted.status, 201);
  worker.id = accepted.data.user.id;
  worker.token = accepted.data.token;
  assert.equal(
    (
      await call("/auth/accept-invitation", "POST", {
        token: invitation.token,
        password: secret(),
        audience: "employee",
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/team", "GET", undefined, worker.token)).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/team/invitations",
        "POST",
        { name: "Escalation", handle: `test.bad.${run}`, role: "owner" },
        worker.token,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/team/invitations",
        "POST",
        { name: "Escalation", handle: `test.bad.${run}`, role: "owner" },
        ownerToken,
      )
    ).status,
    400,
  );
  const expired = await invite(`test.expired.${run}`);
  await db.invitation.update({
    where: { id: expired.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(
    (
      await call("/auth/accept-invitation", "POST", {
        token: expired.token,
        password: secret(),
        audience: "employee",
      })
    ).status,
    400,
  );
  const revoked = await invite(`test.revoked.${run}`);
  assert.equal(
    (
      await call(
        `/team/invitations/${revoked.id}`,
        "DELETE",
        undefined,
        ownerToken,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/auth/accept-invitation", "POST", {
        token: revoked.token,
        password: secret(),
        audience: "employee",
      })
    ).status,
    400,
  );
  const raced = await invite(`test.race.${run}`);
  const password = secret();
  const results = await Promise.all(
    [1, 2].map(() =>
      call("/auth/accept-invitation", "POST", {
        token: raced.token,
        password,
        audience: "employee",
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const team = await call("/team", "GET", undefined, ownerToken);
  assert.ok(!JSON.stringify(team.data).includes("passwordHash"));
  const pending = await call("/team/invitations", "GET", undefined, ownerToken);
  assert.ok(!JSON.stringify(pending.data).includes("tokenHash"));
  assert.ok(!JSON.stringify(pending.data).includes(invitation.token));
});
test("password change and owner recovery revoke old sessions and pending reset tokens", async () => {
  const session = await login(worker.handle, worker.password);
  assert.equal(session.status, 201);
  const old = worker.password;
  const reset = await call(
    `/team/${worker.id}/recovery-invitation`,
    "POST",
    {},
    ownerToken,
  );
  assert.equal(reset.status, 201);
  assert.equal(
    (
      await call(
        "/auth/password",
        "POST",
        { currentPassword: "wrong password", password: secret() },
        session.data.token,
      )
    ).status,
    401,
  );
  worker.password = secret();
  const changed = await call(
    "/auth/password",
    "POST",
    { currentPassword: old, password: worker.password },
    session.data.token,
  );
  assert.equal(changed.status, 201);
  worker.token = changed.data.token;
  assert.equal(
    (await call("/me", "GET", undefined, session.data.token)).status,
    401,
  );
  assert.equal((await call("/me", "GET", undefined, worker.token)).status, 200);
  assert.equal((await login(worker.handle, old)).status, 401);
  assert.equal(
    (
      await call("/auth/accept-invitation", "POST", {
        token: reset.data.token,
        password: secret(),
        audience: "employee",
      })
    ).status,
    400,
  );
  const recovery = await call(
    `/team/${worker.id}/recovery-invitation`,
    "POST",
    {},
    ownerToken,
  );
  assert.equal(recovery.status, 201);
  const before = worker.token;
  worker.password = secret();
  const recovered = await call("/auth/accept-invitation", "POST", {
    token: recovery.data.token,
    password: worker.password,
    audience: "employee",
  });
  assert.equal(recovered.status, 201);
  worker.token = recovered.data.token;
  assert.equal((await call("/me", "GET", undefined, before)).status, 401);
  assert.equal(recovered.data.user.role, "counter");
});
test("session revocation is private; logout-all invalidates every current token", async () => {
  const a = await login(worker.handle, worker.password),
    b = await login(worker.handle, worker.password);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  const list = await call("/auth/sessions", "GET", undefined, a.data.token);
  assert.equal(list.status, 200);
  assert.ok(!JSON.stringify(list.data).includes("tokenHash"));
  assert.equal(
    list.data.filter((s: { current: boolean }) => s.current).length,
    1,
  );
  const other = await call("/auth/sessions", "GET", undefined, b.data.token);
  const id = other.data.find((s: { current: boolean }) => s.current).id;
  assert.equal(
    (await call(`/auth/sessions/${id}`, "DELETE", undefined, ownerToken))
      .status,
    404,
  );
  assert.equal(
    (await call(`/auth/sessions/${id}`, "DELETE", undefined, a.data.token))
      .status,
    200,
  );
  assert.equal((await call("/me", "GET", undefined, b.data.token)).status, 401);
  assert.equal(
    (await call("/auth/logout-all", "POST", {}, a.data.token)).status,
    201,
  );
  assert.equal((await call("/me", "GET", undefined, a.data.token)).status, 401);
  assert.equal((await call("/me", "GET", undefined, worker.token)).status, 401);
});
test("suspension immediately denies sessions; another outlet cannot administer the account", async () => {
  const session = await login(worker.handle, worker.password);
  assert.equal(session.status, 201);
  assert.equal(
    (
      await call(
        `/team/${worker.id}/status`,
        "PATCH",
        { disabled: true },
        otherOwnerToken,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `/team/${worker.id}/recovery-invitation`,
        "POST",
        {},
        otherOwnerToken,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `/team/${worker.id}/status`,
        "PATCH",
        { disabled: true },
        ownerToken,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/me", "GET", undefined, session.data.token)).status,
    401,
  );
  assert.equal((await login(worker.handle, worker.password)).status, 401);
  assert.equal(
    (
      await call(
        `/team/${worker.id}/status`,
        "PATCH",
        { disabled: false },
        ownerToken,
      )
    ).status,
    200,
  );
  assert.equal((await login(worker.handle, worker.password)).status, 201);
  const owner = (await call("/me", "GET", undefined, ownerToken)).data;
  assert.equal(
    (
      await call(
        `/team/${owner.id}/status`,
        "PATCH",
        { disabled: true },
        ownerToken,
      )
    ).status,
    404,
  );
});
test("assignment racing with suspension cannot strand a job on a disabled rider", async () => {
  const rider = await db.user.create({
      data: {
        outletId: outlet,
        name: "Sample race rider",
        role: "rider",
        riderAvailable: true,
      },
    }),
    customer = await db.user.create({
      data: {
        outletId: outlet,
        name: "Sample account test customer",
        role: "customer",
      },
    });
  const order = await db.order.create({
    data: {
      outletId: outlet,
      customerId: customer.id,
      idempotencyKey: randomUUID(),
      requestHash: "account-test",
      fulfilment: "delivery",
      status: "ready",
      paymentStatus: "paid",
      subtotalPaise: 100,
      taxPaise: 0,
      deliveryPaise: 0,
      totalPaise: 100,
    },
  });
  fixtureOrders.push(order.id);
  const [assignment, suspension] = await Promise.all([
    call(
      `/orders/${order.id}/assignment`,
      "POST",
      { riderId: rider.id, version: order.version },
      ownerToken,
    ),
    call(`/team/${rider.id}/status`, "PATCH", { disabled: true }, ownerToken),
  ]);
  if (assignment.status === 201) {
    assert.equal(
      (
        await db.deliveryAssignment.findUniqueOrThrow({
          where: { id: assignment.data.id },
        })
      ).status,
      "unassigned",
    );
  } else {
    assert.equal(assignment.status, 409);
  }
  assert.equal(suspension.status, 200);
  assert.ok(
    (await db.user.findUniqueOrThrow({ where: { id: rider.id } })).disabledAt,
  );
  assert.equal(
    await db.deliveryAssignment.count({
      where: { orderId: order.id, isActive: true },
    }),
    0,
  );
});
test("suspension revokes an active rider and moves picked-up orders to staff review without refunding", async () => {
  const rider = await db.user.create({
      data: {
        outletId: outlet,
        name: "Sample suspended delivery rider",
        role: "rider",
        riderAvailable: true,
      },
    }),
    customer = await db.user.create({
      data: {
        outletId: outlet,
        name: "Sample suspended delivery customer",
        role: "customer",
      },
    });
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      userId: rider.id,
      tokenHash: hash(token),
      authMethod: "password",
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  const order = await db.order.create({
    data: {
      outletId: outlet,
      customerId: customer.id,
      idempotencyKey: randomUUID(),
      requestHash: "suspension-test",
      fulfilment: "delivery",
      status: "ready",
      paymentStatus: "paid",
      subtotalPaise: 100,
      taxPaise: 0,
      deliveryPaise: 0,
      totalPaise: 100,
    },
  });
  fixtureOrders.push(order.id);
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
        token,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await call(
        `/team/${rider.id}/status`,
        "PATCH",
        { disabled: true },
        ownerToken,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/rider/tasks", "GET", undefined, token)).status,
    401,
  );
  const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } }),
    assignment = await db.deliveryAssignment.findUniqueOrThrow({
      where: { id: assigned.data.id },
    });
  assert.equal(saved.status, "delivery_failed");
  assert.equal(saved.paymentStatus, "paid");
  assert.equal(assignment.status, "failed");
  assert.equal(assignment.isActive, true);
  assert.equal(assignment.otpHash, null);
  assert.equal(
    (
      await call(
        `/assignments/${assignment.id}/staff-actions`,
        "POST",
        { action: "confirm_return", version: assignment.version },
        ownerToken,
      )
    ).status,
    201,
  );
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    "ready",
  );
});
test("development-owned invitations and password accounts remain disabled outside development mode", async () => {
  const handle = `test.devonly.${run}`,
    password = secret();
  const invite = await call(
    "/team/invitations",
    "POST",
    { name: "Sample development teammate", handle, role: "counter" },
    otherOwnerToken,
  );
  assert.equal(invite.status, 201);
  assert.equal(invite.data.developmentOnly, true);
  const accepted = await call("/auth/accept-invitation", "POST", {
    token: invite.data.token,
    password,
    audience: "employee",
  });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.data.user.developmentOnly, true);
  const pending = await call(
    "/team/invitations",
    "POST",
    {
      name: "Sample pending teammate",
      handle: `test.pending.${run}`,
      role: "counter",
    },
    otherOwnerToken,
  );
  assert.equal(pending.status, 201);
  const previous = process.env.DEV_ADAPTERS;
  process.env.DEV_ADAPTERS = "false";
  try {
    assert.equal((await login(handle, password)).status, 401);
    assert.equal(
      (await call("/me", "GET", undefined, accepted.data.token)).status,
      401,
    );
    assert.equal(
      (
        await call("/auth/accept-invitation", "POST", {
          token: pending.data.token,
          password: secret(),
          audience: "employee",
        })
      ).status,
      400,
    );
    assert.equal((await login(ownerHandle, ownerPassword)).status, 201);
  } finally {
    process.env.DEV_ADAPTERS = previous;
  }
});
test("a request captured before rider suspension cannot restore availability", async () => {
  const rider = await db.user.create({
    data: {
      outletId: outlet,
      name: "Sample stale-session rider",
      role: "rider",
    },
  });
  assert.equal(
    (
      await call(
        `/team/${rider.id}/status`,
        "PATCH",
        { disabled: true },
        ownerToken,
      )
    ).status,
    200,
  );
  await assert.rejects(
    () =>
      app.get(Delivery).availability(
        {
          id: rider.id,
          outletId: outlet,
          name: rider.name,
          role: "rider",
          authVersion: rider.authVersion,
        },
        { available: true },
      ),
    /Account changed/,
  );
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: rider.id } }))
      .riderAvailable,
    false,
  );
});
test("unknown handles use generic failures and the throttle cannot be bypassed with forwarded headers", async () => {
  const handle = `test.unknown.${run}`;
  for (let i = 0; i < 8; i++)
    assert.equal((await login(handle, "wrong password")).status, 401);
  const blocked = await call(
    "/auth/login",
    "POST",
    { handle, password: "wrong password", audience: "employee" },
    undefined,
    { "X-Forwarded-For": "198.51.100.42" },
  );
  assert.equal(blocked.status, 429);
});
