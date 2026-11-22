import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { hash } from "../src/auth";
import { validateRuntime } from "../src/runtime";
import { normalizePhone } from "../src/accounts/accounts";

const id = randomUUID(),
  outlet = "customer-test-" + id;
let app: any, db: Database, base: string, ownerToken: string;
const phone = () =>
  "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const PASS = "a-long-test-passphrase";

// Every test request comes from the same local address, so clear only that
// address's sign-up throttle rows (never anyone else's).
const localThrottle = () =>
  db.authThrottle.deleteMany({
    where: {
      key: {
        in: ["::1", "127.0.0.1", "::ffff:127.0.0.1"].map((ip) =>
          hash(`register:ip:${ip}`),
        ),
      },
    },
  });
before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  process.env.DEFAULT_OUTLET_ID = outlet;
  delete process.env.CUSTOMER_REGISTRATION;
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  await localThrottle();
  await db.outlet.create({ data: { id: outlet, name: "Customer fixture" } });
  const owner = await db.user.create({
    data: { outletId: outlet, name: "owner", role: "owner" },
  });
  ownerToken = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      userId: owner.id,
      tokenHash: hash(ownerToken),
      authMethod: "password",
      expiresAt: new Date(Date.now() + 600000),
    },
  });
});
after(async () => {
  if (db) {
    await localThrottle();
    const users = await db.user.findMany({
      where: { outletId: outlet },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await db.savedAddress.deleteMany({ where: { customerId: { in: ids } } });
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.credential.deleteMany({ where: { userId: { in: ids } } });
    await db.auditEvent.deleteMany({ where: { outletId: outlet } });
    await db.user.deleteMany({ where: { outletId: outlet } });
    await db.outlet.deleteMany({ where: { id: outlet } });
  }
  await app?.close();
});

async function call(
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
const register = (body: object) =>
  call("POST", "/api/auth/register", null, body);
const address = (over: object = {}) => ({
  label: "Home",
  recipient: "Test Customer",
  phone: "9000000000",
  line1: "Plot 12, Test Street",
  city: "Shankarpally",
  postalCode: "501203",
  ...over,
});

test("mobile numbers are normalised and invalid ones refused", () => {
  assert.equal(normalizePhone("9000000000"), "9000000000");
  assert.equal(normalizePhone("+91 90000 00000"), "9000000000");
  assert.equal(normalizePhone("919000000000"), "9000000000");
  assert.equal(normalizePhone("09000000000"), "9000000000");
  assert.equal(normalizePhone("(900) 000-0000"), "9000000000");
  for (const bad of ["12345", "5000000000", "90000000001", "abcdefghij", ""])
    assert.equal(normalizePhone(bad), null, bad);
});

test("a customer can register, is signed in at once, and can sign in again with the number", async () => {
  const number = phone();
  const made = await register({
    name: "  Asha Rao ",
    phone: number,
    password: PASS,
  });
  assert.equal(made.status, 201);
  assert.ok(made.json.token);
  assert.equal(made.json.user.role, "customer");
  assert.equal(made.json.user.name, "Asha Rao");
  assert.equal(made.json.phoneVerified, false);
  assert.equal(made.json.handle, number);
  const orders = await call("GET", "/api/orders", made.json.token);
  assert.equal(orders.status, 200, "the new session works");
  const row = await db.credential.findUniqueOrThrow({
    where: { handle: number },
  });
  assert.ok(row.passwordHash.startsWith("scrypt-v1$"), "password is hashed");
  assert.ok(!row.passwordHash.includes(PASS));
  for (const written of [
    `+91 ${number.slice(0, 5)} ${number.slice(5)}`,
    number,
  ]) {
    const again = await call("POST", "/api/auth/login", null, {
      handle: written,
      password: PASS,
      audience: "customer",
    });
    assert.equal(again.status, 201, `sign in with ${written}`);
  }
  assert.equal(
    (
      await call("POST", "/api/auth/login", null, {
        handle: number,
        password: "wrong-passphrase-here",
        audience: "customer",
      })
    ).status,
    401,
  );
});

test("registration refuses bad input, duplicates and privilege escalation", async () => {
  const number = phone();
  assert.equal(
    (await register({ name: "A", phone: number, password: PASS })).status,
    400,
  );
  assert.equal(
    (await register({ name: "Valid Name", phone: "12345", password: PASS }))
      .status,
    400,
  );
  assert.equal(
    (await register({ name: "Valid Name", phone: number, password: "short" }))
      .status,
    400,
  );
  assert.equal(
    (
      await register({
        name: "Valid Name",
        phone: number,
        password: PASS,
        role: "owner",
      })
    ).status,
    400,
    "role cannot be chosen",
  );
  assert.equal(
    (
      await register({
        name: "Valid Name",
        phone: number,
        password: PASS,
        outletId: "x",
      })
    ).status,
    400,
  );
  assert.equal(
    await db.credential.findUnique({ where: { handle: number } }),
    null,
  );
  assert.equal(
    (await register({ name: "Valid Name", phone: number, password: PASS }))
      .status,
    201,
  );
  const dup = await register({
    name: "Someone Else",
    phone: `+91${number}`,
    password: PASS,
  });
  assert.equal(dup.status, 409);
  assert.match(dup.json.message, /already exists/);
  const users = await db.user.count({
    where: { outletId: outlet, credential: { handle: number } },
  });
  assert.equal(users, 1);
});

test("registration can be switched off and is throttled per number", async () => {
  process.env.CUSTOMER_REGISTRATION = "off";
  assert.equal(
    (await register({ name: "Valid Name", phone: phone(), password: PASS }))
      .status,
    503,
  );
  delete process.env.CUSTOMER_REGISTRATION;
  const number = phone();
  assert.equal(
    (await register({ name: "Valid Name", phone: number, password: PASS }))
      .status,
    201,
  );
  let blocked = 0;
  for (let i = 0; i < 9; i++) {
    const r = await register({
      name: "Valid Name",
      phone: number,
      password: PASS,
    });
    if (r.status === 429) blocked++;
  }
  assert.ok(blocked >= 1, "repeated attempts for one number are throttled");
});

test("a customer's address book: first is default, duplicates merge, defaults move, limit applies", async () => {
  const me = (
    await register({ name: "Address Tester", phone: phone(), password: PASS })
  ).json.token;
  const empty = await call("GET", "/api/addresses", me);
  assert.deepEqual(empty.json, []);
  const first = await call(
    "POST",
    "/api/addresses",
    me,
    address({ latitude: 17.45, longitude: 78.13 }),
  );
  assert.equal(first.status, 201);
  assert.equal(
    first.json.isDefault,
    true,
    "the first address becomes the default",
  );
  assert.equal(first.json.latitude, 17.45);
  const second = await call(
    "POST",
    "/api/addresses",
    me,
    address({ label: "Work", line1: "Office block 4, Main Road" }),
  );
  assert.equal(second.json.isDefault, false);
  // Saving the same street address again updates it instead of duplicating.
  const again = await call(
    "POST",
    "/api/addresses",
    me,
    address({ line1: "  PLOT 12,  test street ", landmark: "Near the temple" }),
  );
  assert.equal(again.json.id, first.json.id);
  assert.equal(again.json.landmark, "Near the temple");
  assert.equal((await call("GET", "/api/addresses", me)).json.length, 2);
  // Making another the default moves the flag.
  const moved = await call(
    "PATCH",
    `/api/addresses/${second.json.id}/default`,
    me,
  );
  assert.equal(moved.json.isDefault, true);
  const listed = (await call("GET", "/api/addresses", me)).json;
  assert.equal(listed.filter((a: any) => a.isDefault).length, 1);
  assert.equal(listed[0].id, second.json.id, "the default is listed first");
  // Edit.
  const edited = await call(
    "PUT",
    `/api/addresses/${second.json.id}`,
    me,
    address({
      label: "Office",
      line1: "Office block 4, Main Road",
      landmark: "",
    }),
  );
  assert.equal(edited.json.label, "Office");
  assert.equal(edited.json.landmark, null);
  assert.equal(edited.json.isDefault, true, "editing keeps the default");
  // Deleting the default promotes another.
  assert.equal(
    (await call("DELETE", `/api/addresses/${second.json.id}`, me)).status,
    200,
  );
  const after = (await call("GET", "/api/addresses", me)).json;
  assert.equal(after.length, 1);
  assert.equal(after[0].isDefault, true);
  // The limit.
  for (let i = 0; i < 9; i++)
    assert.equal(
      (
        await call(
          "POST",
          "/api/addresses",
          me,
          address({ label: `A${i}`, line1: `House number ${i}, Lane` }),
        )
      ).status,
      201,
    );
  const over = await call(
    "POST",
    "/api/addresses",
    me,
    address({ label: "Extra", line1: "One house too many" }),
  );
  assert.equal(over.status, 409);
  assert.match(over.json.message, /up to 10/);
  const defaults = (await call("GET", "/api/addresses", me)).json.filter(
    (a: any) => a.isDefault,
  );
  assert.equal(defaults.length, 1);
});

test("address book is private, customer-only and validated", async () => {
  const a = (
    await register({ name: "Customer A", phone: phone(), password: PASS })
  ).json.token;
  const b = (
    await register({ name: "Customer B", phone: phone(), password: PASS })
  ).json.token;
  const mine = (await call("POST", "/api/addresses", a, address())).json;
  assert.equal((await call("GET", "/api/addresses", b)).json.length, 0);
  assert.equal(
    (
      await call(
        "PUT",
        `/api/addresses/${mine.id}`,
        b,
        address({ label: "Stolen" }),
      )
    ).status,
    404,
  );
  assert.equal(
    (await call("PATCH", `/api/addresses/${mine.id}/default`, b)).status,
    404,
  );
  assert.equal(
    (await call("DELETE", `/api/addresses/${mine.id}`, b)).status,
    404,
  );
  assert.equal(
    (await call("GET", "/api/addresses", a)).json.length,
    1,
    "still there",
  );
  assert.equal((await call("GET", "/api/addresses", null)).status, 401);
  assert.equal((await call("GET", "/api/addresses", ownerToken)).status, 403);
  assert.equal(
    (await call("POST", "/api/addresses", ownerToken, address())).status,
    403,
  );
  for (const bad of [
    address({ postalCode: "12" }),
    address({ phone: "123" }),
    address({ recipient: "A" }),
    address({ label: "" }),
    address({ latitude: 17.4 }),
    address({ latitude: 95, longitude: 78 }),
    { ...address(), customerId: "someone-else" },
  ])
    assert.equal(
      (await call("POST", "/api/addresses", a, bad)).status,
      400,
      JSON.stringify(bad),
    );
});
