import fs from "node:fs/promises";
const manifest = JSON.parse(
  await fs.readFile(
    new URL("../../release/testflight-apps.json", import.meta.url),
    "utf8",
  ),
);
const app = manifest.apps[process.env.APP_ROLE];
if (
  !app ||
  app.directory !== process.env.APP_DIR ||
  app.bundleId !== process.env.BUNDLE_ID
)
  throw new Error("Workflow does not match the app manifest");
if (!/^\d+$/.test(process.env.APP_STORE_APPLE_ID || ""))
  throw new Error(
    "Configure this app's APP_STORE_APPLE_ID in its Codemagic environment group after Apple registration",
  );
if (!process.env.PISTA_API_URL) {
  console.log('No backend bundled: the internal beta will use its Beta server settings after installation.');
  process.exit(0);
}
const url = new URL(process.env.PISTA_API_URL);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname) ||
  url.search ||
  url.hash
)
  throw new Error("Configure PISTA_API_URL as the actual HTTPS beta API URL");
const base = url.toString().replace(/\/$/, "");
if(process.env.CHECK_BETA_API!=='true'){console.log('HTTPS beta URL format verified. Runtime connection can be configured after installation.');process.exit(0);}
const response = await fetch(base + "/health", {
  signal: AbortSignal.timeout(15000),
});
const health = await response.json();
if (
  !response.ok ||
  !health.beta ||
  health.development ||
  health.payments !== "beta_simulated"
)
  throw new Error(
    "Refusing a build that is not connected to the isolated beta API",
  );
const dev = await fetch(base + "/auth/development", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identity: "owner" }),
  signal: AbortSignal.timeout(15000),
});
if (dev.status !== 503)
  throw new Error("Public development identity access must be disabled");
const orders = await fetch(base + "/orders", {
  signal: AbortSignal.timeout(15000),
});
if (orders.status !== 401)
  throw new Error("Unauthenticated order access was not denied");
console.log(
  "Verified isolated HTTPS beta API and disabled anonymous development access.",
);
