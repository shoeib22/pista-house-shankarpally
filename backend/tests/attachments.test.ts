import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app";
import { configureBody } from "../src/body";
import { Database } from "../src/database";
import { Support } from "../src/support";
import { hash } from "../src/auth";
import { validateRuntime } from "../src/runtime";

const id = randomUUID(),
  outlet = "attach-test-" + id;
let app: any, db: Database, support: Support, base: string;
const tokens: Record<string, string> = {},
  users: Record<string, any> = {};
const jpeg = (size = 300) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(size)]);
const png = () =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    randomBytes(100),
  ]);
const webp = () =>
  Buffer.concat([
    Buffer.from("RIFF"),
    randomBytes(4),
    Buffer.from("WEBP"),
    randomBytes(100),
  ]);
const photo = (bytes: Buffer, contentType = "image/jpeg") => ({
  contentType,
  data: bytes.toString("base64"),
});

before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  for (const f of [
    "NOTIFICATIONS_POLL_DISABLED",
    "NOTIFICATIONS_CAMPAIGNS_DISABLED",
    "SUPPORT_SWEEP_DISABLED",
    "PAYMENTS_SWEEP_DISABLED",
    "DISPATCH_DISABLED",
  ])
    process.env[f] = "true";
  process.env.PUSH_PROVIDER = "none";
  app = await NestFactory.create(AppModule, { logger: false });
  configureBody(app);
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  support = app.get(Support);
  await db.outlet.create({ data: { id: outlet, name: "Attachment fixture" } });
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
    const ids = Object.values(users).map((u: any) => u.id);
    const t = (
      await db.supportTicket.findMany({
        where: { outletId: outlet },
        select: { id: true },
      })
    ).map((x) => x.id);
    await db.supportAttachment.deleteMany({ where: { ticketId: { in: t } } });
    await db.supportMessage.deleteMany({ where: { ticketId: { in: t } } });
    await db.supportTicket.deleteMany({ where: { outletId: outlet } });
    await db.notification.deleteMany({ where: { userId: { in: ids } } });
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
const raw = (path: string, who: string | null) =>
  fetch(base + path, {
    headers: who ? { authorization: `Bearer ${tokens[who]}` } : {},
  });
const open = (who: string, extra: object = {}) =>
  call("POST", "/api/support/tickets", who, {
    category: "quality",
    message: "The biryani was cold.",
    ...extra,
  });

test("a customer sends photos with a request and only the right people can see them", async () => {
  const img = jpeg(500),
    img2 = png();
  const made = await open("alice", {
    attachments: [photo(img), photo(img2, "image/png")],
  });
  assert.equal(made.status, 201, JSON.stringify(made.json));
  const shown = made.json.messages[0].attachments;
  assert.equal(shown.length, 2);
  assert.deepEqual(
    shown.map((a: any) => a.contentType),
    ["image/jpeg", "image/png"],
  );
  assert.equal(shown[0].size, img.length);
  assert.ok(
    !JSON.stringify(shown).includes(img.toString("base64").slice(0, 20)),
    "the list carries no image data",
  );
  const url = `/api/support/attachments/${shown[0].id}`;
  const mine = await raw(url, "alice");
  assert.equal(mine.status, 200);
  assert.equal(mine.headers.get("content-type"), "image/jpeg");
  assert.equal(mine.headers.get("x-content-type-options"), "nosniff");
  assert.equal(mine.headers.get("content-disposition"), "inline");
  assert.match(mine.headers.get("cache-control") ?? "", /private/);
  assert.deepEqual(
    Buffer.from(await mine.arrayBuffer()),
    img,
    "the exact bytes come back",
  );
  for (const who of ["owner", "counter"])
    assert.equal((await raw(url, who)).status, 200, who);
  assert.equal((await raw(url, "bob")).status, 404, "another customer");
  assert.equal((await raw(url, "kitchen")).status, 403);
  assert.equal((await raw(url, "rider")).status, 403);
  assert.equal((await raw(url, null)).status, 401);
  assert.equal(
    (await raw("/api/support/attachments/" + randomUUID(), "owner")).status,
    404,
  );
  const staff = await call(
    "GET",
    `/api/support/inbox/${made.json.id}`,
    "owner",
  );
  assert.equal(
    staff.json.messages[0].attachments.length,
    2,
    "staff see the photos on the request",
  );
});

test("photos can come with replies, and staff photos on private notes stay private", async () => {
  const t = (await open("alice")).json;
  const reply = await call(
    "POST",
    `/api/support/tickets/${t.id}/messages`,
    "alice",
    { body: "Here is a photo", attachments: [photo(webp(), "image/webp")] },
  );
  assert.equal(reply.status, 201);
  assert.equal(
    reply.json.messages.at(-1).attachments[0].contentType,
    "image/webp",
  );
  const note = await call("POST", `/api/support/inbox/${t.id}/reply`, "owner", {
    body: "Kitchen photo of the batch",
    internal: true,
    attachments: [photo(jpeg())],
  });
  assert.equal(note.status, 201);
  const noteMessage = note.json.messages.at(-1);
  assert.equal(noteMessage.internal, true);
  const noteId = noteMessage.attachments[0].id;
  assert.equal(
    (await raw(`/api/support/attachments/${noteId}`, "owner")).status,
    200,
  );
  assert.equal(
    (await raw(`/api/support/attachments/${noteId}`, "alice")).status,
    404,
    "a private note's photo is hidden even from the ticket owner",
  );
  const staffPhoto = await call(
    "POST",
    `/api/support/inbox/${t.id}/reply`,
    "owner",
    { body: "This is the batch we used", attachments: [photo(jpeg())] },
  );
  const sid = staffPhoto.json.messages.at(-1).attachments[0].id;
  assert.equal(
    (await raw(`/api/support/attachments/${sid}`, "alice")).status,
    200,
    "a photo sent to the customer is visible to them",
  );
  const view = JSON.stringify(
    (await call("GET", `/api/support/tickets/${t.id}`, "alice")).json,
  );
  assert.ok(
    view.includes(sid) && !view.includes(noteId),
    "the customer's conversation lists only what they may see",
  );
});

test("only real, small images are accepted", async () => {
  const bad = async (attachments: unknown, why: string) =>
    assert.equal((await open("alice", { attachments })).status, 400, why);
  await bad(
    [photo(Buffer.from("<svg onload=alert(1)></svg>"), "image/jpeg")],
    "text pretending to be a JPEG",
  );
  await bad([photo(jpeg(), "image/png")], "wrong declared type");
  await bad([photo(jpeg(), "image/svg+xml")], "SVG is not allowed");
  await bad([photo(jpeg(), "text/html")], "HTML is not allowed");
  await bad([photo(jpeg(900_000))], "over 800 KB");
  await bad(
    [photo(jpeg()), photo(jpeg()), photo(jpeg()), photo(jpeg())],
    "four photos",
  );
  await bad(
    [{ contentType: "image/jpeg", data: "not base64!!!!!!!!!!!!" }],
    "not base64",
  );
  await bad(
    [{ contentType: "image/jpeg", data: photo(jpeg()).data, extra: 1 }],
    "extra field",
  );
  assert.equal(
    (
      await open("alice", {
        attachments: [
          photo(jpeg()),
          photo(png(), "image/png"),
          photo(webp(), "image/webp"),
        ],
      })
    ).status,
    201,
    "three is fine",
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/support/tickets/" + randomUUID() + "/messages",
        "alice",
        { body: "x", attachments: [photo(jpeg())] },
      )
    ).status,
    404,
  );
});

test("old photos are deleted after the retention period, the messages stay", async () => {
  const t = (await open("bob", { attachments: [photo(jpeg())] })).json;
  const row = await db.supportAttachment.findFirstOrThrow({
    where: { ticketId: t.id },
  });
  await db.supportAttachment.update({
    where: { id: row.id },
    data: { createdAt: new Date(Date.now() - 100 * 86400000) },
  });
  await support.sweep();
  assert.equal(
    await db.supportAttachment.count({ where: { ticketId: t.id } }),
    0,
  );
  const view = (await call("GET", `/api/support/tickets/${t.id}`, "bob"))
    .json;
  assert.equal(view.messages.length, 1);
  assert.deepEqual(view.messages[0].attachments, []);
});
