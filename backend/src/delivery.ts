import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Database } from "./database";
import { Actor } from "./auth";
import { customerOnly, permit } from "./domain";
import { assignmentSummary } from "./orders";
const versionBody = z
  .object({ version: z.number().int().nonnegative() })
  .strict();
const riderOnly = (actor: Actor) => {
  if (actor.role !== "rider")
    throw new ForbiddenException("Rider access required");
};
const secret = () => {
  const value = process.env.DELIVERY_OTP_SECRET;
  if (!value || value.length < 32)
    throw new ServiceUnavailableException(
      "Delivery verification is not configured",
    );
  return value;
};
const digest = (id: string, salt: string, code: string) =>
  createHmac("sha256", secret()).update(`${id}:${salt}:${code}`).digest("hex");
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const value = schema.safeParse(body);
  if (!value.success)
    throw new BadRequestException(
      value.error.issues.map((i) => i.message).join("; "),
    );
  return value.data;
}
@Injectable()
export class Delivery {
  constructor(@Inject(Database) private db: Database) {}
  async riders(actor: Actor) {
    permit(actor.role, "delivery:dispatch");
    return this.db.user.findMany({
      where: { outletId: actor.outletId, role: "rider" },
      select: { id: true, name: true, riderAvailable: true },
    });
  }
  async availability(actor: Actor, body: unknown) {
    riderOnly(actor);
    const { available } = parse(
      z.object({ available: z.boolean() }).strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: actor.id,
          outletId: actor.outletId,
          disabledAt: null,
          authVersion: actor.authVersion ?? 0,
        },
        data: { riderAvailable: available },
      });
      if (!changed.count)
        throw new UnauthorizedException("Account changed; sign in again");
      return tx.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { id: true, name: true, riderAvailable: true },
      });
    });
  }
  async tasks(actor: Actor) {
    riderOnly(actor);
    const [user, tasks] = await Promise.all([
      this.db.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { riderAvailable: true },
      }),
      this.db.deliveryAssignment.findMany({
        where: { riderId: actor.id, order: { outletId: actor.outletId } },
        select: {
          ...assignmentSummary,
          order: {
            select: {
              id: true,
              number: true,
              status: true,
              paymentStatus: true,
              totalPaise: true,
              deliveryAddress: true,
              items: { select: { name: true, quantity: true } },
              createdAt: true,
            },
          },
          events: {
            select: { action: true, reason: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      available: user.riderAvailable,
      tasks: tasks.map((t) => ({
        ...t,
        order: {
          ...t.order,
          deliveryAddress:
            t.isActive && ["assigned", "picked_up"].includes(t.status)
              ? t.order.deliveryAddress
              : null,
        },
      })),
    };
  }
  async assign(actor: Actor, orderId: string, body: unknown) {
    permit(actor.role, "delivery:dispatch");
    const { riderId, version } = parse(
      z
        .object({
          riderId: z.string().min(1),
          version: z.number().int().nonnegative(),
        })
        .strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, outletId: actor.outletId },
      });
      if (!order) throw new NotFoundException("Order not found");
      if (
        order.fulfilment !== "delivery" ||
        order.status !== "ready" ||
        order.paymentStatus !== "paid"
      )
        throw new ConflictException(
          "Only paid, ready delivery orders can be assigned",
        );
      const rider = await tx.user.findFirst({
        where: {
          id: riderId,
          outletId: actor.outletId,
          role: "rider",
          riderAvailable: true,
          disabledAt: null,
        },
      });
      if (!rider)
        throw new ConflictException("Select an available outlet rider");
      const lockedRider = await tx.user.updateMany({
        where: {
          id: riderId,
          outletId: actor.outletId,
          role: "rider",
          disabledAt: null,
          riderAvailable: true,
        },
        data: { riderAvailable: true },
      });
      if (!lockedRider.count)
        throw new ConflictException("Select an available outlet rider");
      const changed = await tx.order.updateMany({
        where: { id: orderId, version, status: "ready" },
        data: { version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException("Order changed; refresh before assigning");
      if (
        await tx.deliveryAssignment.findFirst({
          where: { orderId, isActive: true },
        })
      )
        throw new ConflictException(
          "This order already has an active assignment",
        );
      const assignment = await tx.deliveryAssignment.create({
        data: {
          orderId,
          riderId,
          events: { create: { actorId: actor.id, action: "assigned" } },
        },
        select: assignmentSummary,
      });
      await this.record(tx, actor, orderId, "delivery.assigned", assignment.id);
      return assignment;
    });
  }
  async staffAction(actor: Actor, id: string, body: unknown) {
    permit(actor.role, "delivery:dispatch");
    const { action, version } = parse(
      z
        .object({
          action: z.enum(["unassign", "confirm_return"]),
          version: z.number().int().nonnegative(),
        })
        .strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const a = await tx.deliveryAssignment.findFirst({
        where: { id, order: { outletId: actor.outletId } },
        include: { order: true },
      });
      if (!a) throw new NotFoundException("Assignment not found");
      const expected = action === "unassign" ? "assigned" : "failed";
      if (!a.isActive || a.status !== expected)
        throw new ConflictException(
          "Assignment changed; refresh before continuing",
        );
      const status = action === "unassign" ? "unassigned" : "returned";
      const changed = await tx.deliveryAssignment.updateMany({
        where: { id, version, isActive: true, status: expected },
        data: {
          status,
          isActive: false,
          version: { increment: 1 },
          otpHash: null,
          otpSalt: null,
        },
      });
      if (!changed.count)
        throw new ConflictException("Assignment changed; refresh");
      const changedOrder = await tx.order.updateMany({
        where: {
          id: a.orderId,
          version: a.order.version,
          status: action === "unassign" ? "ready" : "delivery_failed",
        },
        data: {
          version: { increment: 1 },
          ...(action === "confirm_return" ? { status: "ready" } : {}),
        },
      });
      if (!changedOrder.count)
        throw new ConflictException("Order changed; refresh");
      await tx.assignmentEvent.create({
        data: { assignmentId: id, actorId: actor.id, action: status },
      });
      await this.record(tx, actor, a.orderId, `delivery.${status}`, id);
      return { ok: true };
    });
  }
  async riderAction(actor: Actor, id: string, body: unknown) {
    riderOnly(actor);
    const { action, version, reason } = parse(
      z
        .object({
          action: z.enum(["pickup", "fail"]),
          version: z.number().int().nonnegative(),
          reason: z.string().trim().min(3).max(300).optional(),
        })
        .strict(),
      body,
    );
    if (action === "fail" && !reason)
      throw new BadRequestException("A failed-delivery reason is required");
    return this.db.$transaction(async (tx) => {
      const a = await tx.deliveryAssignment.findFirst({
        where: { id, riderId: actor.id, order: { outletId: actor.outletId } },
        include: { order: true },
      });
      if (!a) throw new NotFoundException("Task not found");
      if (
        !a.isActive ||
        a.status !== (action === "pickup" ? "assigned" : "picked_up")
      )
        throw new ConflictException("Task changed; refresh before continuing");
      const status = action === "pickup" ? "picked_up" : "failed";
      const changed = await tx.deliveryAssignment.updateMany({
        where: { id, version, status: a.status, isActive: true },
        data: {
          status,
          version: { increment: 1 },
          failureReason: reason,
          ...(action === "fail" ? { otpHash: null, otpSalt: null } : {}),
        },
      });
      if (!changed.count) throw new ConflictException("Task changed; refresh");
      const orderStatus =
        action === "pickup" ? "out_for_delivery" : "delivery_failed";
      const changedOrder = await tx.order.updateMany({
        where: {
          id: a.orderId,
          version: a.order.version,
          status: action === "pickup" ? "ready" : "out_for_delivery",
          paymentStatus: "paid",
        },
        data: { status: orderStatus, version: { increment: 1 } },
      });
      if (!changedOrder.count)
        throw new ConflictException("Order changed; refresh");
      await tx.assignmentEvent.create({
        data: { assignmentId: id, actorId: actor.id, action: status, reason },
      });
      await this.record(tx, actor, a.orderId, `delivery.${status}`, id, reason);
      return { ok: true };
    });
  }
  async issueCode(actor: Actor, orderId: string) {
    customerOnly(actor.role);
    secret();
    return this.db.$transaction(async (tx) => {
      const a = await tx.deliveryAssignment.findFirst({
        where: {
          orderId,
          isActive: true,
          status: "picked_up",
          order: {
            customerId: actor.id,
            outletId: actor.outletId,
            status: "out_for_delivery",
          },
        },
      });
      if (!a)
        throw new NotFoundException(
          "An active delivery for this customer was not found",
        );
      if (a.otpAttempts >= 5 || a.otpIssueCount >= 3)
        throw new ConflictException(
          "Verification limit reached. Contact the outlet.",
        );
      if (a.otpIssuedAt && Date.now() - a.otpIssuedAt.getTime() < 60000)
        throw new ConflictException(
          "Wait one minute before requesting a replacement code",
        );
      const code = String(randomInt(100000, 1000000)),
        salt = randomBytes(16).toString("hex"),
        expiresAt = new Date(Date.now() + 10 * 60000);
      const changed = await tx.deliveryAssignment.updateMany({
        where: {
          id: a.id,
          version: a.version,
          isActive: true,
          status: "picked_up",
        },
        data: {
          otpHash: digest(a.id, salt, code),
          otpSalt: salt,
          otpExpiresAt: expiresAt,
          otpIssuedAt: new Date(),
          otpIssueCount: { increment: 1 },
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Delivery changed; refresh before requesting a code",
        );
      // Code is returned only to the owning customer; never stored in logs/outbox or rider responses.
      return { code, expiresAt, assignmentId: a.id };
    });
  }
  async complete(actor: Actor, id: string, body: unknown) {
    riderOnly(actor);
    const { code, version } = parse(
      z
        .object({
          code: z.string().regex(/^\d{6}$/),
          version: z.number().int().nonnegative(),
        })
        .strict(),
      body,
    );
    secret();
    const result = await this.db.$transaction(async (tx) => {
      const a = await tx.deliveryAssignment.findFirst({
        where: { id, riderId: actor.id, order: { outletId: actor.outletId } },
        include: { order: true },
      });
      if (!a) throw new NotFoundException("Task not found");
      if (!a.isActive || a.status !== "picked_up")
        throw new ConflictException("Only a picked-up task can be completed");
      if (
        !a.otpHash ||
        !a.otpSalt ||
        !a.otpExpiresAt ||
        a.otpExpiresAt < new Date()
      )
        throw new ConflictException(
          "Ask the customer to request a current delivery code",
        );
      if (a.otpAttempts >= 5)
        throw new ConflictException(
          "Verification attempts exhausted. Contact the outlet.",
        );
      const changed = await tx.deliveryAssignment.updateMany({
        where: { id, version, isActive: true, status: "picked_up" },
        data: { otpAttempts: { increment: 1 }, version: { increment: 1 } },
      });
      if (!changed.count) throw new ConflictException("Task changed; refresh");
      const valid = timingSafeEqual(
        Buffer.from(a.otpHash, "hex"),
        Buffer.from(digest(a.id, a.otpSalt, code), "hex"),
      );
      if (!valid) return { valid: false }; // Commit the failed attempt before returning an error.
      const order = await tx.order.updateMany({
        where: {
          id: a.orderId,
          version: a.order.version,
          status: "out_for_delivery",
        },
        data: { status: "delivered", version: { increment: 1 } },
      });
      if (!order.count) throw new ConflictException("Order changed; refresh");
      await tx.deliveryAssignment.update({
        where: { id },
        data: {
          status: "delivered",
          isActive: false,
          otpHash: null,
          otpSalt: null,
        },
      });
      await tx.assignmentEvent.create({
        data: { assignmentId: id, actorId: actor.id, action: "delivered" },
      });
      await this.record(tx, actor, a.orderId, "delivery.delivered", id);
      return { valid: true };
    });
    if (!result.valid)
      throw new BadRequestException(
        "Incorrect delivery code. Refresh the task before trying again.",
      );
    return { ok: true };
  }
  private async record(
    tx: Prisma.TransactionClient,
    actor: Actor,
    orderId: string,
    action: string,
    assignmentId: string,
    reason?: string,
  ) {
    await tx.orderEvent.create({
      data: { orderId, actorId: actor.id, action, reason },
    });
    await tx.auditEvent.create({
      data: {
        outletId: actor.outletId,
        actorId: actor.id,
        action,
        resourceId: orderId,
        detail: reason,
      },
    });
    await tx.outboxEvent.create({
      data: {
        outletId: actor.outletId,
        kind: action,
        resourceId: orderId,
        payload: { assignmentId, ...(reason ? { reason } : {}) },
      },
    });
  }
}
