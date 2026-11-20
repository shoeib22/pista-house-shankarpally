import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
export type Role = "customer" | "counter" | "kitchen" | "rider" | "owner";
export type Permission =
  | "orders:read"
  | "orders:accept"
  | "orders:prepare"
  | "orders:collect"
  | "menu:write"
  | "outlet:pause"
  | "audit:read"
  | "reports:read"
  | "delivery:dispatch"
  | "users:manage";
const permissions: Record<Role, Permission[]> = {
  customer: [],
  rider: [],
  kitchen: ["orders:read", "orders:prepare"],
  counter: [
    "orders:read",
    "orders:accept",
    "orders:prepare",
    "orders:collect",
    "delivery:dispatch",
    "menu:write",
    "audit:read",
  ],
  owner: [
    "orders:read",
    "orders:accept",
    "orders:prepare",
    "orders:collect",
    "delivery:dispatch",
    "menu:write",
    "audit:read",
    "outlet:pause",
    "reports:read",
    "users:manage",
  ],
};
export function permit(role: string, permission: Permission) {
  if (!permissions[role as Role]?.includes(permission))
    throw new ForbiddenException("Your role does not permit this action");
}
export function customerOnly(role: string) {
  if (role !== "customer")
    throw new ForbiddenException("Customer access required");
}
export function nextStatus(
  status: string,
  payment: string,
  action: string,
  role: string,
  fulfilment: string,
  reason?: string,
) {
  const transition: Record<
    string,
    { from: string[]; to: string; permission: Permission }
  > = {
    accept: {
      from: ["awaiting_acceptance"],
      to: "accepted",
      permission: "orders:accept",
    },
    reject: {
      from: ["awaiting_acceptance"],
      to: "rejected",
      permission: "orders:accept",
    },
    prepare: {
      from: ["accepted"],
      to: "preparing",
      permission: "orders:prepare",
    },
    ready: { from: ["preparing"], to: "ready", permission: "orders:prepare" },
    collect: { from: ["ready"], to: "collected", permission: "orders:collect" },
  };
  const t = transition[action];
  if (!t) throw new BadRequestException("Unsupported order action");
  permit(role, t.permission);
  if (payment !== "paid")
    throw new ConflictException("Verified payment is required");
  if (!t.from.includes(status))
    throw new ConflictException("Order changed; refresh before retrying");
  if (action === "collect" && fulfilment !== "pickup")
    throw new ConflictException("Only pickup orders can be collected");
  if (action === "reject" && !reason?.trim())
    throw new BadRequestException("A rejection reason is required");
  return t.to;
}
export function priceItems(
  products: {
    id: string;
    name: string;
    pricePaise: number;
    available: boolean;
  }[],
  items: { productId: string; quantity: number }[],
) {
  const snapshots = items.map((item) => {
    const p = products.find((p) => p.id === item.productId);
    if (!p || !p.available)
      throw new ConflictException("An item is unavailable");
    return {
      productId: p.id,
      name: p.name,
      quantity: item.quantity,
      unitPaise: p.pricePaise,
    };
  });
  const subtotalPaise = snapshots.reduce(
    (s, i) => s + i.unitPaise * i.quantity,
    0,
  );
  if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise > 10000000)
    throw new BadRequestException("Order total exceeds permitted limit");
  // Development catalogue has tax-inclusive illustrative prices; production rules are not agreed.
  return {
    items: snapshots,
    subtotalPaise,
    taxPaise: 0,
    deliveryPaise: 0,
    totalPaise: subtotalPaise,
  };
}
