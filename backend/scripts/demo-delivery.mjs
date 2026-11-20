import { randomUUID } from "node:crypto";
const base = process.env.API_URL || "http://127.0.0.1:3001/api";
async function call(path, method = "GET", body, token, key) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Request failed");
  return data;
}
if (!(await call("/health")).development)
  throw new Error("Sample deliveries require explicit development mode");
const customer = (
    await call("/auth/development", "POST", { identity: "customer" })
  ).token,
  counter = (await call("/auth/development", "POST", { identity: "counter" }))
    .token,
  rider = (await call("/auth/development", "POST", { identity: "rider" }))
    .token;
await call("/rider/availability", "PATCH", { available: true }, rider);
for (const stage of ["ready", "picked_up"]) {
  let order = await call(
    "/orders",
    "POST",
    {
      fulfilment: "delivery",
      items: [{ productId: "chicken-biryani", quantity: 1 }],
      deliveryAddress: {
        recipient: "Sample recipient",
        phone: "9000000000",
        line1: "Sample address · development only",
        city: "Sample city",
        postalCode: "000000",
        landmark: "Not a real delivery",
      },
    },
    customer,
    randomUUID(),
  );
  order = await call(
    `/orders/${order.id}/development-payment`,
    "POST",
    { eventId: randomUUID() },
    customer,
  );
  for (const action of ["accept", "prepare", "ready"])
    order = await call(
      `/orders/${order.id}/actions`,
      "POST",
      { action, version: order.version },
      counter,
    );
  if (stage === "picked_up") {
    const a = await call(
      `/orders/${order.id}/assignment`,
      "POST",
      { riderId: "dev-rider", version: order.version },
      counter,
    );
    await call(
      `/rider/tasks/${a.id}/actions`,
      "POST",
      { action: "pickup", version: a.version },
      rider,
    );
  }
  console.log(
    `Sample delivery #PH${String(order.number).padStart(4, "0")} · ${stage} · zone 000000 · test payment`,
  );
}
for (const token of [customer, counter, rider])
  await call("/session", "DELETE", undefined, token);
