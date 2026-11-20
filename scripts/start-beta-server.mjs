import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const root = fileURLToPath(new URL("../", import.meta.url)),
  directory = path.join(root, "tmp/testflight");
await fs.mkdir(directory, { recursive: true });
const stateFile = path.join(directory, "runtime.json");
try {
  const old = JSON.parse(await fs.readFile(stateFile, "utf8"));
  if (old.pid) {
    try {
      process.kill(old.pid, 0);
      throw new Error("A beta supervisor is already running");
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const children = [];
const logs = [];
process.on("exit", () => {
  for (const child of children) child.kill();
});
async function launch(name, exe, args, options = {}) {
  const child = spawn(exe, args, {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  children.push(child);
  const handle = await fs.open(path.join(directory, `${name}.log`), "a");
  logs.push(handle);
  child.stdout.on("data", (chunk) => void handle.write(chunk));
  child.stderr.on("data", (chunk) => void handle.write(chunk));
  child.on("error", (e) =>
    console.error(`${name} could not start: ${e.code || e.name}`),
  );
  return child;
}
const betaEnvironment = dotenv.parse(
  await fs.readFile(path.join(root, "backend/.env.beta")),
);
const api = await launch(
  "api",
  process.execPath,
  ["--env-file=.env.beta", "dist/main.js"],
  {
    cwd: path.join(root, "backend"),
    env: { ...process.env, ...betaEnvironment },
  },
);
let ready = false;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch("http://127.0.0.1:3002/api/health", {
      signal: AbortSignal.timeout(2000),
    });
    const h = await r.json();
    if (r.ok && h.beta === true && h.payments === "beta_simulated") {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!ready) throw new Error("Isolated beta API did not become ready");
const web = await launch(
  "dashboard",
  process.execPath,
  [
    path.join(root, "node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5174",
    "--strictPort",
  ],
  {
    cwd: path.join(root, "apps/employee_dashboard"),
    env: { ...process.env, PISTA_API_PROXY: "http://127.0.0.1:3002" },
  },
);
const tunnel = await launch(
  "tunnel",
  process.env.CLOUDFLARED_EXE ||
    "C:/Program Files (x86)/cloudflared/cloudflared.exe",
  [
    "tunnel",
    "--no-autoupdate",
    "--url",
    "http://127.0.0.1:3002",
    "--protocol",
    "http2",
  ],
);
const runtimeState = {
  pid: process.pid,
  apiPid: api.pid,
  webPid: web.pid,
  tunnelPid: tunnel.pid,
  startedAt: new Date().toISOString(),
};
let saves = Promise.resolve();
function persistState(patch) {
  Object.assign(runtimeState, patch);
  const data = JSON.stringify(runtimeState, null, 2) + "\n";
  saves = saves.then(async () => {
    await fs.writeFile(stateFile + ".tmp", data);
    await fs.rename(stateFile + ".tmp", stateFile);
  });
  return saves;
}
let publicUrl;
const capture = (chunk) => {
  const found = chunk
    .toString()
    .match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (found && !publicUrl) {
    publicUrl = found[0];
    void persistState({
      apiUrl: publicUrl + "/api",
      dashboardUrl: "http://127.0.0.1:5174",
    });
    console.log("Beta HTTPS API:", publicUrl + "/api");
  }
};
tunnel.stdout.on("data", capture);
tunnel.stderr.on("data", capture);
await persistState({});
console.log("Isolated PC beta server started. Keep this PC awake and online.");
const cleanup = () => {
  for (const child of children) child.kill();
  for (const log of logs) void log.close();
};
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
