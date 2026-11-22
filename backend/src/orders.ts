import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Database } from "./database";
import { Actor, hash, developmentEnabled } from "./auth";
import { customerOnly, nextStatus, permit, priceItems } from "./domain";
import { betaEnabled } from "./runtime";
export const checkout = z
  .object({
    fulfilment: z.enum(["pickup", "delivery"]),
    deliveryAddress: z
      .object({
        recipient: z.string().trim().min(2).max(100),
        phone: z.string().regex(/^[6-9]\d{9}$/),
        line1: z.string().trim().min(5).max(250),
        city: z.string().trim().min(2).max(80),
        postalCode: z.string().regex(/^\d{6}$/),
        landmark: z.string().trim().max(150).optional(),
        latitude: z.number().finite().min(-90).max(90).optional(),
        longitude: z.number().finite().min(-180).max(180).optional(),
      })
      .strict()
      .refine(
        (a) => (a.latitude === undefined) === (a.longitude === undefined),
        "Both map coordinates are required",
      )
      .optional(),
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.fulfilment === "delivery" && !body.deliveryAddress)
      ctx.addIssue({
        code: "custom",
        message: "A delivery address is required",
      });
    if (body.fulfilment === "pickup" && body.deliveryAddress)
      ctx.addIssue({
        code: "custom",
        message: "Pickup orders do not require a delivery address",
      });
  });
export const assignmentSummary = {
  id: true,
  riderId: true,
  status: true,
  isActive: true,
  version: true,
  createdAt: true,
  rider: { select: { name: true } },
  failureReason: true,
};
export const include = {
  items: true,
  events: { orderBy: { createdAt: "asc" as const } },
  assignments: {
    select: assignmentSummary,
    orderBy: { createdAt: "desc" as const },
  },
};
@Injectable()
export class Orders {
  constructor(@Inject(Database) private db: Database) {}
  async list(actor: Actor) {
    if (actor.role !== "customer") permit(actor.role, "orders:read");
    const orders = await this.db.order.findMany({
      where: {
        outletId: actor.outletId,
        ...(actor.role === "customer" ? { customerId: actor.id } : {}),
      },
      include,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return actor.role === "kitchen"
      ? orders.map(({ deliveryAddress, ...order }) => order)
      : orders;
  }
  async create(actor: Actor, raw: unknown, key: string) {
    customerOnly(actor.role);
    if (!key || key.length > 128)
      throw new BadRequestException("A valid Idempotency-Key is required");
    const parsed = checkout.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    const body = parsed.data,
      requestHash = hash(JSON.stringify(body));
    const existing = await this.db.order.findUnique({
      where: {
        customerId_idempotencyKey: {
          customerId: actor.id,
          idempotencyKey: key,
        },
      },
      include,
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictException(
          "Idempotency key already used for different items",
        );
      return existing;
    }
    try {
      return await this.db.$transaction(
        async (tx) => {
          const outlet = await tx.outlet.findUniqueOrThrow({
            where: { id: actor.outletId },
          });
          if (outlet.paused)
            throw new ConflictException("The outlet has paused new orders");
          const products = await tx.product.findMany({
            where: {
              outletId: actor.outletId,
              id: { in: body.items.map((i) => i.productId) },
            },
          });
          const { items, ...totals } = priceItems(products, body.items);
          if (body.fulfilment === "delivery") {
            if (
              !process.env.DELIVERY_OTP_SECRET ||
              process.env.DELIVERY_OTP_SECRET.length < 32
            )
              throw new ServiceUnavailableException(
                "Delivery verification is not configured",
              );
            const zone = await tx.deliveryZone.findUnique({
              where: {
                outletId_postalCode: {
                  outletId: actor.outletId,
                  postalCode: body.deliveryAddress!.postalCode,
                },
              },
            });
            if (
              !zone ||
              !zone.active ||
              (!zone.developmentOnly && !zone.approved) ||
              (zone.developmentOnly && !developmentEnabled() && !betaEnabled())
            )
              throw new ConflictException(
                "This address is outside the approved delivery zones",
              );
            totals.deliveryPaise = zone.deliveryPaise;
            totals.totalPaise += zone.deliveryPaise;
          }
          const order = await tx.order.create({
            data: {
              outletId: actor.outletId,
              customerId: actor.id,
              idempotencyKey: key,
              requestHash,
              fulfilment: body.fulfilment,
              ...(body.deliveryAddress
                ? { deliveryAddress: body.deliveryAddress }
                : {}),
              ...totals,
              items: { create: items },
              events: { create: { actorId: actor.id, action: "created" } },
            },
            include,
          });
          await tx.auditEvent.create({
            data: {
              outletId: actor.outletId,
              actorId: actor.id,
              action: "order.created",
              resourceId: order.id,
            },
          });
          return order;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const order = await this.db.order.findUniqueOrThrow({
          where: {
            customerId_idempotencyKey: {
              customerId: actor.id,
              idempotencyKey: key,
            },
          },
          include,
        });
        if (order.requestHash !== requestHash)
          throw new ConflictException("Idempotency key already used");
        return order;
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034"
      )
        throw new ConflictException(
          "Catalogue changed; retry with the same idempotency key",
        );
      throw e;
    }
  }
  async payDevelopment(
    actor: Actor,
    id: string,
    eventId: string,
    provider: "development" | "beta_simulated" = "development",
  ) {
    customerOnly(actor.role);
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, customerId: actor.id, outletId: actor.outletId },
      });
      if (!order) throw new NotFoundException("Order not found");
      const previous = await tx.paymentEvent.findUnique({
        where: { id: eventId },
      });
      if (previous) {
        if (previous.orderId !== id)
          throw new ConflictException("Event already belongs to another order");
        return tx.order.findUniqueOrThrow({ where: { id }, include });
      }
      const changed = await tx.order.updateMany({
        where: { id, paymentStatus: "pending", version: order.version },
        data: { paymentStatus: "paid", version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException("Payment state changed; refresh");
      await tx.paymentEvent.create({
        data: {
          id: eventId,
          orderId: id,
          provider,
          amountPaise: order.totalPaise,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          actorId: actor.id,
          action: `${provider}.payment_verified`,
        },
      });
      await tx.outboxEvent.create({
        data: {
          outletId: actor.outletId,
          kind: "order.paid",
          resourceId: id,
          payload: { orderId: id },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include });
    });
  }
  async action(actor: Actor, id: string, raw: unknown) {
    const parsed = z
      .object({
        action: z.enum(["accept", "reject", "prepare", "ready", "collect"]),
        version: z.number().int().nonnegative(),
        reason: z.string().trim().min(1).max(300).optional(),
      })
      .strict()
      .safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException(
        "A valid action, version and optional reason are required",
      );
    const { action, version, reason } = parsed.data;
    // Check permission before disclosing whether the requested order exists.
    permit(
      actor.role,
      action === "accept" || action === "reject"
        ? "orders:accept"
        : action === "collect"
          ? "orders:collect"
          : "orders:prepare",
    );
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, outletId: actor.outletId },
      });
      if (!order) throw new NotFoundException("Order not found");
      const status = nextStatus(
        order.status,
        order.paymentStatus,
        action,
        actor.role,
        order.fulfilment,
        reason,
      );
      const changed = await tx.order.updateMany({
        where: { id, version },
        data: { status, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException("Order changed; refresh before retrying");
      await tx.orderEvent.create({
        data: { orderId: id, actorId: actor.id, action, reason },
      });
      await tx.auditEvent.create({
        data: {
          outletId: actor.outletId,
          actorId: actor.id,
          action: `order.${action}`,
          resourceId: id,
          detail: reason,
        },
      });
      // Rejection records the need for reconciliation; it never pretends to refund the payment.
      await tx.outboxEvent.create({
        data: {
          outletId: actor.outletId,
          kind:
            action === "reject" ? "refund.review_required" : "order.updated",
          resourceId: id,
          payload: { status },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include });
    });
  }
}
