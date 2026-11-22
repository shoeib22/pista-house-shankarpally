import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { passwordHash, passwordMatches } from "../src/accounts/passwords";
import { validateRuntime, betaEnabled } from "../src/runtime";
import { sampleCatalogue } from "./sample-catalogue";
async function main() {
  validateRuntime();
  if (!betaEnabled())
    throw new Error("Explicit isolated beta mode is required");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const directory = path.resolve("../tmp/testflight");
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, "beta-test-accounts.json");
  let saved: { accounts: { role: string; handle: string; password: string }[] };
  try {
    saved = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
    saved = { accounts: [] };
  }
  try {
    await db.outlet.upsert({
      where: { id: "shankarpally" },
      update: {},
      create: {
        id: "shankarpally",
        name: "Pista House Shankarpally · TEST ONLY",
        latitude: 17.4538158,
        longitude: 78.1410641,
      },
    });
    for (const product of sampleCatalogue)
      await db.product.upsert({
        where: { id: product.id },
        update: {},
        create: { ...product, outletId: "shankarpally" },
      });
    await db.deliveryZone.upsert({
      where: {
        outletId_postalCode: { outletId: "shankarpally", postalCode: "000000" },
      },
      update: {},
      create: {
        outletId: "shankarpally",
        postalCode: "000000",
        name: "Beta sample zone · not a real service area",
        deliveryPaise: 2000,
        developmentOnly: true,
      },
    });
    for (const role of ["owner", "customer", "rider", "counter", "kitchen"]) {
      const handle = `pista.beta.${role}`;
      let account = saved.accounts.find((a) => a.handle === handle);
      if (!account) {
        account = {
          role,
          handle,
          password: randomBytes(18).toString("base64url"),
        };
        saved.accounts.push(account);
        await fs.writeFile(file, JSON.stringify(saved, null, 2) + "\n", {
          mode: 0o600,
        });
      }
      const existing = await db.credential.findUnique({
        where: { handle },
        include: { user: true },
      });
      if (existing) {
        if (
          existing.user.id !== `beta-${role}` ||
          existing.user.outletId !== "shankarpally" ||
          existing.user.role !== role ||
          !(await passwordMatches(account.password, existing.passwordHash))
        )
          throw new Error(
            "Existing beta account does not match the private local record",
          );
        continue;
      }
      const encoded = await passwordHash(account.password);
      await db.user.create({
        data: {
          id: `beta-${role}`,
          outletId: "shankarpally",
          name: `Beta ${role} · TEST ONLY`,
          role,
          riderAvailable: role === "rider",
          credential: { create: { handle, passwordHash: encoded } },
        },
      });
    }
    console.log(
      "Beta sample catalogue and five private test accounts are ready. Details are in the ignored local account file; no passwords were printed.",
    );
  } finally {
    await db.$disconnect();
  }
}
void main().catch((e: any) => {
  console.error("Isolated beta setup failed:", e.code || e.name);
  process.exitCode = 1;
});
