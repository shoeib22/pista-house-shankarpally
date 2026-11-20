import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStatus, permit, priceItems } from "../src/domain";
test("customer, rider and kitchen permissions cannot escalate to owner actions", () => {
  for (const role of ["customer", "rider", "counter", "kitchen"])
    assert.throws(() => permit(role, "outlet:pause"));
  assert.throws(() => permit("kitchen", "orders:accept"));
  assert.doesNotThrow(() => permit("owner", "outlet:pause"));
});
test("payment and fulfilment transition guards", () => {
  assert.throws(() =>
    nextStatus("awaiting_acceptance", "pending", "accept", "counter", "pickup"),
  );
  assert.equal(
    nextStatus("awaiting_acceptance", "paid", "accept", "counter", "pickup"),
    "accepted",
  );
  assert.throws(() =>
    nextStatus("accepted", "paid", "ready", "kitchen", "pickup"),
  );
  assert.throws(() =>
    nextStatus("ready", "paid", "collect", "counter", "delivery"),
  );
  assert.throws(() =>
    nextStatus("awaiting_acceptance", "paid", "reject", "counter", "pickup"),
  );
  assert.equal(
    nextStatus(
      "awaiting_acceptance",
      "paid",
      "reject",
      "counter",
      "pickup",
      "Unavailable",
    ),
    "rejected",
  );
});
test("totals use authoritative integer paise and preserve item snapshots", () => {
  const product = {
    id: "x",
    name: "Sample biryani",
    pricePaise: 29900,
    available: true,
  };
  const priced = priceItems([product], [{ productId: "x", quantity: 2 }]);
  product.name = "New name";
  product.pricePaise = 1;
  assert.equal(priced.totalPaise, 59800);
  assert.equal(priced.items[0].name, "Sample biryani");
  assert.throws(() =>
    priceItems(
      [{ ...product, available: false }],
      [{ productId: "x", quantity: 1 }],
    ),
  );
  assert.throws(() => priceItems([], [{ productId: "missing", quantity: 1 }]));
});
