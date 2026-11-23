// Creates (if needed) and migrates the separate database the automated tests use,
// so they never share data or background pollers with the running beta server.
import fs from "node:fs";
import { execSync } from "node:child_process";
import pg from "pg";
const env = Object.fromEntries(
  fs.readFileSync(".env.beta", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const url = new URL(env.DATABASE_URL);
const name = "pista_test";
const admin = new URL(url);
admin.pathname = "/postgres";
const c = new pg.Client({ connectionString: admin.toString() });
await c.connect();
const has = await c.query("select 1 from pg_database where datname=$1", [name]);
if (!has.rowCount) await c.query(`create database ${name}`);
await c.end();
url.pathname = "/" + name;
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url.toString() } });
console.log("Test database ready:", name);
