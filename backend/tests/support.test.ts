import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { Support } from "../src/support";
import { hash } from "../src/auth";
import { validateRuntime } from "../src/runtime";

const id = randomUUID(),
  outlet = "support-test-" + id;
let app: any, db: Database, support: Support, base: string;
const tokens: Record<string, string> = {},
  users: Record<string, any> = {};

before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  process.env.SUPPORT_SWEEP_DISABLED = "true";
  process.env.PAYMENTS_SWEEP_DISABLED = "true";
  process.env.DISPATCH_DISABLED = "true";
  process.env.SUPPORT_SLA_MINUTES = "60";
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  support = app.get(Support);
  await db.outlet.create({ data: { id: outlet, name: "Support fixture" } });
  for (const [key, role] of [
    ["alice", "customer"],
    ["bob", "customer"],
    ["owner", "owner"],
    ["counter", "counter"],
    ["kitchen", "kitchen"],
    ["rider", "rider"],
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
});
after(async () => {
  if (db) {
    const t = await db.supportTicket.findMany({
      where: { outletId: outlet },
      select: { id: true },
    });
    const ids = t.map((x) => x.id);
    await db.supportMessage.deleteMany({ where: { ticketId: { in: ids } } });
    await db.supportTicket.deleteMany({ where: { outletId: outlet } });
    const orders = (
      await db.order.findMany({
        where: { outletId: outlet },
        select: { id: true },
      })
    ).map((o) => o.id);
    await db.orderItem.deleteMany({ where: { orderId: { in: orders } } });
    await db.order.deleteMany({ where: { outletId: outlet } });
    await db.auditEvent.deleteMany({ where: { outletId: outlet } });
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
const open = (who: string, over: object = {}) =>
  call("POST", "/api/support/tickets", who, {
    category: "missing_item",
    message: "The raita was missing from my order.",
    ...over,
  });
async function orderFor(who: string) {
  const key = randomUUID();
  return db.order.create({
    data: {
      outletId: outlet,
      customerId: users[who].id,
      idempotencyKey: key,
      requestHash: key,
      fulfilment: "pickup",
      status: "delivered",
      paymentStatus: "paid",
      subtotalPaise: 29900,
      taxPaise: 0,
      deliveryPaise: 0,
      totalPaise: 29900,
      items: {
        create: {
          productId: "chicken-biryani",
          name: "Chicken Dum Biryani",
          quantity: 1,
          unitPaise: 29900,
        },
      },
    },
  });
}
const wipe = async () => {
  await db.supportMessage.deleteMany({
    where: { ticket: { outletId: outlet } },
  });
  await db.supportTicket.deleteMany({ where: { outletId: outlet } });
};

test("a customer raises a request about their order and sees it in their list", async () => {
  await wipe();
  const order = await orderFor("alice");
  const made = await open("alice", { orderId: order.id });
  assert.equal(made.status, 201, JSON.stringify(made.json));
  assert.equal(made.json.status, "open");
  assert.equal(made.json.orderNumber, order.number);
  assert.match(made.json.subject, /Missing item on #PH/);
  assert.equal(made.json.messages.length, 1);
  assert.equal(made.json.messages[0].from, "you");
  assert.equal(made.json.canReply, true);
  const list = await call("GET", "/api/support/tickets", "alice");
  assert.equal(list.json.length, 1);
  assert.equal(list.json[0].unread, false);
  assert.equal(
    (await call("GET", "/api/support/tickets", "bob")).json.length,
    0,
  );
  assert.equal(
    (await call("GET", `/api/support/tickets/${made.json.id}`, "bob")).status,
    404,
    "private to its owner",
  );
  assert.equal(
    (
      await call(
        "POST",
        `/api/support/tickets/${made.json.id}/messages`,
        "bob",
        { body: "hi" },
      )
    ).status,
    404,
  );
});

test("input is validated and extra fields are refused", async () => {
  await wipe();
  const bobsOrder = await orderFor("bob");
  assert.equal((await open("alice", { category: "nonsense" })).status, 400);
  assert.equal((await open("alice", { message: "   " })).status, 400);
  assert.equal(
    (await open("alice", { message: "x".repeat(2001) })).status,
    400,
  );
  assert.equal(
    (await open("alice", { status: "resolved" })).status,
    400,
    "cannot choose the status",
  );
  assert.equal((await open("alice", { customerId: users.bob.id })).status, 400);
  assert.equal(
    (await open("alice", { orderId: bobsOrder.id })).status,
    404,
    "cannot attach someone else's order",
  );
  assert.equal((await open("alice", { orderId: randomUUID() })).status, 404);
  assert.equal(
    (
      await call("POST", "/api/support/tickets", null, {
        category: "other",
        message: "hi",
      })
    ).status,
    401,
  );
  for (const who of ["owner", "counter", "kitchen", "rider"])
    assert.equal(
      (await open(who)).status,
      403,
      `${who} cannot raise customer requests`,
    );
});

test("open requests and creation rate are limited", async () => {
  await wipe();
  for (let i = 0; i < 3; i++) assert.equal((await open("alice")).status, 201);
  const over = await open("alice");
  assert.equal(over.status, 409);
  assert.match(over.json.message, /3 open requests/);
  assert.equal((await open("bob")).status, 201, "limits are per customer");
  // Closing frees a slot, but the hourly cap still applies.
  await wipe();
  for (let i = 0; i < 5; i++) {
    const t = await open("alice");
    assert.equal(t.status, 201);
    await call("POST", `/api/support/tickets/${t.json.id}/close`, "alice");
  }
  assert.equal((await open("alice")).status, 429);
});

test("only support staff can use the inbox", async () => {
  await wipe();
  const t = (await open("alice")).json;
  for (const who of ["alice", "kitchen", "rider"]) {
    assert.equal(
      (await call("GET", "/api/support/inbox", who)).status,
      403,
      who,
    );
    assert.equal(
      (await call("GET", `/api/support/inbox/${t.id}`, who)).status,
      403,
    );
    assert.equal(
      (
        await call("POST", `/api/support/inbox/${t.id}/reply`, who, {
          body: "x",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("PATCH", `/api/support/inbox/${t.id}`, who, {
          priority: "high",
        })
      ).status,
      403,
    );
    assert.equal((await call("GET", "/api/support/stats", who)).status, 403);
  }
  for (const who of ["owner", "counter"])
    assert.equal(
      (await call("GET", "/api/support/inbox", who)).status,
      200,
      who,
    );
});

test("staff reply reaches the customer, internal notes never do", async () => {
  await wipe();
  const order = await orderFor("alice");
  const t = (await open("alice", { orderId: order.id })).json;
  const SECRET = "internal: customer has complained 3 times, be careful";
  const note = await call(
    "POST",
    `/api/support/inbox/${t.id}/reply`,
    "counter",
    { body: SECRET, internal: true },
  );
  assert.equal(note.status, 201);
  assert.equal(
    note.json.status,
    "open",
    "a private note does not answer the customer",
  );
  const reply = await call(
    "POST",
    `/api/support/inbox/${t.id}/reply`,
    "owner",
    { body: "So sorry about the raita. We have refunded it." },
  );
  assert.equal(reply.json.status, "pending_customer");
  assert.equal(reply.json.assignedTo, "owner", "the first replier takes it");
  const row = await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
  assert.ok(row.firstResponseAt, "first response time recorded");
  const first = row.firstResponseAt;
  await call("POST", `/api/support/inbox/${t.id}/reply`, "counter", {
    body: "Anything else?",
  });
  assert.deepEqual(
    (await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } }))
      .firstResponseAt,
    first,
    "first response is set once",
  );
  const list = await call("GET", "/api/support/tickets", "alice");
  assert.equal(list.json[0].unread, true);
  const view = await call("GET", `/api/support/tickets/${t.id}`, "alice");
  const text = JSON.stringify(view.json);
  assert.ok(
    !text.includes(SECRET),
    "internal notes are never shown to the customer",
  );
  assert.ok(!text.includes("careful"));
  assert.ok(
    !text.includes("owner") || !text.includes("authorId"),
    "no staff identities",
  );
  assert.deepEqual(
    view.json.messages.map((m: any) => m.from),
    ["you", "support", "support"],
  );
  assert.equal(
    (await call("GET", "/api/support/tickets", "alice")).json[0].unread,
    false,
    "reading clears unread",
  );
  const staff = await call("GET", `/api/support/inbox/${t.id}`, "owner");
  assert.ok(
    staff.json.messages.some((m: any) => m.internal && m.body === SECRET),
    "staff can see the note",
  );
  assert.equal(staff.json.order.items[0].name, "Chicken Dum Biryani");
  assert.equal(staff.json.order.paymentStatus, "paid");
  assert.equal(staff.json.customer.name, "alice");
});

test("a customer reply reopens; resolved can be reopened for a week; closed cannot", async () => {
  await wipe();
  const t = (await open("alice")).json;
  await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
    body: "Please send a photo",
    status: "pending_customer",
  });
  const back = await call(
    "POST",
    `/api/support/tickets/${t.id}/messages`,
    "alice",
    { body: "Here is more detail" },
  );
  assert.equal(
    back.json.status,
    "open",
    "customer reply puts it back in the staff queue",
  );
  await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
    body: "Sorted. Marking this done.",
    status: "resolved",
  });
  assert.equal(
    (await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } })).status,
    "resolved",
  );
  const reopened = await call(
    "POST",
    `/api/support/tickets/${t.id}/messages`,
    "alice",
    { body: "Actually it happened again" },
  );
  assert.equal(reopened.json.status, "open");
  assert.equal(
    (await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } }))
      .resolvedAt,
    null,
  );
  // Resolved long ago: start a new request instead.
  await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
    body: "Done",
    status: "resolved",
  });
  await db.supportTicket.update({
    where: { id: t.id },
    data: { resolvedAt: new Date(Date.now() - 8 * 86400000) },
  });
  const stale = await call(
    "POST",
    `/api/support/tickets/${t.id}/messages`,
    "alice",
    { body: "hello?" },
  );
  assert.equal(stale.status, 409);
  assert.equal(
    (await call("GET", `/api/support/tickets/${t.id}`, "alice")).json.canReply,
    false,
  );
  // The sweep closes old resolved requests.
  assert.ok((await support.sweep()) >= 1);
  assert.equal(
    (await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } })).status,
    "closed",
  );
  assert.equal(
    (
      await call("POST", `/api/support/tickets/${t.id}/messages`, "alice", {
        body: "again",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
        body: "late reply",
      })
    ).status,
    409,
    "staff must reopen first",
  );
  const note = await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
    body: "just a note",
    internal: true,
  });
  assert.equal(note.status, 201, "notes are still allowed");
});

test("customers can close and rate once, only when finished", async () => {
  await wipe();
  const t = (await open("alice")).json;
  const rate = (who: string, rating: number) =>
    call("POST", `/api/support/tickets/${t.id}/rating`, who, {
      rating,
      comment: "quick",
    });
  assert.equal(
    (await rate("alice", 5)).status,
    409,
    "cannot rate an unfinished request",
  );
  await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
    body: "Resolved for you",
    status: "resolved",
  });
  assert.equal((await rate("alice", 0)).status, 400);
  assert.equal((await rate("alice", 6)).status, 400);
  assert.equal((await rate("bob", 5)).status, 409, "someone else's request");
  const ok = await rate("alice", 4);
  assert.equal(ok.status, 201);
  assert.equal(ok.json.rating, 4);
  assert.equal((await rate("alice", 5)).status, 409, "only once");
  const closed = await call(
    "POST",
    `/api/support/tickets/${t.id}/close`,
    "alice",
  );
  assert.equal(closed.json.status, "closed");
  assert.ok(
    closed.json.messages.some(
      (m: any) => m.from === "support" && /Closed by you/.test(m.body),
    ),
  );
  assert.equal(
    (await call("POST", `/api/support/tickets/${t.id}/close`, "bob")).status,
    404,
  );
});

test("the inbox filters, searches and puts the most urgent first", async () => {
  await wipe();
  const a = (await open("alice", { subject: "Cold biryani" })).json;
  const b = (
    await open("bob", { subject: "Where is my order", category: "late" })
  ).json;
  const c = (
    await open("alice", { subject: "Refund question", category: "refund" })
  ).json;
  // b has waited two hours (overdue); c is high priority; a is fresh.
  await db.supportTicket.update({
    where: { id: b.id },
    data: { lastCustomerMessageAt: new Date(Date.now() - 2 * 3600000) },
  });
  await call("PATCH", `/api/support/inbox/${c.id}`, "owner", {
    priority: "high",
  });
  const queue = (await call("GET", "/api/support/inbox", "counter")).json;
  assert.deepEqual(
    queue.map((t: any) => t.id),
    [b.id, c.id, a.id],
    "overdue, then high priority, then the rest",
  );
  assert.equal(queue[0].overdue, true);
  assert.ok(queue[0].waitingMinutes >= 119);
  assert.equal(queue[0].customer, "bob");
  await call("POST", `/api/support/inbox/${a.id}/reply`, "owner", {
    body: "On it",
  });
  assert.equal(
    (await call("GET", "/api/support/inbox", "owner")).json.length,
    2,
  );
  assert.deepEqual(
    (await call("GET", "/api/support/inbox?filter=waiting", "owner")).json.map(
      (t: any) => t.id,
    ),
    [a.id],
  );
  assert.equal(
    (await call("GET", "/api/support/inbox?filter=all", "owner")).json.length,
    3,
  );
  assert.equal(
    (await call("GET", "/api/support/inbox?filter=finished", "owner")).json
      .length,
    0,
  );
  assert.equal(
    (await call("GET", "/api/support/inbox?filter=nope", "owner")).status,
    400,
  );
  assert.equal(
    (await call("GET", "/api/support/inbox?filter=all&mine=true", "owner")).json
      .length,
    1,
    "only the one assigned to me",
  );
  assert.equal(
    (await call("GET", "/api/support/inbox?filter=all&mine=true", "counter"))
      .json.length,
    0,
  );
  const search = async (q: string) =>
    (
      await call(
        "GET",
        `/api/support/inbox?filter=all&search=${encodeURIComponent(q)}`,
        "owner",
      )
    ).json.map((t: any) => t.id);
  assert.deepEqual(await search("cold"), [a.id]);
  assert.deepEqual(await search("bob"), [b.id]);
  assert.deepEqual(await search(String(c.number)), [c.id]);
});

test("staff can assign, prioritise and change status, leaving a private trail", async () => {
  await wipe();
  const t = (await open("alice")).json;
  const up = await call("PATCH", `/api/support/inbox/${t.id}`, "counter", {
    assign: "me",
    priority: "high",
    status: "pending_customer",
  });
  assert.equal(up.status, 200);
  assert.deepEqual(
    [up.json.assignedTo, up.json.priority, up.json.status],
    ["counter", "high", "pending_customer"],
  );
  const trail = up.json.messages.filter((m: any) => m.from === "system");
  assert.equal(trail.length, 3);
  assert.ok(
    trail.every((m: any) => m.internal),
    "the trail is staff-only",
  );
  const seen = JSON.stringify(
    (await call("GET", `/api/support/tickets/${t.id}`, "alice")).json,
  );
  assert.ok(!seen.includes("Assigned to") && !seen.includes("Priority set"));
  assert.equal(
    (
      await call("PATCH", `/api/support/inbox/${t.id}`, "owner", {
        status: "bogus",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("PATCH", `/api/support/inbox/${t.id}`, "owner", {
        assign: "none",
      })
    ).json.assignedTo,
    null,
  );
  const done = await call("PATCH", `/api/support/inbox/${t.id}`, "owner", {
    status: "resolved",
  });
  assert.ok(
    await db.supportTicket.findFirst({
      where: { id: t.id, resolvedAt: { not: null } },
    }),
  );
  assert.equal(done.json.status, "resolved");
  assert.ok(
    await db.auditEvent.findFirst({
      where: { resourceId: t.id, action: "support.resolved" },
    }),
  );
  assert.equal(
    (
      await call("PATCH", `/api/support/inbox/${randomUUID()}`, "owner", {
        priority: "high",
      })
    ).status,
    404,
  );
});

test("stats show the queue, overdue requests, response time and satisfaction", async () => {
  await wipe();
  const a = (await open("alice")).json;
  const b = (await open("bob")).json;
  await db.supportTicket.update({
    where: { id: b.id },
    data: {
      lastCustomerMessageAt: new Date(Date.now() - 3 * 3600000),
      createdAt: new Date(Date.now() - 3 * 3600000),
    },
  });
  let s = (await call("GET", "/api/support/stats", "owner")).json;
  assert.deepEqual(
    [s.needsReply, s.overdue, s.waitingOnCustomer, s.slaMinutes],
    [2, 1, 0, 60],
  );
  assert.equal(s.avgFirstResponseMinutes, null);
  await call("POST", `/api/support/inbox/${a.id}/reply`, "owner", {
    body: "Hello",
    status: "resolved",
  });
  await call("POST", `/api/support/inbox/${b.id}/reply`, "owner", {
    body: "Sorry for the wait",
  });
  await call("POST", `/api/support/tickets/${a.id}/rating`, "alice", {
    rating: 5,
  });
  s = (await call("GET", "/api/support/stats", "owner")).json;
  assert.equal(s.needsReply, 0);
  assert.equal(s.waitingOnCustomer, 1);
  assert.equal(s.resolvedToday, 1);
  assert.equal(s.assignedToMe, 1);
  assert.ok(
    s.avgFirstResponseMinutes >= 80,
    "average of a fast and a 3-hour first response",
  );
  assert.deepEqual(s.satisfaction, { average: 5, ratings: 1 });
});

test("message flooding is slowed down", async () => {
  await wipe();
  const t = (await open("alice")).json;
  const results: number[] = [];
  for (let i = 0; i < 7; i++)
    results.push(
      (
        await call("POST", `/api/support/tickets/${t.id}/messages`, "alice", {
          body: `message ${i}`,
        })
      ).status,
    );
  assert.ok(results.includes(429), JSON.stringify(results));
});
