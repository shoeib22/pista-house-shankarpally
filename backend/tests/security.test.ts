import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { createRateLimiter, securityHeaders } from "../src/security";

async function serve(setup: (app: express.Express) => void) {
  const app = express();
  setup(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => server.close() };
}

test("every response carries the hardening headers", async () => {
  const s = await serve((app) => {
    app.use(securityHeaders);
    app.get("/api/x", (_q, r) => void r.json({ ok: true }));
  });
  try {
    const r = await fetch(s.base + "/api/x");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.match(r.headers.get("content-security-policy")!, /default-src 'none'/);
    assert.ok(r.headers.get("strict-transport-security"));
    assert.equal(r.headers.get("referrer-policy"), "no-referrer");
  } finally {
    s.close();
  }
});

test("rate limiter: anonymous callers are capped lower than signed-in ones and recover", async () => {
  let clock = 1_000;
  const s = await serve((app) => {
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        anonymousMax: 3,
        signedInMax: 5,
        now: () => clock,
        skip: ["/api/payments/webhook/"],
      }),
    );
    app.all("/{*path}", (_q, r) => void r.json({ ok: true }));
  });
  try {
    const codes = async (path: string, headers: Record<string, string> = {}) => {
      const out: number[] = [];
      for (let i = 0; i < 7; i++) out.push((await fetch(s.base + path, { headers })).status);
      return out;
    };
    assert.deepEqual(await codes("/api/menu"), [200, 200, 200, 429, 429, 429, 429]);
    const blocked = await fetch(s.base + "/api/menu");
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
    assert.deepEqual(
      await codes("/api/orders", { authorization: "Bearer abc" }),
      [200, 200, 200, 200, 200, 429, 429],
      "signed-in callers get their own, higher ceiling",
    );
    assert.deepEqual(
      await codes("/api/payments/webhook/razorpay"),
      [200, 200, 200, 200, 200, 200, 200],
      "signed gateway callbacks are never throttled here",
    );
    assert.deepEqual(await codes("/socket.io/"), [200, 200, 200, 200, 200, 200, 200]);
    clock += 61_000;
    assert.equal((await fetch(s.base + "/api/menu")).status, 200, "window resets");
  } finally {
    s.close();
  }
});
