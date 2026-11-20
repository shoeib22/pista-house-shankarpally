import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
// Fixed, versioned parameters: 128 MiB per hash. Bound concurrency on one physical host.
const N = 131072,
  r = 8,
  p = 1;
let active = 0;
async function derive(password: string, salt: string): Promise<Buffer> {
  if (active >= 2)
    throw new ServiceUnavailableException(
      "Sign-in is busy. Please retry shortly.",
    );
  active++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        Buffer.from(salt, "hex"),
        64,
        { N, r, p, maxmem: 256 * 1024 * 1024 },
        (err, key) => (err ? reject(err) : resolve(key)),
      ),
    );
  } finally {
    active--;
  }
}
export const dummyPasswordHash = `scrypt-v1$${N}$${r}$${p}$${"00".repeat(16)}$${"00".repeat(64)}`;
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${N}$${r}$${p}$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function passwordMatches(password: string, stored: string) {
  const parts = stored.split("$");
  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt-v1" ||
    parts[1] !== String(N) ||
    parts[2] !== String(r) ||
    parts[3] !== String(p) ||
    !/^[a-f0-9]{32}$/.test(parts[4]) ||
    !/^[a-f0-9]{128}$/.test(parts[5])
  )
    return false;
  const actual = await derive(password, parts[4]);
  return timingSafeEqual(actual, Buffer.from(parts[5], "hex"));
}
