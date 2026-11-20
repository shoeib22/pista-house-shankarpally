import "reflect-metadata";
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { passwordHash } from "../src/accounts/passwords";
import { handleSchema, passwordSchema } from "../src/accounts/accounts";
import { z } from "zod";
export async function bootstrapOwner(
  db: PrismaClient,
  body: unknown,
  outletId = "shankarpally",
) {
  const input = z
    .object({
      handle: handleSchema,
      password: passwordSchema,
      name: z.string().trim().min(2).max(100),
    })
    .strict()
    .parse(body);
  const encoded = await passwordHash(input.password);
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Outlet" WHERE "id"=${outletId} FOR UPDATE`;
    if (!rows.length)
      throw new Error("Configure the Shankarpally outlet before owner setup");
    if (
      await tx.credential.count({
        where: { user: { outletId, role: "owner", disabledAt: null } },
      })
    )
      throw new Error(
        "An owner password account already exists. Bootstrap is closed.",
      );
    const user = await tx.user.create({
      data: {
        name: input.name,
        outletId,
        role: "owner",
        credential: { create: { handle: input.handle, passwordHash: encoded } },
      },
    });
    await tx.auditEvent.create({
      data: {
        outletId,
        actorId: user.id,
        resourceId: user.id,
        action: "account.owner_bootstrapped",
      },
    });
    return { id: user.id, handle: input.handle };
  });
}
async function main() {
  if (process.env.ALLOW_OWNER_BOOTSTRAP !== "true")
    throw new Error(
      "Owner bootstrap is disabled. Enable ALLOW_OWNER_BOOTSTRAP only for initial local setup.",
    );
  if (!process.stdin.isTTY)
    throw new Error(
      "Run owner bootstrap in a trusted interactive terminal. Passwords are not accepted in command arguments, files or environment variables.",
    );
  let hidden = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!hidden) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  let input;
  try {
    const name = await rl.question("Owner display name: "),
      handle = await rl.question("Owner sign-in handle: ");
    process.stdout.write("Passphrase (12–128 characters): ");
    hidden = true;
    const password = await rl.question("");
    hidden = false;
    process.stdout.write("\n");
    process.stdout.write("Confirm passphrase: ");
    hidden = true;
    const confirmation = await rl.question("");
    hidden = false;
    process.stdout.write("\n");
    if (password !== confirmation) throw new Error("Passphrases do not match");
    input = { name, handle, password };
  } finally {
    hidden = false;
    rl.close();
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await bootstrapOwner(db, input);
    process.stdout.write(
      "Owner account created. Disable ALLOW_OWNER_BOOTSTRAP before serving the application.\n",
    );
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/bootstrap-owner.ts"))
  void main().catch(() => {
    process.stderr.write(
      "Owner setup did not complete. Check the bootstrap setting, passphrase policy and whether an owner already exists.\n",
    );
    process.exitCode = 1;
  });
