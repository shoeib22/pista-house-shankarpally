import { randomUUID } from "node:crypto";
const base = process.env.API_URL || "http://127.0.0.1:3001/api";
async function call(path, body, token, key) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
if (!(await call("/health")).development)
  throw new Error(
    "Refusing to create sample orders outside explicit development mode",
  );
const customer = (await call("/auth/development", { identity: "customer" }))
  .token;
const counter = (await call("/auth/development", { identity: "counter" }))
  .token;
for (const stage of ["new", "preparing", "ready"]) {
  let order = await call(
    "/orders",
    {
      fulfilment: "pickup",
      items: [
        { productId: "chicken-biryani", quantity: stage === "new" ? 2 : 1 },
      ],
    },
    customer,
    randomUUID(),
  );
  order = await call(
    `/orders/${order.id}/development-payment`,
    { eventId: randomUUID() },
    customer,
  );
  if (stage !== "new")
    for (const action of stage === "ready"
      ? ["accept", "prepare", "ready"]
      : ["accept", "prepare"])
      order = await call(
        `/orders/${order.id}/actions`,
        { action, version: order.version },
        counter,
      );
  console.log(
    `Sample pickup #PH${String(order.number).padStart(4, "0")} · ${order.status} · development payment only`,
  );
}
