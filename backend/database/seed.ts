import "dotenv/config";
import { sampleCatalogue } from "./sample-catalogue";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function seed() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DEV_ADAPTERS !== "true"
  )
    throw new Error(
      "Sample seeding requires development mode and DEV_ADAPTERS=true",
    );
  await db.outlet.upsert({
    where: { id: "shankarpally" },
    update: {},
    create: { id: "shankarpally", name: "Pista House · Shankarpally" },
  });
  for (const role of [
    "customer",
    "customer2",
    "counter",
    "kitchen",
    "owner",
    "rider",
  ])
    await db.user.upsert({
      where: { id: `dev-${role}` },
      update: { developmentOnly: true },
      create: {
        id: `dev-${role}`,
        outletId: "shankarpally",
        name: `Sample ${role}`,
        developmentOnly: true,
        role: role === "customer2" ? "customer" : role,
      },
    });
  const products = sampleCatalogue;
  for (const p of products)
    await db.product.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, outletId: "shankarpally" },
    });
  console.log(
    "Development identities and illustrative menu seeded. No orders or live restaurant data seeded.",
  );
  await db.deliveryZone.upsert({
    where: {
      outletId_postalCode: { outletId: "shankarpally", postalCode: "000000" },
    },
    update: {},
    create: {
      outletId: "shankarpally",
      postalCode: "000000",
      name: "Development sample zone · not a real service area",
      deliveryPaise: 2000,
      developmentOnly: true,
      approved: false,
    },
  });
  await db.user.upsert({
    where: { id: "dev-rider2" },
    update: { developmentOnly: true },
    create: {
      id: "dev-rider2",
      outletId: "shankarpally",
      name: "Sample rider 2",
      developmentOnly: true,
      role: "rider",
    },
  });
}
seed().finally(() => db.$disconnect());
