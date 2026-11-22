import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Actor, AuthRequest, SessionGuard, developmentEnabled } from "../auth";
import { Database } from "../database";
import { customerOnly, permit } from "../domain";
import { betaEnabled } from "../runtime";
import {
  PaymentProvider,
  ProviderError,
  ProviderEvent,
  SessionInput,
  SignatureError,
  currentProvider,
  providerNamed,
} from "./providers";

export const SESSION_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
const unpaidMinutes = () => {
  const v = Number(process.env.UNPAID_ORDER_MINUTES);
  return Number.isFinite(v) && v >= SESSION_MINUTES ? v : 30;
};
const OPEN_STATES = ["created", "failed", "expired", "cancelled"];
const IN_PROGRESS = ["accepted", "preparing", "ready", "out_for_delivery"];

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const p = schema.safeParse(body);
  if (!p.success)
    throw new BadRequestException(
      p.error.issues.map((i) => i.message).join("; "),
    );
  return p.data;
}

type Info = {
  providerPaymentId: string;
  amountPaise?: number;
  method?: string;
};

@Injectable()
export class Payments implements OnModuleInit, OnModuleDestroy {
  private log = new Logger("Payments");
  private timer?: NodeJS.Timeout;
  private sweeping = false;
  private lastPull = new Map<string, number>();
  constructor(@Inject(Database) private db: Database) {}

  onModuleInit() {
    if (process.env.PAYMENTS_SWEEP_DISABLED === "true") return;
    this.timer = setInterval(() => void this.sweep(), 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** The provider in use, refusing test money in production and missing keys. */
  provider(): PaymentProvider {
    let provider: PaymentProvider;
    try {
      provider = currentProvider();
    } catch (e) {
      throw new ServiceUnavailableException((e as Error).message);
    }
    if (provider.simulated && !(betaEnabled() || developmentEnabled()))
      throw new ServiceUnavailableException("Test payments are disabled");
    if (!provider.configured())
      throw new ServiceUnavailableException("Payments are not configured");
    return provider;
  }

  config(actor: Actor) {
    customerOnly(actor.role);
    const provider = this.provider();
    return {
      provider: provider.name,
      simulated: provider.simulated,
      currency: "INR",
      sessionMinutes: SESSION_MINUTES,
      maxAttempts: MAX_ATTEMPTS,
    };
  }

  private sessionInput(
    payment: { id: string; amountPaise: number; expiresAt: Date },
    order: { number: number },
    name: string,
  ): SessionInput {
    return {
      paymentId: payment.id,
      orderNumber: order.number,
      amountPaise: payment.amountPaise,
      currency: "INR",
      customerName: name,
      expiresAt: payment.expiresAt,
    };
  }

  /**
   * Starts (or resumes) paying for an order. The amount is always the order's
   * total as stored on the server; the app cannot choose it.
   */
  async createSession(actor: Actor, orderId: string) {
    customerOnly(actor.role);
    const provider = this.provider();
    const order = await this.db.order.findFirst({
      where: { id: orderId, customerId: actor.id, outletId: actor.outletId },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus !== "pending")
      throw new ConflictException(
        order.paymentStatus === "paid"
          ? "This order is already paid"
          : "This order cannot be paid",
      );
    if (order.status !== "awaiting_acceptance")
      throw new ConflictException("This order can no longer be paid");
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { name: true },
    });
    const now = new Date();
    const live = await this.db.payment.findFirst({
      where: {
        orderId,
        provider: provider.name,
        status: "created",
        expiresAt: { gt: now },
        providerOrderId: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });
    if (live)
      return this.sessionView(
        live,
        provider,
        provider.clientParams(
          this.sessionInput(live, order, user.name),
          live.providerOrderId!,
        ),
      );
    const attempts = await this.db.payment.count({ where: { orderId } });
    if (attempts >= MAX_ATTEMPTS)
      throw new HttpException(
        "Too many payment attempts for this order. Please contact the outlet.",
        429,
      );
    const payment = await this.db.payment.create({
      data: {
        orderId,
        outletId: order.outletId,
        provider: provider.name,
        amountPaise: order.totalPaise,
        expiresAt: new Date(now.getTime() + SESSION_MINUTES * 60000),
      },
    });
    try {
      const out = await provider.createSession(
        this.sessionInput(payment, order, user.name),
      );
      const updated = await this.db.payment.update({
        where: { id: payment.id },
        data: { providerOrderId: out.providerOrderId },
      });
      return this.sessionView(updated, provider, out.clientParams);
    } catch (e) {
      await this.db.payment.update({
        where: { id: payment.id },
        data: { status: "cancelled", failureReason: "session_failed" },
      });
      this.log.error(
        `Could not create a payment session: ${(e as Error).message}`,
      );
      throw new ServiceUnavailableException(
        "Could not start the payment. Please try again.",
      );
    }
  }

  private sessionView(
    payment: {
      id: string;
      amountPaise: number;
      currency: string;
      expiresAt: Date;
    },
    provider: PaymentProvider,
    clientParams: Record<string, unknown>,
  ) {
    return {
      paymentId: payment.id,
      provider: provider.name,
      simulated: provider.simulated,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      expiresAt: payment.expiresAt.toISOString(),
      clientParams,
    };
  }

  /** What the app (or staff) may know about an order's payment. */
  async status(actor: Actor, orderId: string) {
    const customer = actor.role === "customer";
    if (!customer) permit(actor.role, "orders:read");
    const order = await this.db.order.findFirst({
      where: {
        id: orderId,
        outletId: actor.outletId,
        ...(customer ? { customerId: actor.id } : {}),
      },
      select: { id: true, paymentStatus: true, totalPaise: true, status: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    const [payments, refunds] = await Promise.all([
      this.db.payment.findMany({
        where: { orderId },
        orderBy: { createdAt: "desc" },
      }),
      this.db.refund.findMany({
        where: { orderId },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const latest = payments[0] ?? null;
    const now = Date.now();
    const awaiting =
      latest?.status === "created" && latest.expiresAt.getTime() > now;
    const effective =
      latest && latest.status === "created" && !awaiting
        ? "expired"
        : latest?.status;
    return {
      orderId,
      orderPaymentStatus: order.paymentStatus,
      amountPaise: order.totalPaise,
      payment: latest
        ? {
            id: latest.id,
            provider: latest.provider,
            status: effective,
            method: latest.method,
            amountPaise: latest.amountPaise,
            expiresAt: latest.expiresAt.toISOString(),
            paidAt: latest.paidAt?.toISOString() ?? null,
            failureReason: latest.failureReason,
          }
        : null,
      attempts: payments.length,
      canRetry:
        order.paymentStatus === "pending" &&
        order.status === "awaiting_acceptance" &&
        payments.length < MAX_ATTEMPTS &&
        !awaiting,
      refundedPaise: refunds
        .filter((r) => r.status !== "failed")
        .reduce((n, r) => n + r.amountPaise, 0),
      refunds: refunds.map((r) => ({
        id: r.id,
        amountPaise: r.amountPaise,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  private async ownedPayment(actor: Actor, paymentId: string) {
    customerOnly(actor.role);
    const payment = await this.db.payment.findFirst({
      where: {
        id: paymentId,
        order: { customerId: actor.id, outletId: actor.outletId },
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }

  /**
   * The app says it has finished paying. That claim is never trusted: if the
   * gateway gave a signed proof it is checked, and then the server asks the
   * gateway directly what happened.
   */
  async confirm(actor: Actor, paymentId: string, body: unknown) {
    const { result } = parse(
      z
        .object({ result: z.record(z.string(), z.unknown()).optional() })
        .strict(),
      body ?? {},
    );
    const payment = await this.ownedPayment(actor, paymentId);
    if (payment.status !== "paid" && payment.providerOrderId) {
      const provider = providerNamed(payment.provider);
      if (result && provider.verifyClientResult) {
        const proof = provider.verifyClientResult({
          providerOrderId: payment.providerOrderId,
          result,
        });
        if (!proof) {
          await this.db.auditEvent.create({
            data: {
              outletId: payment.outletId,
              actorId: actor.id,
              action: "payment.client_proof_invalid",
              resourceId: payment.id,
            },
          });
          throw new BadRequestException(
            "The payment result could not be verified",
          );
        }
      }
      const last = this.lastPull.get(payment.id) ?? 0;
      if (Date.now() - last >= 2000) {
        this.lastPull.set(payment.id, Date.now());
        if (this.lastPull.size > 500) this.lastPull.clear();
        await this.pull(payment.id);
      }
    }
    return this.status(actor, payment.orderId);
  }

  /** Asks the gateway about one payment and applies the answer. */
  async pull(paymentId: string) {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment?.providerOrderId || payment.status === "paid") return;
    const provider = providerNamed(payment.provider);
    let st;
    try {
      st = await provider.fetchStatus(payment.providerOrderId);
    } catch (e) {
      this.log.warn(
        `Could not check payment ${payment.id}: ${(e as Error).message}`,
      );
      return;
    }
    if (st.status === "paid" && st.providerPaymentId)
      await this.settle(payment.id, {
        providerPaymentId: st.providerPaymentId,
        amountPaise: st.amountPaise,
        method: st.method,
      });
    else if (st.status === "failed")
      await this.markFailed(payment.id, st.failureCode, st.failureReason);
  }

  /**
   * The ONE place an order becomes paid. Idempotent. If money arrives for an
   * order that is already paid, or no longer open, it is queued for refund
   * instead of being lost or double-counted.
   */
  async settle(paymentId: string, info: Info) {
    const outcome = await this.db.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!pay) return { kind: "none" as const };
      if (pay.status === "paid") return { kind: "already" as const };
      if (pay.status === "mismatch") return { kind: "already" as const };
      if (
        info.amountPaise !== undefined &&
        info.amountPaise !== pay.amountPaise
      ) {
        await tx.payment.update({
          where: { id: pay.id },
          data: {
            status: "mismatch",
            providerPaymentId: info.providerPaymentId,
            failureReason: `Gateway reported ${info.amountPaise} paise; expected ${pay.amountPaise}`,
          },
        });
        await tx.outboxEvent.create({
          data: {
            outletId: pay.outletId,
            kind: "payment.amount_mismatch",
            resourceId: pay.orderId,
            payload: { paymentId: pay.id },
          },
        });
        await tx.auditEvent.create({
          data: {
            outletId: pay.outletId,
            actorId: "system",
            action: "payment.amount_mismatch",
            resourceId: pay.id,
          },
        });
        return { kind: "mismatch" as const };
      }
      const claimed = await tx.payment.updateMany({
        where: { id: pay.id, status: { in: OPEN_STATES } },
        data: {
          status: "paid",
          providerPaymentId: info.providerPaymentId,
          method: info.method,
          paidAt: new Date(),
          failureCode: null,
          failureReason: null,
        },
      });
      if (!claimed.count) return { kind: "already" as const };
      const order = await tx.order.findUniqueOrThrow({
        where: { id: pay.orderId },
      });
      const marked = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentStatus: "pending",
          status: "awaiting_acceptance",
        },
        data: { paymentStatus: "paid", version: { increment: 1 } },
      });
      if (marked.count === 1) {
        await tx.paymentEvent.create({
          data: {
            id: `${pay.provider}:${info.providerPaymentId}`,
            orderId: order.id,
            provider: pay.provider,
            amountPaise: pay.amountPaise,
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            actorId: order.customerId,
            action: `${pay.provider}.payment_verified`,
          },
        });
        await tx.outboxEvent.create({
          data: {
            outletId: pay.outletId,
            kind: "order.paid",
            resourceId: order.id,
            payload: { orderId: order.id },
          },
        });
        await tx.auditEvent.create({
          data: {
            outletId: pay.outletId,
            actorId: order.customerId,
            action: "payment.paid",
            resourceId: pay.id,
          },
        });
        return { kind: "paid" as const };
      }
      const reason =
        order.paymentStatus === "paid" ? "duplicate_payment" : "order_not_open";
      const refund = await tx.refund.create({
        data: {
          paymentId: pay.id,
          orderId: order.id,
          outletId: pay.outletId,
          amountPaise: pay.amountPaise,
          reason,
        },
      });
      await tx.outboxEvent.create({
        data: {
          outletId: pay.outletId,
          kind: "refund.review_required",
          resourceId: order.id,
          payload: { reason, refundId: refund.id },
        },
      });
      await tx.auditEvent.create({
        data: {
          outletId: pay.outletId,
          actorId: "system",
          action: `payment.${reason}`,
          resourceId: pay.id,
        },
      });
      return { kind: "refund" as const, refundId: refund.id };
    });
    if (outcome.kind === "refund")
      await this.executeRefund(outcome.refundId).catch((e) =>
        this.log.error(`Automatic refund failed: ${(e as Error).message}`),
      );
    return outcome.kind;
  }

  async markFailed(paymentId: string, code?: string, reason?: string) {
    await this.db.payment.updateMany({
      where: { id: paymentId, status: "created" },
      data: {
        status: "failed",
        failureCode: code ?? null,
        failureReason: reason ?? "The payment did not go through",
      },
    });
  }

  /** Test-money controls, available only with the simulated provider. */
  async simulate(actor: Actor, paymentId: string, body: unknown) {
    const { outcome } = parse(
      z.object({ outcome: z.enum(["success", "failure", "pending"]) }).strict(),
      body,
    );
    const provider = this.provider();
    if (!provider.simulated)
      throw new ForbiddenException("Only available with test payments");
    const payment = await this.ownedPayment(actor, paymentId);
    if (payment.provider !== "simulated")
      throw new ForbiddenException("Only available with test payments");
    if (payment.status === "created") {
      if (outcome === "success")
        await this.settle(payment.id, {
          providerPaymentId: `simpay_${payment.id}`,
          amountPaise: payment.amountPaise,
          method: "simulated",
        });
      else if (outcome === "failure")
        await this.markFailed(
          payment.id,
          "SIMULATED_DECLINE",
          "The test payment was declined",
        );
    }
    return this.status(actor, payment.orderId);
  }

  /** Signed notifications from the gateway: the authoritative route for results. */
  async webhook(
    name: string,
    raw: Buffer | undefined,
    headers: Record<string, string | undefined>,
  ) {
    let provider: PaymentProvider;
    try {
      provider = providerNamed(name);
    } catch {
      throw new NotFoundException("Unknown provider");
    }
    if (
      provider.name !==
      (process.env.PAYMENT_PROVIDER || "simulated").toLowerCase()
    )
      throw new NotFoundException("Unknown provider");
    if (!raw) throw new BadRequestException("Request body is required");
    let event: ProviderEvent | null;
    try {
      event = provider.parseWebhook(raw, headers);
    } catch (e) {
      if (e instanceof SignatureError)
        throw new UnauthorizedException("Invalid signature");
      throw e;
    }
    if (!event) return { ok: true, ignored: true };
    const key = `${name}:${event.eventId}`;
    try {
      await this.db.webhookEvent.create({
        data: { id: key, provider: name, type: event.type },
      });
    } catch (e) {
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== "P2002"
      )
        throw e;
      const seen = await this.db.webhookEvent.findUnique({
        where: { id: key },
      });
      if (seen?.processedAt) return { ok: true, duplicate: true };
    }
    try {
      await this.applyEvent(name, event);
      await this.db.webhookEvent.update({
        where: { id: key },
        data: { processedAt: new Date() },
      });
    } catch (e) {
      // Let the gateway retry: forget this delivery so it is processed next time.
      await this.db.webhookEvent.deleteMany({ where: { id: key } });
      throw e;
    }
    return { ok: true };
  }

  private async applyEvent(name: string, ev: ProviderEvent) {
    if (ev.type === "payment.paid" || ev.type === "payment.failed") {
      if (!ev.providerOrderId) return;
      const payment = await this.db.payment.findUnique({
        where: {
          provider_providerOrderId: {
            provider: name,
            providerOrderId: ev.providerOrderId,
          },
        },
      });
      if (!payment) {
        this.log.warn(`Webhook for an unknown ${name} order`);
        return;
      }
      if (ev.type === "payment.paid" && ev.providerPaymentId)
        await this.settle(payment.id, {
          providerPaymentId: ev.providerPaymentId,
          amountPaise: ev.amountPaise,
          method: ev.method,
        });
      else if (ev.type === "payment.failed")
        await this.markFailed(payment.id, ev.failureCode, ev.failureReason);
      return;
    }
    if (!ev.providerRefundId) return;
    await this.db.refund.updateMany({
      where: { providerRefundId: ev.providerRefundId },
      data:
        ev.type === "refund.succeeded"
          ? { status: "succeeded" }
          : {
              status: "failed",
              failureReason: "The gateway could not complete the refund",
            },
    });
  }

  // ---- refunds --------------------------------------------------------

  async refund(actor: Actor, orderId: string, body: unknown, key: string) {
    permit(actor.role, "payments:refund");
    const { amountPaise, reason } = parse(
      z
        .object({
          amountPaise: z.number().int().positive().optional(),
          reason: z.string().trim().min(3, "Give a reason").max(200),
        })
        .strict(),
      body,
    );
    const idem = parse(
      z.string().min(8, "An Idempotency-Key header is required").max(128),
      key,
    );
    const existing = await this.db.refund.findUnique({
      where: { orderId_idempotencyKey: { orderId, idempotencyKey: idem } },
    });
    if (existing) return this.refundView(existing);
    const made = await this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, outletId: actor.outletId },
      });
      if (!order) throw new NotFoundException("Order not found");
      const pay = await tx.payment.findFirst({
        where: { orderId, status: "paid" },
      });
      if (!pay || !pay.providerPaymentId)
        throw new ConflictException("There is no completed payment to refund");
      const sum = await tx.refund.aggregate({
        where: { paymentId: pay.id, status: { not: "failed" } },
        _sum: { amountPaise: true },
      });
      const refunded = sum._sum.amountPaise ?? 0;
      const remaining = pay.amountPaise - refunded;
      const amount = amountPaise ?? remaining;
      if (amount <= 0 || amount > remaining)
        throw new ConflictException(
          remaining <= 0
            ? "This payment is already fully refunded"
            : `You can refund at most ${remaining} paise`,
        );
      const full = refunded + amount === pay.amountPaise;
      if (full && IN_PROGRESS.includes(order.status))
        throw new ConflictException(
          "Reject or complete the order before refunding it in full",
        );
      const refund = await tx.refund.create({
        data: {
          paymentId: pay.id,
          orderId,
          outletId: actor.outletId,
          amountPaise: amount,
          reason,
          requestedById: actor.id,
          idempotencyKey: idem,
        },
      });
      if (full)
        await tx.order.updateMany({
          where: { id: orderId, paymentStatus: "paid" },
          data: { paymentStatus: "refunded", version: { increment: 1 } },
        });
      await tx.auditEvent.create({
        data: {
          outletId: actor.outletId,
          actorId: actor.id,
          action: "payment.refund_requested",
          resourceId: refund.id,
          detail: `${amount} paise: ${reason}`,
        },
      });
      return refund;
    });
    return this.refundView(await this.executeRefund(made.id, true));
  }

  /** Sends one refund to the gateway. Safe to call again for a requested/failed refund. */
  async executeRefund(refundId: string, surface = false) {
    const refund = await this.db.refund.findUniqueOrThrow({
      where: { id: refundId },
    });
    if (!["requested", "failed"].includes(refund.status)) return refund;
    const claimed = await this.db.refund.updateMany({
      where: { id: refund.id, status: { in: ["requested", "failed"] } },
      data: { status: "processing", failureReason: null },
    });
    if (!claimed.count)
      return this.db.refund.findUniqueOrThrow({ where: { id: refundId } });
    const pay = await this.db.payment.findUniqueOrThrow({
      where: { id: refund.paymentId },
    });
    try {
      const out = await providerNamed(pay.provider).refund({
        providerPaymentId: pay.providerPaymentId!,
        amountPaise: refund.amountPaise,
        reference: refund.id,
      });
      return await this.db.refund.update({
        where: { id: refund.id },
        data: { status: out.status, providerRefundId: out.providerRefundId },
      });
    } catch (e) {
      const failed = await this.db.refund.update({
        where: { id: refund.id },
        data: {
          status: "failed",
          failureReason: (e instanceof ProviderError
            ? e.message
            : "Refund failed"
          ).slice(0, 300),
        },
      });
      // A failed full refund must not leave the order looking refunded.
      const live = await this.db.refund.aggregate({
        where: { paymentId: pay.id, status: { not: "failed" } },
        _sum: { amountPaise: true },
      });
      if ((live._sum.amountPaise ?? 0) < pay.amountPaise)
        await this.db.order.updateMany({
          where: { id: refund.orderId, paymentStatus: "refunded" },
          data: { paymentStatus: "paid", version: { increment: 1 } },
        });
      if (surface)
        throw new BadGatewayException(
          "The payment provider could not process the refund. It is saved as failed; try again.",
        );
      return failed;
    }
  }

  private refundView(r: {
    id: string;
    orderId: string;
    amountPaise: number;
    status: string;
    reason: string;
    failureReason: string | null;
    createdAt: Date;
  }) {
    return {
      id: r.id,
      orderId: r.orderId,
      amountPaise: r.amountPaise,
      status: r.status,
      reason: r.reason,
      failureReason: r.failureReason,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async refunds(actor: Actor, orderId: string) {
    const customer = actor.role === "customer";
    if (!customer) permit(actor.role, "orders:read");
    const order = await this.db.order.findFirst({
      where: {
        id: orderId,
        outletId: actor.outletId,
        ...(customer ? { customerId: actor.id } : {}),
      },
      select: { id: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    const rows = await this.db.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.refundView(r));
  }

  // ---- reconciliation and housekeeping --------------------------------

  async reconcile(actor: Actor) {
    permit(actor.role, "reports:read");
    const now = new Date();
    const [open, mismatches, refunds] = await Promise.all([
      this.db.payment.findMany({
        where: {
          outletId: actor.outletId,
          status: "created",
          createdAt: { lt: new Date(now.getTime() - 10 * 60000) },
        },
        select: {
          id: true,
          orderId: true,
          provider: true,
          amountPaise: true,
          createdAt: true,
        },
        take: 50,
      }),
      this.db.payment.findMany({
        where: { outletId: actor.outletId, status: "mismatch" },
        select: {
          id: true,
          orderId: true,
          amountPaise: true,
          failureReason: true,
        },
        take: 50,
      }),
      this.db.refund.findMany({
        where: {
          outletId: actor.outletId,
          OR: [
            { status: "failed" },
            {
              status: "requested",
              createdAt: { lt: new Date(now.getTime() - 3600000) },
            },
            {
              status: "processing",
              createdAt: { lt: new Date(now.getTime() - 86400000) },
            },
          ],
        },
        take: 50,
      }),
    ]);
    return {
      openPayments: open.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
      amountMismatches: mismatches,
      refundsNeedingAttention: refunds.map((r) => this.refundView(r)),
    };
  }

  async runReconcile(actor: Actor) {
    permit(actor.role, "reports:read");
    const result = await this.sweep();
    return { ok: true, ...result };
  }

  /**
   * Catches what webhooks missed: asks the gateway about open payments, expires
   * old sessions, retries stuck refunds, and cancels orders nobody paid for.
   */
  async sweep() {
    if (this.sweeping)
      return { checked: 0, expired: 0, cancelled: 0, refundsRetried: 0 };
    this.sweeping = true;
    const out = { checked: 0, expired: 0, cancelled: 0, refundsRetried: 0 };
    try {
      const now = new Date();
      const open = await this.db.payment.findMany({
        where: {
          status: "created",
          providerOrderId: { not: null },
          createdAt: { gt: new Date(now.getTime() - 24 * 3600000) },
        },
        orderBy: { createdAt: "asc" },
        take: 25,
        select: { id: true, provider: true },
      });
      for (const p of open) {
        if (p.provider === "simulated") continue;
        await this.pull(p.id);
        out.checked++;
      }
      const expiring = await this.db.payment.findMany({
        where: { status: "created", expiresAt: { lte: now } },
        take: 100,
        select: { id: true },
      });
      for (const p of expiring) {
        const done = await this.db.payment.updateMany({
          where: { id: p.id, status: "created" },
          data: { status: "expired" },
        });
        out.expired += done.count;
      }
      const cutoff = new Date(now.getTime() - unpaidMinutes() * 60000);
      const stale = await this.db.order.findMany({
        where: {
          status: "awaiting_acceptance",
          paymentStatus: "pending",
          createdAt: { lt: cutoff },
          payments: { none: { status: { in: ["created", "mismatch"] } } },
        },
        take: 50,
        select: { id: true, customerId: true, outletId: true },
      });
      for (const o of stale) {
        const done = await this.db.$transaction(async (tx) => {
          const c = await tx.order.updateMany({
            where: {
              id: o.id,
              status: "awaiting_acceptance",
              paymentStatus: "pending",
            },
            // "rejected" is the existing closed state; the event says why.
            data: { status: "rejected", version: { increment: 1 } },
          });
          if (!c.count) return 0;
          await tx.orderEvent.create({
            data: {
              orderId: o.id,
              actorId: o.customerId,
              action: "payment.timeout",
              reason: "Payment was not completed in time",
            },
          });
          await tx.auditEvent.create({
            data: {
              outletId: o.outletId,
              actorId: "system",
              action: "order.closed_unpaid",
              resourceId: o.id,
            },
          });
          return 1;
        });
        out.cancelled += done;
      }
      const stuck = await this.db.refund.findMany({
        where: {
          status: "requested",
          createdAt: { lt: new Date(now.getTime() - 60000) },
        },
        take: 10,
        select: { id: true },
      });
      for (const r of stuck) {
        await this.executeRefund(r.id).catch(() => undefined);
        out.refundsRetried++;
      }
    } catch (e) {
      this.log.error(`Payment sweep failed: ${(e as Error).message}`);
    } finally {
      this.sweeping = false;
    }
    return out;
  }
}

@Controller("api")
@UseGuards(SessionGuard)
export class PaymentsController {
  constructor(@Inject(Payments) private payments: Payments) {}
  @Get("payments/config") config(@Req() req: AuthRequest) {
    return this.payments.config(req.actor);
  }
  @Get("payments/reconcile") reconcile(@Req() req: AuthRequest) {
    return this.payments.reconcile(req.actor);
  }
  @Post("payments/reconcile/run") runReconcile(@Req() req: AuthRequest) {
    return this.payments.runReconcile(req.actor);
  }
  @Post("orders/:id/payments") session(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.payments.createSession(req.actor, id);
  }
  @Get("orders/:id/payment") status(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.payments.status(req.actor, id);
  }
  @Post("payments/:id/confirm") confirm(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.payments.confirm(req.actor, id, body);
  }
  @Post("payments/:id/simulate") simulate(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.payments.simulate(req.actor, id, body);
  }
  @Post("orders/:id/refunds") refund(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.payments.refund(req.actor, id, body, key);
  }
  @Get("orders/:id/refunds") refunds(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.payments.refunds(req.actor, id);
  }
}

/** Public on purpose: the gateway calls it, and the signature is the credential. */
@Controller("api/payments")
export class PaymentWebhookController {
  constructor(@Inject(Payments) private payments: Payments) {}
  @Post("webhook/:provider") webhook(
    @Param("provider") provider: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers))
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    return this.payments.webhook(provider, req.rawBody, headers);
  }
}
