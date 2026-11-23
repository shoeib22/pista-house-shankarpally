// Test files run in separate processes against one shared database. A live
// notification poller or campaign timer in one process would react to another
// file's orders, so every test process starts with them off. The notification
// tests drive the engine by hand.
process.env.NOTIFICATIONS_POLL_DISABLED ??= "true";
process.env.NOTIFICATIONS_CAMPAIGNS_DISABLED ??= "true";
// Likewise the background dispatcher: it works on every outlet with auto-dispatch
// on, so another file's running copy could grab a dispatch test's orders.
process.env.DISPATCH_DISABLED ??= "true";
process.env.SUPPORT_SWEEP_DISABLED ??= "true";
process.env.PAYMENTS_SWEEP_DISABLED ??= "true";
// Tests use their own database (create it with `npm run test:db`), so they never
// share rows, cursors or background pollers with the running beta server.
import fs from "node:fs";
try {
  const line = fs
    .readFileSync(".env.beta", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (line && !process.env.TEST_DATABASE_URL) {
    const u = new URL(line.slice("DATABASE_URL=".length).replace(/^"|"$/g, ""));
    u.pathname = "/pista_test";
    process.env.TEST_DATABASE_URL = u.toString();
  }
} catch {
  /* fall back to whatever the tests load themselves */
}
