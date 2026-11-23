import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app";
import { Database } from "../src/database";
import { Mailer } from "../src/mailer";
import { hash } from "../src/auth";
import { validateRuntime } from "../src/runtime";

const id = randomUUID(),
  outlet = "email-test-" + id;
let app: any, db: Database, mailer: Mailer, base: string;
const PASS = "a-long-test-passphrase",
  NEW_PASS = "another-long-test-passphrase";
const phone = () =>
  "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const mail = () => `t${randomUUID().slice(0, 8)}@example.test`;
const localThrottle = () =>
  db.authThrottle.deleteMany({
    where: {
      OR: ["register", "login", "forgot", "reset", "verify-email"].flatMap(
        (scope) =>
          ["::1", "127.0.0.1", "::ffff:127.0.0.1"].map((ip) => ({
            key: hash(`${scope}:ip:${ip}`),
          })),
      ),
    },
  });

before(async () => {
  const env = dotenv.parse(await fs.readFile(".env.beta"));
  validateRuntime(env);
  Object.assign(process.env, env);
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  process.env.DEFAULT_OUTLET_ID = outlet;
  process.env.MAIL_PROVIDER = "memory";
  process.env.MAIL_DAILY_LIMIT = "1000";
  delete process.env.CUSTOMER_REGISTRATION;
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  db = app.get(Database);
  mailer = app.get(Mailer);
  await localThrottle();
  await db.outlet.create({ data: { id: outlet, name: "Email fixture" } });
});
after(async () => {
  if (db) {
    await localThrottle();
    const ids = (
      await db.user.findMany({
        where: { outletId: outlet },
        select: { id: true },
      })
    ).map((u) => u.id);
    await db.emailCode.deleteMany({ where: { userId: { in: ids } } });
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
const lastCode = (to: string) => {
  const m = [...mailer.outbox].reverse().find((x) => x.to === to);
  assert.ok(m, `an email was sent to ${to}`);
  return /\b(\d{6})\b/.exec(m!.subject)![1];
};
async function newCustomer(withEmail = true) {
  const number = phone(),
    email = mail();
  const r = await call("POST", "/api/auth/register", null, {
    name: "Mail Tester",
    phone: number,
    password: PASS,
    ...(withEmail ? { email } : {}),
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return {
    number,
    email,
    token: r.json.token as string,
    userId: r.json.user.id as string,
    reg: r.json,
  };
}
/** Skip the one-minute resend wait without weakening it for real users. */
const skipCooldown = (userId: string) =>
  db.emailCode.updateMany({
    where: { userId },
    data: { createdAt: new Date(Date.now() - 120000) },
  });
async function verified() {
  const c = await newCustomer();
  const ok = await call("POST", "/api/auth/email/verify", c.token, {
    code: lastCode(c.email),
  });
  assert.equal(ok.status, 201);
  return c;
}

test("registering with an email sends a verification code and stores only its hash", async () => {
  const c = await newCustomer();
  assert.equal(c.reg.email, c.email);
  assert.equal(c.reg.emailVerified, false);
  assert.equal(c.reg.emailSent, true);
  assert.ok(!("emailPending" in c.reg));
  const code = lastCode(c.email);
  assert.match(code, /^\d{6}$/);
  const row = await db.emailCode.findFirstOrThrow({
    where: { userId: c.userId },
  });
  assert.equal(row.purpose, "verify");
  assert.notEqual(row.codeHash, code);
  assert.ok(!row.codeHash.includes(code));
  assert.ok(row.expiresAt.getTime() - Date.now() <= 10 * 60000 + 1000);
  const me = await call("GET", "/api/auth/me", c.token);
  assert.equal(me.json.email, c.email);
  assert.equal(me.json.emailVerified, false);
  assert.equal(me.json.handle, c.number);
  // Registering without an email still works (older app versions).
  const plain = await newCustomer(false);
  assert.equal(plain.reg.emailSent, null);
});

test("the right code verifies once; wrong codes are counted and eventually lock the code", async () => {
  const c = await newCustomer();
  const code = lastCode(c.email);
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal(
    (await call("POST", "/api/auth/email/verify", c.token, { code: "12" }))
      .status,
    400,
  );
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await call("POST", "/api/auth/email/verify", c.token, { code: wrong }))
        .status,
      400,
    );
  // Even the correct code no longer works after five wrong guesses.
  assert.equal(
    (await call("POST", "/api/auth/email/verify", c.token, { code })).status,
    400,
  );
  await skipCooldown(c.userId);
  assert.equal(
    (await call("POST", "/api/auth/email/resend", c.token)).json.sent,
    true,
  );
  const fresh = lastCode(c.email);
  assert.notEqual(fresh, code);
  const ok = await call("POST", "/api/auth/email/verify", c.token, {
    code: fresh,
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.verified, true);
  assert.equal(
    (await call("GET", "/api/auth/me", c.token)).json.emailVerified,
    true,
  );
});

test("codes expire, are single use, and resending is rate limited", async () => {
  const c = await newCustomer();
  const code = lastCode(c.email);
  assert.equal(
    (await call("POST", "/api/auth/email/resend", c.token)).status,
    429,
    "one-minute cooldown",
  );
  await db.emailCode.updateMany({
    where: { userId: c.userId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(
    (await call("POST", "/api/auth/email/verify", c.token, { code })).status,
    400,
    "expired",
  );
  await skipCooldown(c.userId);
  await call("POST", "/api/auth/email/resend", c.token);
  const first = lastCode(c.email);
  await skipCooldown(c.userId);
  await call("POST", "/api/auth/email/resend", c.token);
  const second = lastCode(c.email);
  assert.notEqual(first, second);
  assert.equal(
    (await call("POST", "/api/auth/email/verify", c.token, { code: first }))
      .status,
    400,
    "an older code dies when a newer one is sent",
  );
  assert.equal(
    (await call("POST", "/api/auth/email/verify", c.token, { code: second }))
      .status,
    201,
  );
});

test("a verified email belongs to one account; unverified claims cannot block it", async () => {
  const owner = await newCustomer();
  await call("POST", "/api/auth/email/verify", owner.token, {
    code: lastCode(owner.email),
  });
  const squatter = await call("POST", "/api/auth/register", null, {
    name: "Squatter",
    phone: phone(),
    password: PASS,
    email: owner.email.toUpperCase(),
  });
  assert.equal(
    squatter.status,
    201,
    "typing someone's email does not need it to be free",
  );
  const sq = squatter.json;
  const code = lastCode(owner.email);
  const refused = await call("POST", "/api/auth/email/verify", sq.token, {
    code,
  });
  // That code was mailed for the squatter's own claim, so it is a valid code,
  // but the address is already verified on another account.
  assert.equal(
    refused.status,
    409,
    "an address verified elsewhere cannot be verified again",
  );
  assert.equal(
    (await call("GET", "/api/auth/me", sq.token)).json.emailVerified,
    false,
  );
  // Changing email resets verification.
  await skipCooldown(owner.userId);
  const swap = await call("POST", "/api/auth/email", owner.token, {
    email: mail(),
  });
  assert.equal(swap.json.verified, false);
  assert.equal(
    (await call("GET", "/api/auth/me", owner.token)).json.emailVerified,
    false,
  );
  assert.equal(
    (
      await call("POST", "/api/auth/email", owner.token, {
        email: "not-an-email",
      })
    ).status,
    400,
  );
});

test("forgot-passphrase gives the same answer for everyone and emails only verified accounts", async () => {
  const c = await verified();
  const before = mailer.outbox.length;
  const unknown = await call("POST", "/api/auth/forgot", null, {
    identifier: phone(),
  });
  const unknownEmail = await call("POST", "/api/auth/forgot", null, {
    identifier: mail(),
  });
  assert.equal(unknown.status, 201);
  assert.deepEqual(
    unknown.json,
    unknownEmail.json,
    "no hint about whether an account exists",
  );
  assert.equal(
    mailer.outbox.length,
    before,
    "nothing sent for unknown identifiers",
  );
  await skipCooldown(c.userId);
  const known = await call("POST", "/api/auth/forgot", null, {
    identifier: `+91 ${c.number}`,
  });
  assert.deepEqual(known.json, unknown.json);
  assert.equal(mailer.outbox.length, before + 1);
  assert.equal(mailer.outbox.at(-1)!.to, c.email);
  assert.match(mailer.outbox.at(-1)!.subject, /reset code/);
  // An unverified account never receives a reset code.
  const unverified = await newCustomer();
  const count = mailer.outbox.length;
  await skipCooldown(unverified.userId);
  await call("POST", "/api/auth/forgot", null, {
    identifier: unverified.number,
  });
  assert.equal(mailer.outbox.length, count);
});

test("reset needs the emailed code, changes the passphrase, and signs everyone out", async () => {
  const c = await verified();
  await skipCooldown(c.userId);
  await call("POST", "/api/auth/forgot", null, { identifier: c.email });
  const code = lastCode(c.email);
  const wrong = code === "000000" ? "111111" : "000000";
  const body = (over: object) => ({
    identifier: c.number,
    code,
    password: NEW_PASS,
    ...over,
  });
  assert.equal(
    (await call("POST", "/api/auth/reset", null, body({ code: wrong }))).status,
    400,
  );
  assert.equal(
    (await call("POST", "/api/auth/reset", null, body({ password: "short" })))
      .status,
    400,
  );
  assert.equal(
    (await call("POST", "/api/auth/reset", null, body({ identifier: phone() })))
      .status,
    400,
  );
  // An old session still works until the reset succeeds.
  assert.equal((await call("GET", "/api/auth/me", c.token)).status, 200);
  const done = await call("POST", "/api/auth/reset", null, body({}));
  assert.equal(done.status, 201);
  assert.equal(
    (await call("GET", "/api/auth/me", c.token)).status,
    401,
    "old sessions are revoked",
  );
  const login = (password: string) =>
    call("POST", "/api/auth/login", null, {
      handle: c.number,
      password,
      audience: "customer",
    });
  assert.equal(
    (await login(PASS)).status,
    401,
    "old passphrase no longer works",
  );
  assert.equal((await login(NEW_PASS)).status, 201, "new passphrase works");
  assert.equal(
    (
      await call(
        "POST",
        "/api/auth/reset",
        null,
        body({ password: "yet-another-long-passphrase" }),
      )
    ).status,
    400,
    "single use",
  );
  const audit = await db.auditEvent.findFirst({
    where: { actorId: c.userId, action: "account.password_reset" },
  });
  assert.ok(audit);
  assert.ok(!JSON.stringify(audit).includes(code));
});

test("a reset code only works for its own account and is capped at five guesses", async () => {
  const a = await verified();
  const b = await verified();
  await skipCooldown(a.userId);
  await call("POST", "/api/auth/forgot", null, { identifier: a.number });
  const aCode = lastCode(a.email);
  assert.equal(
    (
      await call("POST", "/api/auth/reset", null, {
        identifier: b.number,
        code: aCode,
        password: NEW_PASS,
      })
    ).status,
    400,
  );
  const wrong = aCode === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    await call("POST", "/api/auth/reset", null, {
      identifier: a.number,
      code: wrong,
      password: NEW_PASS,
    });
  assert.equal(
    (
      await call("POST", "/api/auth/reset", null, {
        identifier: a.number,
        code: aCode,
        password: NEW_PASS,
      })
    ).status,
    400,
    "locked after too many wrong guesses",
  );
});

test("email is capped per day, and endpoints are customer-only and can be switched off", async () => {
  const c = await newCustomer();
  process.env.MAIL_DAILY_LIMIT = "1";
  await skipCooldown(c.userId);
  const capped = await call("POST", "/api/auth/email/resend", c.token);
  assert.equal(capped.status, 503);
  process.env.MAIL_DAILY_LIMIT = "1000";
  assert.equal((await call("GET", "/api/auth/me", null)).status, 401);
  assert.equal(
    (await call("POST", "/api/auth/email", null, { email: mail() })).status,
    401,
  );
  process.env.CUSTOMER_REGISTRATION = "off";
  assert.equal(
    (await call("POST", "/api/auth/forgot", null, { identifier: c.number }))
      .status,
    503,
  );
  delete process.env.CUSTOMER_REGISTRATION;
});
