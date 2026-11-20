import "reflect-metadata";
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
let app: INestApplication, db: Database, base: string;
const ids: string[] = [],
  tokens: string[] = [];
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  key?: string,
) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, data: await response.json() };
}
async function login(identity: string) {
  const response = await call("/auth/development", "POST", { identity });
  assert.equal(response.status, 201);
  tokens.push(response.data.token);
  return response.data.token as string;
}
before(async () => {
  assert.equal(
    process.env.NODE_ENV,
    "development",
    "Integration tests require a dedicated development database",
  );
  assert.equal(process.env.DEV_ADAPTERS, "true");
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
});
after(async () => {
  if (db) {
    try {
      await db.$transaction(async (tx) => {
        const assignments = await tx.deliveryAssignment.findMany({
          where: { orderId: { in: ids } },
          select: { id: true },
        });
        await tx.assignmentEvent.deleteMany({
          where: { assignmentId: { in: assignments.map((a) => a.id) } },
        });
        await tx.deliveryAssignment.deleteMany({
          where: { orderId: { in: ids } },
        });
        await tx.paymentEvent.deleteMany({ where: { orderId: { in: ids } } });
        await tx.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });
        await tx.order.deleteMany({ where: { id: { in: ids } } });
        await tx.outboxEvent.deleteMany({ where: { resourceId: { in: ids } } });
        await tx.auditEvent.deleteMany({ where: { resourceId: { in: ids } } });
      });
      for (const token of tokens)
        await call("/session", "DELETE", undefined, token);
    } finally {
      if (app) await app.close();
    }
  } else if (app) await app.close();
});

const deliveryBody = {
  fulfilment: "delivery",
  items: [{ productId: "chicken-biryani", quantity: 1 }],
  deliveryAddress: {
    recipient: "Test recipient",
    phone: "9000000000",
    line1: "Sample test address only",
    city: "Sample city",
    postalCode: "000000",
    landmark: "Development fixture",
  },
};
async function readyDelivery(customer: string, counter: string) {
  const created = await call(
    "/orders",
    "POST",
    deliveryBody,
    customer,
    randomUUID(),
  );
  assert.equal(created.status, 201);
  ids.push(created.data.id);
  let order = created.data;
  order = (
    await call(
      `/orders/${order.id}/development-payment`,
      "POST",
      { eventId: randomUUID() },
      customer,
    )
  ).data;
  for (const action of ["accept", "prepare", "ready"]) {
    const r = await call(
      `/orders/${order.id}/actions`,
      "POST",
      { action, version: order.version },
      counter,
    );
    assert.equal(r.status, 201);
    order = r.data;
  }
  return order;
}
test("delivery assignment race, rider isolation, expiring codes and verified completion", async () => {
  const customer = await login("customer"),
    otherCustomer = await login("customer2"),
    counter = await login("counter"),
    kitchen = await login("kitchen"),
    rider = await login("rider"),
    rider2 = await login("rider2");
  const previous = await db.user.findMany({
    where: { id: { in: ["dev-rider", "dev-rider2"] } },
    select: { id: true, riderAvailable: true },
  });
  try {
    assert.equal(
      (
        await call(
          "/orders",
          "POST",
          {
            ...deliveryBody,
            deliveryAddress: {
              ...deliveryBody.deliveryAddress,
              postalCode: "111111",
            },
          },
          customer,
          randomUUID(),
        )
      ).status,
      409,
    );
    const order = await readyDelivery(customer, counter);
    assert.equal(order.deliveryPaise, 2000);
    assert.equal(order.totalPaise, 31900);
    assert.equal((await call("/riders", "GET", undefined, rider)).status, 403);
    await call("/rider/availability", "PATCH", { available: false }, rider);
    assert.equal(
      (
        await call(
          `/orders/${order.id}/assignment`,
          "POST",
          { riderId: "dev-rider", version: order.version },
          counter,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          `/orders/${order.id}/assignment`,
          "POST",
          { riderId: "dev-rider", version: order.version },
          kitchen,
        )
      ).status,
      403,
    );
    for (const token of [rider, rider2])
      assert.equal(
        (await call("/rider/availability", "PATCH", { available: true }, token))
          .status,
        200,
      );
    const raced = await Promise.all(
      ["dev-rider", "dev-rider2"].map((riderId) =>
        call(
          `/orders/${order.id}/assignment`,
          "POST",
          { riderId, version: order.version },
          counter,
        ),
      ),
    );
    assert.deepEqual(raced.map((r) => r.status).sort(), [201, 409]);
    const assigned = raced.find((r) => r.status === 201)!.data;
    const own = assigned.riderId === "dev-rider" ? rider : rider2,
      other = own === rider ? rider2 : rider;
    assert.equal(
      (
        await call(
          `/rider/tasks/${assigned.id}/actions`,
          "POST",
          { action: "pickup", version: assigned.version },
          other,
        )
      ).status,
      404,
    );
    assert.ok(
      !(await call("/rider/tasks", "GET", undefined, other)).data.tasks.some(
        (t: { id: string }) => t.id === assigned.id,
      ),
    );
    assert.equal(
      (await call(`/orders/${order.id}/delivery-code`, "POST", {}, customer))
        .status,
      404,
    );
    assert.equal(
      (
        await call(
          `/rider/tasks/${assigned.id}/actions`,
          "POST",
          { action: "pickup", version: assigned.version },
          own,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await call(
          `/orders/${order.id}/delivery-code`,
          "POST",
          {},
          otherCustomer,
        )
      ).status,
      404,
    );
    assert.equal(
      (await call(`/orders/${order.id}/delivery-code`, "POST", {}, counter))
        .status,
      403,
    );
    let issued = await call(
      `/orders/${order.id}/delivery-code`,
      "POST",
      {},
      customer,
    );
    assert.equal(issued.status, 201);
    assert.match(issued.data.code, /^\d{6}$/);
    let tasks = await call("/rider/tasks", "GET", undefined, own);
    let task = tasks.data.tasks.find(
      (t: { id: string }) => t.id === assigned.id,
    );
    assert.equal(task.order.deliveryAddress.phone, "9000000000");
    assert.ok(!JSON.stringify(tasks.data).includes("otpHash"));
    assert.ok(!JSON.stringify(tasks.data).includes('"code":'));
    await db.deliveryAssignment.update({
      where: { id: assigned.id },
      data: {
        otpExpiresAt: new Date(Date.now() - 1000),
        otpIssuedAt: new Date(Date.now() - 61000),
      },
    });
    assert.equal(
      (
        await call(
          `/rider/tasks/${assigned.id}/complete`,
          "POST",
          { code: issued.data.code, version: task.version },
          own,
        )
      ).status,
      409,
    );
    issued = await call(
      `/orders/${order.id}/delivery-code`,
      "POST",
      {},
      customer,
    );
    assert.equal(issued.status, 201);
    assert.equal(
      (await call(`/orders/${order.id}/delivery-code`, "POST", {}, customer))
        .status,
      409,
    );
    task = (await call("/rider/tasks", "GET", undefined, own)).data.tasks.find(
      (t: { id: string }) => t.id === assigned.id,
    );
    const wrong = issued.data.code === "111111" ? "222222" : "111111";
    assert.equal(
      (
        await call(
          `/rider/tasks/${assigned.id}/complete`,
          "POST",
          { code: wrong, version: task.version },
          own,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await db.deliveryAssignment.findUniqueOrThrow({
          where: { id: assigned.id },
        })
      ).otpAttempts,
      1,
    );
    task = (await call("/rider/tasks", "GET", undefined, own)).data.tasks.find(
      (t: { id: string }) => t.id === assigned.id,
    );
    assert.equal(
      (
        await call(
          `/rider/tasks/${assigned.id}/complete`,
          "POST",
          { code: issued.data.code, version: task.version },
          own,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await call(
          `/rider/tasks/${assigned.id}/complete`,
          "POST",
          { code: issued.data.code, version: task.version },
          own,
        )
      ).status,
      409,
    );
    task = (await call("/rider/tasks", "GET", undefined, own)).data.tasks.find(
      (t: { id: string }) => t.id === assigned.id,
    );
    assert.equal(task.status, "delivered");
    assert.equal(task.order.deliveryAddress, null);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
      "delivered",
    );
  } finally {
    for (const user of previous)
      await db.user.update({
        where: { id: user.id },
        data: { riderAvailable: user.riderAvailable },
      });
  }
});

test("failed delivery retains payment, requires physical return, and preserves assignment history", async () => {
  const customer = await login("customer"),
    counter = await login("counter"),
    rider = await login("rider");
  const previous = (
    await db.user.findUniqueOrThrow({ where: { id: "dev-rider" } })
  ).riderAvailable;
  try {
    await call("/rider/availability", "PATCH", { available: true }, rider);
    let order = await readyDelivery(customer, counter);
    let a = (
      await call(
        `/orders/${order.id}/assignment`,
        "POST",
        { riderId: "dev-rider", version: order.version },
        counter,
      )
    ).data;
    assert.equal(
      (
        await call(
          `/rider/tasks/${a.id}/actions`,
          "POST",
          { action: "pickup", version: a.version },
          rider,
        )
      ).status,
      201,
    );
    a = (await call("/rider/tasks", "GET", undefined, rider)).data.tasks.find(
      (t: { id: string }) => t.id === a.id,
    );
    assert.equal(
      (
        await call(
          `/rider/tasks/${a.id}/actions`,
          "POST",
          { action: "fail", version: a.version },
          rider,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          `/rider/tasks/${a.id}/actions`,
          "POST",
          {
            action: "fail",
            version: a.version,
            reason: "Customer unavailable",
          },
          rider,
        )
      ).status,
      201,
    );
    order = (await call("/orders", "GET", undefined, counter)).data.find(
      (o: { id: string }) => o.id === order.id,
    );
    assert.equal(order.status, "delivery_failed");
    assert.equal(order.paymentStatus, "paid");
    assert.equal(
      (
        await call(
          `/orders/${order.id}/assignment`,
          "POST",
          { riderId: "dev-rider", version: order.version },
          counter,
        )
      ).status,
      409,
    );
    a = (await call("/rider/tasks", "GET", undefined, rider)).data.tasks.find(
      (t: { id: string }) => t.id === a.id,
    );
    assert.equal(a.order.deliveryAddress, null);
    assert.equal(
      (
        await call(
          `/assignments/${a.id}/staff-actions`,
          "POST",
          { action: "confirm_return", version: a.version },
          counter,
        )
      ).status,
      201,
    );
    order = (await call("/orders", "GET", undefined, counter)).data.find(
      (o: { id: string }) => o.id === order.id,
    );
    assert.equal(order.status, "ready");
    const replacement = await call(
      `/orders/${order.id}/assignment`,
      "POST",
      { riderId: "dev-rider", version: order.version },
      counter,
    );
    assert.equal(replacement.status, 201);
    assert.notEqual(replacement.data.id, a.id);
    assert.equal(
      await db.deliveryAssignment.count({ where: { orderId: order.id } }),
      2,
    );
    assert.equal(
      await db.deliveryAssignment.count({
        where: { orderId: order.id, isActive: true },
      }),
      1,
    );
  } finally {
    await db.user.update({
      where: { id: "dev-rider" },
      data: { riderAvailable: previous },
    });
  }
});

test("delivery OTP locks after five incorrect guesses without resetting on renewal", async () => {
  const customer = await login("customer"),
    counter = await login("counter"),
    rider = await login("rider");
  const previous = (
    await db.user.findUniqueOrThrow({ where: { id: "dev-rider" } })
  ).riderAvailable;
  try {
    await call("/rider/availability", "PATCH", { available: true }, rider);
    const order = await readyDelivery(customer, counter);
    const a = (
      await call(
        `/orders/${order.id}/assignment`,
        "POST",
        { riderId: "dev-rider", version: order.version },
        counter,
      )
    ).data;
    await call(
      `/rider/tasks/${a.id}/actions`,
      "POST",
      { action: "pickup", version: a.version },
      rider,
    );
    const issued = await call(
      `/orders/${order.id}/delivery-code`,
      "POST",
      {},
      customer,
    );
    const wrong = issued.data.code === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) {
      const task = (
        await call("/rider/tasks", "GET", undefined, rider)
      ).data.tasks.find((t: { id: string }) => t.id === a.id);
      assert.equal(
        (
          await call(
            `/rider/tasks/${a.id}/complete`,
            "POST",
            { code: wrong, version: task.version },
            rider,
          )
        ).status,
        400,
      );
    }
    const task = (
      await call("/rider/tasks", "GET", undefined, rider)
    ).data.tasks.find((t: { id: string }) => t.id === a.id);
    assert.equal(
      (
        await call(
          `/rider/tasks/${a.id}/complete`,
          "POST",
          { code: issued.data.code, version: task.version },
          rider,
        )
      ).status,
      409,
    );
    assert.equal(
      (await call(`/orders/${order.id}/delivery-code`, "POST", {}, customer))
        .status,
      409,
    );
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
      "out_for_delivery",
    );
  } finally {
    await db.user.update({
      where: { id: "dev-rider" },
      data: { riderAvailable: previous },
    });
  }
});
test("persisted customer-to-counter journey, isolation, retries and concurrency", async () => {
  const customer = await login("customer"),
    other = await login("customer2"),
    counter = await login("counter"),
    kitchen = await login("kitchen"),
    rider = await login("rider");
  assert.equal((await call("/orders")).status, 401);
  assert.equal((await call("/orders", "GET", undefined, rider)).status, 403);
  assert.equal(
    (await call("/outlet", "PATCH", { paused: true }, counter)).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/menu/chicken-biryani",
        "PATCH",
        { available: false },
        customer,
      )
    ).status,
    403,
  );
  const key = randomUUID(),
    body = {
      fulfilment: "pickup",
      items: [{ productId: "chicken-biryani", quantity: 2 }],
    };
  assert.equal(
    (
      await call(
        "/orders",
        "POST",
        { ...body, totalPaise: 1 },
        customer,
        randomUUID(),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/orders",
        "POST",
        { ...body, fulfilment: "delivery" },
        customer,
        randomUUID(),
      )
    ).status,
    400,
  );
  const created = await call("/orders", "POST", body, customer, key);
  assert.equal(created.status, 201);
  let order = created.data;
  ids.push(order.id);
  assert.equal(order.totalPaise, 59800);
  assert.equal(order.paymentStatus, "pending");
  assert.equal(
    (await call("/orders", "POST", body, customer, key)).data.id,
    order.id,
  );
  assert.equal(
    (
      await call(
        "/orders",
        "POST",
        { ...body, items: [{ productId: "chicken-biryani", quantity: 1 }] },
        customer,
        key,
      )
    ).status,
    409,
  );
  assert.ok(
    !(await call("/orders", "GET", undefined, other)).data.some(
      (o: { id: string }) => o.id === order.id,
    ),
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/actions`,
        "POST",
        { action: "accept", version: order.version },
        counter,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/development-payment`,
        "POST",
        { eventId: randomUUID() },
        other,
      )
    ).status,
    404,
  );
  const eventId = randomUUID();
  const payment = await call(
    `/orders/${order.id}/development-payment`,
    "POST",
    { eventId },
    customer,
  );
  assert.equal(payment.status, 201);
  order = payment.data;
  assert.equal(
    (
      await call(
        `/orders/${order.id}/development-payment`,
        "POST",
        { eventId },
        customer,
      )
    ).status,
    201,
  );
  assert.equal(
    await db.paymentEvent.count({ where: { orderId: order.id } }),
    1,
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/actions`,
        "POST",
        { action: "accept", version: order.version },
        kitchen,
      )
    ).status,
    403,
  );
  const attempts = await Promise.all(
    [1, 2].map(() =>
      call(
        `/orders/${order.id}/actions`,
        "POST",
        { action: "accept", version: order.version },
        counter,
      ),
    ),
  );
  assert.deepEqual(attempts.map((r) => r.status).sort(), [201, 409]);
  order = attempts.find((r) => r.status === 201)!.data;
  assert.equal(
    (
      await call(
        `/orders/${order.id}/actions`,
        "POST",
        { action: "ready", version: order.version },
        kitchen,
      )
    ).status,
    409,
  );
  for (const action of ["prepare", "ready", "collect"]) {
    const response = await call(
      `/orders/${order.id}/actions`,
      "POST",
      { action, version: order.version },
      action === "collect" ? counter : kitchen,
    );
    assert.equal(response.status, 201);
    order = response.data;
  }
  assert.equal(order.status, "collected");
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    "collected",
  );
  assert.equal(
    await db.orderEvent.count({
      where: { orderId: order.id, action: "accept" },
    }),
    1,
  );
  assert.equal(
    await db.outboxEvent.count({
      where: { resourceId: order.id, kind: "order.paid" },
    }),
    1,
  );
});
test("development identity and payment endpoints fail closed when disabled", async () => {
  const customer = await login("customer");
  const pending = await call(
    "/orders",
    "POST",
    {
      fulfilment: "pickup",
      items: [{ productId: "chicken-biryani", quantity: 1 }],
    },
    customer,
    randomUUID(),
  );
  assert.equal(pending.status, 201);
  ids.push(pending.data.id);
  const verificationSecret = process.env.DELIVERY_OTP_SECRET;
  delete process.env.DELIVERY_OTP_SECRET;
  try {
    assert.equal(
      (await call("/orders", "POST", deliveryBody, customer, randomUUID()))
        .status,
      503,
    );
  } finally {
    process.env.DELIVERY_OTP_SECRET = verificationSecret;
  }
  const previous = process.env.DEV_ADAPTERS;
  process.env.DEV_ADAPTERS = "false";
  try {
    assert.equal(
      (await call("/auth/development", "POST", { identity: "owner" })).status,
      503,
    );
    assert.equal(
      (
        await call(
          `/orders/${pending.data.id}/development-payment`,
          "POST",
          { eventId: randomUUID() },
          customer,
        )
      ).status,
      401,
    );
    assert.equal(
      (await call("/orders", "POST", deliveryBody, customer, randomUUID()))
        .status,
      401,
    );
  } finally {
    process.env.DEV_ADAPTERS = previous;
  }
});
