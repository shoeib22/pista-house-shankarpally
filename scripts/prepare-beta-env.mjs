import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const file = new URL("../backend/.env.beta", import.meta.url);
try {
  const current = dotenv.parse(await fs.readFile(file));
  const db = new URL(current.DATABASE_URL);
  if (
    db.pathname !== "/pista_beta" ||
    current.PISTA_BETA_MODE !== "true" ||
    current.DEV_ADAPTERS !== "false"
  )
    throw new Error("Existing beta configuration requires inspection");
  console.log("Existing isolated beta configuration retained.");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  const source = dotenv.parse(
    await fs.readFile(new URL("../backend/.env", import.meta.url)),
  );
  const db = new URL(source.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(db.hostname))
    throw new Error("PC beta setup requires the local database");
  db.pathname = "/pista_beta";
  const content = `DATABASE_URL=${db.toString()}\nNODE_ENV=staging\nPISTA_BETA_MODE=true\nDEV_ADAPTERS=false\nALLOW_OWNER_BOOTSTRAP=false\nPORT=3002\nHOST=127.0.0.1\nDASHBOARD_ORIGIN=http://127.0.0.1:5174\nDELIVERY_OTP_SECRET=${randomBytes(32).toString("hex")}\n`;
  await fs.writeFile(file, content, { mode: 0o600, flag: "wx" });
  console.log(
    "Isolated beta configuration created; credentials were not printed.",
  );
}
