import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { Payments } from "../src/payments/payments";
import { RazorpayProvider, SimulatedProvider } from "../src/payments/providers";
import { hash } from "../src/auth";
import { validateRuntime } from "../src/runtime";

const id = randomUUID(),
  outlet = "pay-test-" + id;
const KEY_ID = "rzp_test_key",
  KEY_SECRET = "test-key-secret-0123456789",
  WH_SECRET = "test-webhook-secret-0123456789";
let app: any, db: Database, payments: Payments, base: string;
const tokens: Record<string, string> = {},
  users: Record<string, any> = {};
const realFetch = globalThis.fetch;

// A tiny fake of Razorpay's API, so no real network or account is needed.
const rz = {
  orders: new Map<string, { amount: number; payments: any[] }>(),
  refundCalls: [] as any[],
  failRefund: false,
  seq: 0,
  badAuth: 0,
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
function installFakeRazorpay() {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(
      input instanceof URL ? input.href : (input?.url ?? input),
    );
    if (!url.startsWith("https://api.razorpay.com/v1"))
      return realFetch(input, init);
    const expected =
      "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
    if (init?.headers?.authorization !== expected) {
      rz.badAuth++;
      return json({ error: { description: "Authentication failed" } }, 401);
    }
    const path = url.slice("https://api.razorpay.com/v1".length);
    const method = init?.method ?? "GET";
    if (method === "POST" && path === "/orders") {
      const body = JSON.parse(init.body);
      const oid = `order_${++rz.seq}`;
      rz.orders.set(oid, { amount: body.amount, payments: [] });
      return json({ id: oid, amount: body.amount, status: "created" });
    }
    const list = /^\/orders\/([^/]+)\/payments$/.exec(path);
    if (method === "GET" && list)
      return json({ items: rz.orders.get(list[1])?.payments ?? [] });
    const refund = /^\/payments\/([^/]+)\/refund$/.exec(path);
    if (method === "POST" && refund) {
      const body = JSON.parse(init.body);
      rz.refundCalls.push({ payment: refund[1], ...body });
      if (rz.failRefund)
        return json({ error: { description: "Insufficient balance" } }, 400);
      return json({ id: `rfnd_${++rz.seq}`, status: "processed" });
    }
    return json({ error: { description: "not found" } }, 404);
  }) as any;
}
const capture = (orderId: string, paymentId: string, amount: number) =>
  rz.orders.get(orderId)!.payments.push({
    id: paymentId,
    status: "captured",
    amount,
    method: "upi",
  });

before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  process.env.PAYMENTS_SWEEP_DISABLED = "true";
  process.env.DISPATCH_DISABLED = "true";
  process.env.RAZORPAY_KEY_ID = KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WH_SECRET;
  process.env.PAYMENT_PROVIDER = "simulated";
  app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  payments = app.get(Payments);
  await db.outlet.create({ data: { id: outlet, name: "Payments fixture" } });
  for (const [key, role] of [
    ["customer", "customer"],
    ["other", "customer"],
    ["owner", "owner"],
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
  installFakeRazorpay();
});
after(async () => {
  globalThis.fetch = realFetch;
  if (db) {
    const orders = (
      await db.order.findMany({
        where: { outletId: outlet },
        select: { id: true },
      })
    ).map((o) => o.id);
    await db.refund.deleteMany({ where: { orderId: { in: orders } } });
    await db.payment.deleteMany({ where: { orderId: { in: orders } } });
    await db.paymentEvent.deleteMany({ where: { orderId: { in: orders } } });
    await db.orderEvent.deleteMany({ where: { orderId: { in: orders } } });
    await db.outboxEvent.deleteMany({ where: { outletId: outlet } });
    await db.auditEvent.deleteMany({ where: { outletId: outlet } });
    await db.webhookEvent.deleteMany({
      where: { id: { startsWith: "razorpay:evt-" + id } },
    });
    await db.order.deleteMany({ where: { outletId: outlet } });
    await db.session.deleteMany({ where: { user: { outletId: outlet } } });
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
  headers: Record<string, string> = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function newOrder(over: object = {}) {
  const key = randomUUID();
  return db.order.create({
    data: {
      outletId: outlet,
      customerId: users.customer.id,
      idempotencyKey: key,
      requestHash: key,
      fulfilment: "pickup",
      status: "awaiting_acceptance",
      paymentStatus: "pending",
      subtotalPaise: 31900,
      taxPaise: 0,
      deliveryPaise: 0,
      totalPaise: 31900,
      ...over,
    },
  });
}
const orderRow = (orderId: string) =>
  db.order.findUniqueOrThrow({ where: { id: orderId } });
let evt = 0;
function webhook(
  body: object,
  opts: { sig?: string | null; event?: string } = {},
) {
  const raw = JSON.stringify(body);
  const sig =
    opts.sig === undefined
      ? createHmac("sha256", WH_SECRET).update(raw).digest("hex")
      : opts.sig;
  return fetch(base + "/api/payments/webhook/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-event-id": opts.event ?? `evt-${id}-${++evt}`,
      ...(sig ? { "x-razorpay-signature": sig } : {}),
    },
    body: raw,
  }).then(async (r) => ({
    status: r.status,
    json: await r.json().catch(() => null),
  }));
}
const paidEvent = (orderId: string, paymentId: string, amount: number) => ({
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: paymentId,
        order_id: orderId,
        amount,
        method: "upi",
        status: "captured",
      },
    },
  },
});

test("the gateway signatures are checked exactly, over the exact bytes", () => {
  const p = new RazorpayProvider();
  const proof = (order: string, pay: string, secret = KEY_SECRET) =>
    createHmac("sha256", secret).update(`${order}|${pay}`).digest("hex");
  // Client proof: valid only for OUR stored order id and the right secret.
  assert.deepEqual(
    p.verifyClientResult({
      providerOrderId: "order_1",
      result: {
        razorpay_payment_id: "pay_1",
        razorpay_signature: proof("order_1", "pay_1"),
      },
    }),
    { providerPaymentId: "pay_1" },
  );
  for (const bad of [
    {
      razorpay_payment_id: "pay_2",
      razorpay_signature: proof("order_1", "pay_1"),
    },
    {
      razorpay_payment_id: "pay_1",
      razorpay_signature: proof("order_9", "pay_1"),
    },
    {
      razorpay_payment_id: "pay_1",
      razorpay_signature: proof("order_1", "pay_1", "other-secret"),
    },
    { razorpay_payment_id: "pay_1" },
    { razorpay_signature: "x" },
    {},
  ])
    assert.equal(
      p.verifyClientResult({ providerOrderId: "order_1", result: bad }),
      null,
    );
  // Webhook: HMAC of the raw body with the webhook secret (not the key secret).
  const raw = Buffer.from(
    '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1","order_id":"order_1","amount":100}}}}',
  );
  const good = createHmac("sha256", WH_SECRET).update(raw).digest("hex");
  const ev = p.parseWebhook(raw, {
    "x-razorpay-signature": good,
    "x-razorpay-event-id": "e1",
  });
  assert.equal(ev?.type, "payment.paid");
  assert.equal(ev?.providerOrderId, "order_1");
  assert.equal(ev?.amountPaise, 100);
  assert.throws(
    () =>
      p.parseWebhook(raw, {
        "x-razorpay-signature": createHmac("sha256", KEY_SECRET)
          .update(raw)
          .digest("hex"),
      }),
    /signature/i,
  );
  assert.throws(() => p.parseWebhook(raw, {}), /signature/i);
  const reformatted = Buffer.from(
    JSON.stringify(JSON.parse(raw.toString()), null, 2),
  );
  assert.throws(
    () => p.parseWebhook(reformatted, { "x-razorpay-signature": good }),
    /signature/i,
    "re-serialised bytes do not match",
  );
  // Unrelated events are ignored, not errors.
  const other = Buffer.from('{"event":"payout.pending","payload":{}}');
  assert.equal(
    p.parseWebhook(other, {
      "x-razorpay-signature": createHmac("sha256", WH_SECRET)
        .update(other)
        .digest("hex"),
    }),
    null,
  );
  assert.equal(new SimulatedProvider().parseWebhook(), null);
});

test("simulated payments: amount is the server's, retries work, success marks the order paid once", async () => {
  process.env.PAYMENT_PROVIDER = "simulated";
  const order = await newOrder();
  const cfg = await call("GET", "/api/payments/config", "customer");
  assert.deepEqual(
    [cfg.json.provider, cfg.json.simulated],
    ["simulated", true],
  );
  assert.equal(
    (await call("GET", "/api/payments/config", "owner")).status,
    403,
  );
  const s1 = await call(
    "POST",
    `/api/orders/${order.id}/payments`,
    "customer",
    { amountPaise: 1 },
  );
  assert.equal(
    s1.status,
    201,
    "extra input is ignored; the amount comes from the order",
  );
  assert.equal(s1.json.amountPaise, 31900);
  assert.equal(s1.json.clientParams.simulated, true);
  const again = await call(
    "POST",
    `/api/orders/${order.id}/payments`,
    "customer",
  );
  assert.equal(
    again.json.paymentId,
    s1.json.paymentId,
    "a live session is reused",
  );
  assert.equal(
    (await call("POST", `/api/orders/${order.id}/payments`, "other")).status,
    404,
  );
  assert.equal(
    (await call("POST", `/api/orders/${order.id}/payments`, "owner")).status,
    403,
  );
  const waiting = await call(
    "GET",
    `/api/orders/${order.id}/payment`,
    "customer",
  );
  assert.equal(waiting.json.payment.status, "created");
  assert.equal(waiting.json.canRetry, false, "a live session is still open");
  assert.equal(
    (
      await call(
        "POST",
        `/api/payments/${s1.json.paymentId}/confirm`,
        "customer",
        {},
      )
    ).json.orderPaymentStatus,
    "pending",
    "asking does not make it paid",
  );
  const failed = await call(
    "POST",
    `/api/payments/${s1.json.paymentId}/simulate`,
    "customer",
    { outcome: "failure" },
  );
  assert.equal(failed.json.payment.status, "failed");
  assert.equal(failed.json.canRetry, true);
  const s2 = await call("POST", `/api/orders/${order.id}/payments`, "customer");
  assert.notEqual(
    s2.json.paymentId,
    s1.json.paymentId,
    "a failed attempt gets a fresh session",
  );
  const paid = await call(
    "POST",
    `/api/payments/${s2.json.paymentId}/simulate`,
    "customer",
    { outcome: "success" },
  );
  assert.equal(paid.json.orderPaymentStatus, "paid");
  assert.equal(paid.json.payment.status, "paid");
  const row = await orderRow(order.id);
  assert.equal(row.paymentStatus, "paid");
  const again2 = await call(
    "POST",
    `/api/payments/${s2.json.paymentId}/simulate`,
    "customer",
    { outcome: "success" },
  );
  assert.equal(again2.json.orderPaymentStatus, "paid");
  assert.equal(
    await db.paymentEvent.count({ where: { orderId: order.id } }),
    1,
    "recorded once",
  );
  assert.equal(
    await db.outboxEvent.count({
      where: { resourceId: order.id, kind: "order.paid" },
    }),
    1,
  );
  assert.equal(
    (await call("POST", `/api/orders/${order.id}/payments`, "customer")).status,
    409,
    "already paid",
  );
  assert.equal(
    (
      await call(
        "POST",
        `/api/payments/${s2.json.paymentId}/simulate`,
        "other",
        { outcome: "success" },
      )
    ).status,
    404,
  );
});

test("attempts are capped and a wrong amount from the gateway is never accepted", async () => {
  process.env.PAYMENT_PROVIDER = "simulated";
  const order = await newOrder();
  for (let i = 0; i < 5; i++) {
    const s = await call(
      "POST",
      `/api/orders/${order.id}/payments`,
      "customer",
    );
    assert.equal(s.status, 201);
    await call(
      "POST",
      `/api/payments/${s.json.paymentId}/simulate`,
      "customer",
      { outcome: "failure" },
    );
  }
  assert.equal(
    (await call("POST", `/api/orders/${order.id}/payments`, "customer")).status,
    429,
  );
  const odd = await newOrder();
  const s = await call("POST", `/api/orders/${odd.id}/payments`, "customer");
  const outcome = await payments.settle(s.json.paymentId, {
    providerPaymentId: "pay_x",
    amountPaise: 100,
    method: "upi",
  });
  assert.equal(outcome, "mismatch");
  assert.equal(
    (await orderRow(odd.id)).paymentStatus,
    "pending",
    "order stays unpaid",
  );
  assert.equal(
    (await db.payment.findUniqueOrThrow({ where: { id: s.json.paymentId } }))
      .status,
    "mismatch",
  );
  assert.ok(
    await db.outboxEvent.findFirst({
      where: { resourceId: odd.id, kind: "payment.amount_mismatch" },
    }),
  );
  const rec = await call("GET", "/api/payments/reconcile", "owner");
  assert.ok(rec.json.amountMismatches.some((m: any) => m.orderId === odd.id));
  assert.equal(
    (await call("GET", "/api/payments/reconcile", "kitchen")).status,
    403,
  );
});

test("test payments are refused unless the build allows them; real ones need their keys", async () => {
  const order = await newOrder();
  const savedBeta = process.env.PISTA_BETA_MODE;
  process.env.PISTA_BETA_MODE = "false";
  try {
    assert.equal(
      (await call("GET", "/api/payments/config", "customer")).status,
      503,
    );
    assert.equal(
      (await call("POST", `/api/orders/${order.id}/payments`, "customer"))
        .status,
      503,
    );
  } finally {
    process.env.PISTA_BETA_MODE = savedBeta;
  }
  process.env.PAYMENT_PROVIDER = "razorpay";
  const key = process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_KEY_SECRET;
  assert.equal(
    (await call("GET", "/api/payments/config", "customer")).status,
    503,
    "missing secret",
  );
  process.env.RAZORPAY_KEY_SECRET = key;
  process.env.PAYMENT_PROVIDER = "nonsense";
  assert.equal(
    (await call("GET", "/api/payments/config", "customer")).status,
    503,
    "unknown provider",
  );
  process.env.PAYMENT_PROVIDER = "simulated";
  assert.equal(
    (await call("POST", "/api/payments/webhook/razorpay", null, {})).status,
    404,
    "webhook only for the active provider",
  );
});

test("with a real gateway: a session never carries secrets, and the signed webhook marks the order paid once", async () => {
  process.env.PAYMENT_PROVIDER = "razorpay";
  const order = await newOrder();
  const s = await call("POST", `/api/orders/${order.id}/payments`, "customer");
  assert.equal(s.status, 201, JSON.stringify(s.json));
  assert.equal(s.json.provider, "razorpay");
  assert.equal(s.json.clientParams.keyId, KEY_ID);
  assert.equal(s.json.clientParams.amountPaise, 31900);
  assert.ok(
    !JSON.stringify(s.json).includes(KEY_SECRET),
    "the secret never leaves the server",
  );
  assert.ok(!JSON.stringify(s.json).includes(WH_SECRET));
  assert.equal(rz.badAuth, 0);
  const orderId = s.json.clientParams.orderId as string;
  const reuse = await call(
    "POST",
    `/api/orders/${order.id}/payments`,
    "customer",
  );
  assert.equal(
    reuse.json.clientParams.orderId,
    orderId,
    "the same gateway order is reused",
  );
  // Missing / wrong signatures are rejected and change nothing.
  assert.equal(
    (await webhook(paidEvent(orderId, "pay_1", 31900), { sig: null })).status,
    401,
  );
  assert.equal(
    (
      await webhook(paidEvent(orderId, "pay_1", 31900), {
        sig: "00".repeat(32),
      })
    ).status,
    401,
  );
  assert.equal((await orderRow(order.id)).paymentStatus, "pending");
  // A failed attempt then a success on the same session still pays.
  await webhook({
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: "pay_0",
          order_id: orderId,
          error_code: "BAD_REQUEST_ERROR",
          error_description: "Card declined",
        },
      },
    },
  });
  const failed = await call(
    "GET",
    `/api/orders/${order.id}/payment`,
    "customer",
  );
  assert.equal(failed.json.payment.status, "failed");
  assert.equal(failed.json.payment.failureReason, "Card declined");
  const evId = `evt-${id}-paid`;
  const ok = await webhook(paidEvent(orderId, "pay_1", 31900), { event: evId });
  assert.equal(ok.status, 201);
  assert.equal((await orderRow(order.id)).paymentStatus, "paid");
  const replay = await webhook(paidEvent(orderId, "pay_1", 31900), {
    event: evId,
  });
  assert.equal(replay.json.duplicate, true, "a retried delivery is ignored");
  assert.equal(
    await db.paymentEvent.count({ where: { orderId: order.id } }),
    1,
  );
  assert.equal(
    await db.outboxEvent.count({
      where: { resourceId: order.id, kind: "order.paid" },
    }),
    1,
  );
  // Unrelated and unknown things do not error (the gateway would retry forever).
  assert.equal(
    (await webhook({ event: "payout.pending", payload: {} })).json.ignored,
    true,
  );
  assert.equal(
    (await webhook(paidEvent("order_unknown", "pay_9", 100))).status,
    201,
  );
});

test("the app's word is never enough: proof must verify AND the gateway must agree", async () => {
  process.env.PAYMENT_PROVIDER = "razorpay";
  const order = await newOrder();
  const s = await call("POST", `/api/orders/${order.id}/payments`, "customer");
  const orderId = s.json.clientParams.orderId as string;
  const proof = (pay: string) => ({
    razorpay_payment_id: pay,
    razorpay_signature: createHmac("sha256", KEY_SECRET)
      .update(`${orderId}|${pay}`)
      .digest("hex"),
  });
  const forged = await call(
    "POST",
    `/api/payments/${s.json.paymentId}/confirm`,
    "customer",
    {
      result: {
        razorpay_payment_id: "pay_fake",
        razorpay_signature: "00".repeat(32),
      },
    },
  );
  assert.equal(forged.status, 400);
  assert.ok(
    await db.auditEvent.findFirst({
      where: {
        resourceId: s.json.paymentId,
        action: "payment.client_proof_invalid",
      },
    }),
  );
  assert.equal((await orderRow(order.id)).paymentStatus, "pending");
  await new Promise((r) => setTimeout(r, 2100)); // the per-payment confirm throttle
  const claimed = await call(
    "POST",
    `/api/payments/${s.json.paymentId}/confirm`,
    "customer",
    { result: proof("pay_2") },
  );
  assert.equal(
    claimed.json.orderPaymentStatus,
    "pending",
    "a genuine proof alone does not pay: the gateway says nothing was captured",
  );
  capture(orderId, "pay_2", 31900);
  await new Promise((r) => setTimeout(r, 2100));
  const done = await call(
    "POST",
    `/api/payments/${s.json.paymentId}/confirm`,
    "customer",
    { result: proof("pay_2") },
  );
  assert.equal(done.json.orderPaymentStatus, "paid");
  assert.equal(done.json.payment.method, "upi");
});

test("a missed webhook is caught by the sweep, and unpaid orders are closed safely", async () => {
  process.env.PAYMENT_PROVIDER = "razorpay";
  const missed = await newOrder();
  const s = await call("POST", `/api/orders/${missed.id}/payments`, "customer");
  capture(s.json.clientParams.orderId, "pay_m", 31900);
  const swept = await payments.sweep();
  assert.ok(swept.checked >= 1);
  assert.equal(
    (await orderRow(missed.id)).paymentStatus,
    "paid",
    "found by asking the gateway",
  );
  // An abandoned order: old, no open payment.
  const abandoned = await newOrder({
    createdAt: new Date(Date.now() - 45 * 60000),
  });
  const a = await call(
    "POST",
    `/api/orders/${abandoned.id}/payments`,
    "customer",
  );
  await db.payment.update({
    where: { id: a.json.paymentId },
    data: { status: "expired", expiresAt: new Date(Date.now() - 60000) },
  });
  const result = await payments.sweep();
  assert.ok(result.cancelled >= 1);
  assert.equal((await orderRow(abandoned.id)).status, "rejected");
  const why = await db.orderEvent.findFirstOrThrow({
    where: { orderId: abandoned.id, action: "payment.timeout" },
  });
  assert.match(why.reason ?? "", /not completed/);
  // A fresh order is left alone.
  const fresh = await newOrder();
  await payments.sweep();
  assert.equal((await orderRow(fresh.id)).status, "awaiting_acceptance");
  // Money that arrives late for the cancelled order goes straight back.
  const late = await webhook(
    paidEvent(a.json.clientParams.orderId, "pay_late", 31900),
  );
  assert.equal(late.status, 201);
  const refund = await db.refund.findFirstOrThrow({
    where: { orderId: abandoned.id },
  });
  assert.equal(refund.reason, "order_not_open");
  assert.equal(refund.amountPaise, 31900);
  assert.equal(refund.status, "succeeded");
  assert.equal(rz.refundCalls.at(-1).payment, "pay_late");
  assert.equal(
    (await orderRow(abandoned.id)).paymentStatus,
    "pending",
    "the closed order is not marked paid",
  );
});

test("paying twice never keeps both: the second payment is refunded", async () => {
  process.env.PAYMENT_PROVIDER = "razorpay";
  const order = await newOrder();
  const a = await call("POST", `/api/orders/${order.id}/payments`, "customer");
  assert.equal(
    (await webhook(paidEvent(a.json.clientParams.orderId, "pay_a", 31900)))
      .status,
    201,
  );
  await db.payment.update({
    where: { id: a.json.paymentId },
    data: { status: "failed" },
  });
  await db.order.update({
    where: { id: order.id },
    data: { paymentStatus: "paid" },
  });
  await db.payment.update({
    where: { id: a.json.paymentId },
    data: { status: "paid" },
  });
  const b = await db.payment.create({
    data: {
      orderId: order.id,
      outletId: outlet,
      provider: "razorpay",
      providerOrderId: "order_dup",
      amountPaise: 31900,
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  const r = await webhook(paidEvent("order_dup", "pay_b", 31900));
  assert.equal(r.status, 201);
  const refund = await db.refund.findFirstOrThrow({
    where: { paymentId: b.id },
  });
  assert.equal(refund.reason, "duplicate_payment");
  assert.equal(refund.status, "succeeded");
  assert.equal(
    await db.paymentEvent.count({ where: { orderId: order.id } }),
    1,
    "only one counted as payment",
  );
});

test("owner refunds: validated, idempotent, never over-refunded, and failures are visible", async () => {
  process.env.PAYMENT_PROVIDER = "razorpay";
  const order = await newOrder();
  const s = await call("POST", `/api/orders/${order.id}/payments`, "customer");
  await webhook(paidEvent(s.json.clientParams.orderId, "pay_r", 31900));
  await db.order.update({
    where: { id: order.id },
    data: { status: "preparing" },
  });
  const KEY1 = "refund-key-0001";
  const url = `/api/orders/${order.id}/refunds`;
  assert.equal(
    (
      await call(
        "POST",
        url,
        "kitchen",
        { reason: "test" },
        { "idempotency-key": KEY1 },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "POST",
        url,
        "customer",
        { reason: "test" },
        { "idempotency-key": KEY1 },
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("POST", url, "owner", { reason: "ok" }, {})).status,
    400,
    "idempotency key required",
  );
  assert.equal(
    (
      await call(
        "POST",
        url,
        "owner",
        { reason: "x" },
        { "idempotency-key": KEY1 },
      )
    ).status,
    400,
    "reason required",
  );
  assert.equal(
    (
      await call(
        "POST",
        url,
        "owner",
        { reason: "too much", amountPaise: 99999 },
        { "idempotency-key": KEY1 },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "POST",
        url,
        "owner",
        { reason: "all of it" },
        { "idempotency-key": KEY1 },
      )
    ).status,
    409,
    "full refund of an order still being prepared",
  );
  const partial = await call(
    "POST",
    url,
    "owner",
    { reason: "late order", amountPaise: 5000 },
    { "idempotency-key": "refund-key-0002" },
  );
  assert.equal(partial.status, 201);
  assert.equal(partial.json.status, "succeeded");
  const replay = await call(
    "POST",
    url,
    "owner",
    { reason: "late order", amountPaise: 5000 },
    { "idempotency-key": "refund-key-0002" },
  );
  assert.equal(replay.json.id, partial.json.id, "same key, same refund");
  const reused = await call(
    "POST",
    url,
    "owner",
    { reason: "late order", amountPaise: 9000 },
    { "idempotency-key": "refund-key-0002" },
  );
  assert.equal(
    reused.status,
    409,
    "a key cannot be reused for a different amount",
  );
  assert.equal(
    rz.refundCalls.filter((c) => c.payment === "pay_r").length,
    1,
    "the gateway was asked once",
  );
  const view = await call("GET", `/api/orders/${order.id}/payment`, "customer");
  assert.equal(view.json.refundedPaise, 5000);
  assert.equal(
    (await orderRow(order.id)).paymentStatus,
    "paid",
    "partial refund keeps the order paid",
  );
  assert.equal(
    (await call("GET", url, "other")).status,
    404,
    "another customer cannot see it",
  );
  assert.equal((await call("GET", url, "customer")).json.length, 1);
  // Finish the order, then refund the rest in full. A gateway failure is shown and undone.
  await db.order.update({
    where: { id: order.id },
    data: { status: "rejected" },
  });
  rz.failRefund = true;
  const failed = await call(
    "POST",
    url,
    "owner",
    { reason: "reject" },
    { "idempotency-key": "refund-key-0003" },
  );
  assert.equal(failed.status, 502);
  const failedRow = await db.refund.findFirstOrThrow({
    where: { orderId: order.id, idempotencyKey: "refund-key-0003" },
  });
  assert.equal(failedRow.status, "failed");
  assert.match(failedRow.failureReason ?? "", /Insufficient balance/);
  assert.equal(
    (await orderRow(order.id)).paymentStatus,
    "paid",
    "not marked refunded when it failed",
  );
  const rec = await call("GET", "/api/payments/reconcile", "owner");
  assert.ok(
    rec.json.refundsNeedingAttention.some((r: any) => r.id === failedRow.id),
  );
  rz.failRefund = false;
  const full = await call(
    "POST",
    url,
    "owner",
    { reason: "reject" },
    { "idempotency-key": "refund-key-0004" },
  );
  assert.equal(full.status, 201);
  assert.equal(full.json.amountPaise, 26900, "the rest of the payment");
  assert.equal((await orderRow(order.id)).paymentStatus, "refunded");
  assert.equal(
    (
      await call(
        "POST",
        url,
        "owner",
        { reason: "again" },
        { "idempotency-key": "refund-key-0005" },
      )
    ).status,
    409,
    "nothing left to refund",
  );
  // The gateway can later confirm or fail a refund by webhook.
  const rfnd = await db.refund.findUniqueOrThrow({
    where: { id: full.json.id },
  });
  await db.refund.update({
    where: { id: rfnd.id },
    data: { status: "processing" },
  });
  await webhook({
    event: "refund.processed",
    payload: {
      refund: {
        entity: {
          id: rfnd.providerRefundId,
          payment_id: "pay_r",
          amount: 26900,
        },
      },
    },
  });
  assert.equal(
    (await db.refund.findUniqueOrThrow({ where: { id: rfnd.id } })).status,
    "succeeded",
  );
});
