import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { Actor, AuthRequest, SessionGuard } from "./auth";
import { Database } from "./database";
import { customerOnly, permit } from "./domain";

export const CATEGORIES = [
  "missing_item",
  "wrong_item",
  "quality",
  "late",
  "delivery",
  "payment",
  "refund",
  "app",
  "other",
] as const;
const LABELS: Record<(typeof CATEGORIES)[number], string> = {
  missing_item: "Missing item",
  wrong_item: "Wrong item",
  quality: "Food quality",
  late: "Late order",
  delivery: "Delivery problem",
  payment: "Payment issue",
  refund: "Refund question",
  app: "App problem",
  other: "Something else",
};
export const OPEN_LIMIT = 3;
export const NEW_PER_HOUR = 5;
export const REOPEN_DAYS = 7;
const slaMinutes = () => {
  const v = Number(process.env.SUPPORT_SLA_MINUTES);
  return Number.isFinite(v) && v > 0 ? v : 60;
};
const body = z.string().trim().min(1, "Write a message").max(2000);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const p = schema.safeParse(value);
  if (!p.success)
    throw new BadRequestException(
      p.error.issues.map((i) => i.message).join("; "),
    );
  return p.data;
}
const NEEDS_STAFF = ["open"];
const LIVE = ["open", "pending_customer"];

@Injectable()
export class Support implements OnModuleInit, OnModuleDestroy {
  private log = new Logger("Support");
  private timer?: NodeJS.Timeout;
  constructor(@Inject(Database) private db: Database) {}

  onModuleInit() {
    if (process.env.SUPPORT_SWEEP_DISABLED === "true") return;
    this.timer = setInterval(() => void this.sweep(), 10 * 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Resolved requests nobody answered for a week are closed. */
  async sweep() {
    try {
      const cutoff = new Date(Date.now() - REOPEN_DAYS * 86400000);
      const r = await this.db.supportTicket.updateMany({
        where: { status: "resolved", resolvedAt: { lt: cutoff } },
        data: { status: "closed" },
      });
      return r.count;
    } catch (e) {
      this.log.error(`Support sweep failed: ${(e as Error).message}`);
      return 0;
    }
  }

  // ---- customer ------------------------------------------------------

  async create(actor: Actor, raw: unknown) {
    customerOnly(actor.role);
    const input = parse(
      z
        .object({
          orderId: z.string().min(1).max(100).optional(),
          category: z.enum(CATEGORIES),
          subject: z.string().trim().min(3).max(100).optional(),
          message: body,
        })
        .strict(),
      raw,
    );
    const now = new Date();
    const [open, recent] = await Promise.all([
      this.db.supportTicket.count({
        where: { customerId: actor.id, status: { in: LIVE } },
      }),
      this.db.supportTicket.count({
        where: {
          customerId: actor.id,
          createdAt: { gte: new Date(now.getTime() - 3600000) },
        },
      }),
    ]);
    if (open >= OPEN_LIMIT)
      throw new ConflictException(
        `You already have ${OPEN_LIMIT} open requests. Please wait for a reply or close one first.`,
      );
    if (recent >= NEW_PER_HOUR)
      throw new HttpException("Too many new requests. Try again later.", 429);
    let orderNumber: number | null = null;
    if (input.orderId) {
      const order = await this.db.order.findFirst({
        where: {
          id: input.orderId,
          customerId: actor.id,
          outletId: actor.outletId,
        },
        select: { number: true },
      });
      if (!order) throw new NotFoundException("Order not found");
      orderNumber = order.number;
    }
    const ticket = await this.db.supportTicket.create({
      data: {
        outletId: actor.outletId,
        customerId: actor.id,
        orderId: input.orderId ?? null,
        category: input.category,
        subject:
          input.subject ??
          (orderNumber
            ? `${LABELS[input.category]} on #PH${String(orderNumber).padStart(4, "0")}`
            : LABELS[input.category]),
        lastCustomerMessageAt: now,
        customerReadAt: now,
        messages: {
          create: {
            authorId: actor.id,
            authorRole: "customer",
            body: input.message,
          },
        },
      },
    });
    return this.customerView(actor, ticket.id);
  }

  async list(actor: Actor) {
    customerOnly(actor.role);
    const rows = await this.db.supportTicket.findMany({
      where: { customerId: actor.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    const orderIds = rows.map((r) => r.orderId).filter(Boolean) as string[];
    const orders = orderIds.length
      ? await this.db.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, number: true },
        })
      : [];
    return rows.map((t) => ({
      id: t.id,
      number: t.number,
      subject: t.subject,
      category: t.category,
      status: t.status,
      orderNumber: orders.find((o) => o.id === t.orderId)?.number ?? null,
      updatedAt: t.updatedAt.toISOString(),
      unread:
        !!t.lastStaffMessageAt &&
        (!t.customerReadAt || t.lastStaffMessageAt > t.customerReadAt),
      canRate: ["resolved", "closed"].includes(t.status) && t.rating === null,
    }));
  }

  /** The customer's view of a ticket. Internal notes never leave the server. */
  private async customerView(actor: Actor, id: string, markRead = false) {
    const t = await this.db.supportTicket.findFirst({
      where: { id, customerId: actor.id },
      include: {
        messages: { where: { internal: false }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!t) throw new NotFoundException("Request not found");
    if (markRead)
      await this.db.supportTicket.updateMany({
        where: { id },
        data: { customerReadAt: new Date() },
      });
    const order = t.orderId
      ? await this.db.order.findUnique({
          where: { id: t.orderId },
          select: { number: true },
        })
      : null;
    return {
      id: t.id,
      number: t.number,
      subject: t.subject,
      category: t.category,
      status: t.status,
      orderId: t.orderId,
      orderNumber: order?.number ?? null,
      createdAt: t.createdAt.toISOString(),
      rating: t.rating,
      canReply:
        t.status !== "closed" &&
        !(
          t.status === "resolved" &&
          t.resolvedAt &&
          Date.now() - t.resolvedAt.getTime() > REOPEN_DAYS * 86400000
        ),
      canRate: ["resolved", "closed"].includes(t.status) && t.rating === null,
      messages: t.messages.map((m) => ({
        id: m.id,
        from: m.authorRole === "customer" ? "you" : "support",
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async get(actor: Actor, id: string) {
    customerOnly(actor.role);
    return this.customerView(actor, id, true);
  }

  async reply(actor: Actor, id: string, raw: unknown) {
    customerOnly(actor.role);
    const { body: text } = parse(z.object({ body }).strict(), raw);
    const t = await this.db.supportTicket.findFirst({
      where: { id, customerId: actor.id },
    });
    if (!t) throw new NotFoundException("Request not found");
    if (t.status === "closed")
      throw new ConflictException("This request is closed. Start a new one.");
    if (
      t.status === "resolved" &&
      t.resolvedAt &&
      Date.now() - t.resolvedAt.getTime() > REOPEN_DAYS * 86400000
    )
      throw new ConflictException(
        "This request was resolved a while ago. Start a new one.",
      );
    const lastMinute = await this.db.supportMessage.count({
      where: {
        ticketId: id,
        authorRole: "customer",
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });
    if (lastMinute >= 5)
      throw new HttpException("Slow down a little, then try again.", 429);
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: {
          ticketId: id,
          authorId: actor.id,
          authorRole: "customer",
          body: text,
        },
      });
      await tx.supportTicket.update({
        where: { id },
        data: {
          status: "open",
          resolvedAt: null,
          lastCustomerMessageAt: now,
          customerReadAt: now,
        },
      });
      if (t.status === "resolved")
        await tx.supportMessage.create({
          data: {
            ticketId: id,
            authorId: actor.id,
            authorRole: "system",
            internal: true,
            body: "Reopened by the customer",
          },
        });
    });
    return this.customerView(actor, id);
  }

  async closeByCustomer(actor: Actor, id: string) {
    customerOnly(actor.role);
    const t = await this.db.supportTicket.findFirst({
      where: { id, customerId: actor.id },
    });
    if (!t) throw new NotFoundException("Request not found");
    if (t.status !== "closed")
      await this.db.$transaction(async (tx) => {
        await tx.supportTicket.update({
          where: { id },
          data: { status: "closed", resolvedAt: t.resolvedAt ?? new Date() },
        });
        await tx.supportMessage.create({
          data: {
            ticketId: id,
            authorId: actor.id,
            authorRole: "system",
            body: "Closed by you.",
          },
        });
      });
    return this.customerView(actor, id);
  }

  async rate(actor: Actor, id: string, raw: unknown) {
    customerOnly(actor.role);
    const { rating, comment } = parse(
      z
        .object({
          rating: z.number().int().min(1).max(5),
          comment: z.string().trim().max(500).optional(),
        })
        .strict(),
      raw,
    );
    const done = await this.db.supportTicket.updateMany({
      where: {
        id,
        customerId: actor.id,
        status: { in: ["resolved", "closed"] },
        rating: null,
      },
      data: { rating, ratingComment: comment || null },
    });
    if (!done.count)
      throw new ConflictException(
        "This request cannot be rated (not finished, or already rated).",
      );
    return this.customerView(actor, id);
  }

  // ---- staff ---------------------------------------------------------

  private overdue(t: {
    status: string;
    lastCustomerMessageAt: Date;
    lastStaffMessageAt: Date | null;
  }) {
    return (
      NEEDS_STAFF.includes(t.status) &&
      Date.now() - t.lastCustomerMessageAt.getTime() > slaMinutes() * 60000 &&
      (!t.lastStaffMessageAt || t.lastStaffMessageAt < t.lastCustomerMessageAt)
    );
  }

  async inbox(
    actor: Actor,
    q: { filter?: string; mine?: string; search?: string },
  ) {
    permit(actor.role, "support:manage");
    const filter = q.filter ?? "needs_reply";
    const where: Record<string, unknown> = { outletId: actor.outletId };
    if (filter === "needs_reply") where.status = "open";
    else if (filter === "waiting") where.status = "pending_customer";
    else if (filter === "finished")
      where.status = { in: ["resolved", "closed"] };
    else if (filter !== "all") throw new BadRequestException("Unknown filter");
    if (q.mine === "true") where.assignedToId = actor.id;
    const search = q.search?.trim();
    if (search) {
      const n = Number(search.replace(/^#?(PH)?/i, ""));
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    const rows = await this.db.supportTicket.findMany({
      where: where as never,
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    const orderIds = rows.map((r) => r.orderId).filter(Boolean) as string[];
    const orders = orderIds.length
      ? await this.db.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, number: true },
        })
      : [];
    const items = rows.map((t) => ({
      id: t.id,
      number: t.number,
      subject: t.subject,
      category: t.category,
      status: t.status,
      priority: t.priority,
      customer: t.customer.name,
      orderNumber: orders.find((o) => o.id === t.orderId)?.number ?? null,
      assignedTo: t.assignedTo?.name ?? null,
      assignedToMe: t.assignedToId === actor.id,
      messages: t._count.messages,
      waitingMinutes: NEEDS_STAFF.includes(t.status)
        ? Math.floor((Date.now() - t.lastCustomerMessageAt.getTime()) / 60000)
        : null,
      overdue: this.overdue(t),
      updatedAt: t.updatedAt.toISOString(),
    }));
    // Most urgent first for the reply queue.
    if (filter === "needs_reply")
      items.sort(
        (a, b) =>
          Number(b.overdue) - Number(a.overdue) ||
          Number(b.priority === "high") - Number(a.priority === "high") ||
          (b.waitingMinutes ?? 0) - (a.waitingMinutes ?? 0),
      );
    return items;
  }

  async detail(actor: Actor, id: string) {
    permit(actor.role, "support:manage");
    const t = await this.db.supportTicket.findFirst({
      where: { id, outletId: actor.outletId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            credential: { select: { handle: true } },
          },
        },
        assignedTo: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!t) throw new NotFoundException("Request not found");
    const [order, authors, earlier] = await Promise.all([
      t.orderId
        ? this.db.order.findUnique({
            where: { id: t.orderId },
            select: {
              id: true,
              number: true,
              status: true,
              paymentStatus: true,
              fulfilment: true,
              totalPaise: true,
              createdAt: true,
              items: { select: { name: true, quantity: true } },
            },
          })
        : null,
      this.db.user.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                t.messages
                  .filter((m) => m.authorRole === "staff")
                  .map((m) => m.authorId),
              ),
            ],
          },
        },
        select: { id: true, name: true },
      }),
      this.db.supportTicket.count({
        where: { customerId: t.customerId, id: { not: t.id } },
      }),
    ]);
    return {
      id: t.id,
      number: t.number,
      subject: t.subject,
      category: t.category,
      status: t.status,
      priority: t.priority,
      assignedTo: t.assignedTo?.name ?? null,
      overdue: this.overdue(t),
      rating: t.rating,
      ratingComment: t.ratingComment,
      createdAt: t.createdAt.toISOString(),
      customer: {
        name: t.customer.name,
        phone: t.customer.credential?.handle ?? null,
        earlierRequests: earlier,
      },
      order: order
        ? { ...order, createdAt: order.createdAt.toISOString() }
        : null,
      messages: t.messages.map((m) => ({
        id: m.id,
        from: m.authorRole,
        author:
          m.authorRole === "staff"
            ? (authors.find((a) => a.id === m.authorId)?.name ?? "Staff")
            : m.authorRole === "customer"
              ? t.customer.name
              : "System",
        internal: m.internal,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async staffReply(actor: Actor, id: string, raw: unknown) {
    permit(actor.role, "support:manage");
    const input = parse(
      z
        .object({
          body,
          internal: z.boolean().optional(),
          status: z.enum(["pending_customer", "resolved"]).optional(),
        })
        .strict(),
      raw,
    );
    const t = await this.db.supportTicket.findFirst({
      where: { id, outletId: actor.outletId },
    });
    if (!t) throw new NotFoundException("Request not found");
    if (t.status === "closed" && !input.internal)
      throw new ConflictException(
        "This request is closed. Reopen it to reply to the customer.",
      );
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: {
          ticketId: id,
          authorId: actor.id,
          authorRole: "staff",
          internal: input.internal === true,
          body: input.body,
        },
      });
      if (input.internal) return;
      const status = input.status ?? "pending_customer";
      await tx.supportTicket.update({
        where: { id },
        data: {
          status,
          lastStaffMessageAt: now,
          firstResponseAt: t.firstResponseAt ?? now,
          resolvedAt: status === "resolved" ? now : null,
          assignedToId: t.assignedToId ?? actor.id,
        },
      });
      if (status === "resolved")
        await tx.auditEvent.create({
          data: {
            outletId: actor.outletId,
            actorId: actor.id,
            action: "support.resolved",
            resourceId: id,
          },
        });
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, raw: unknown) {
    permit(actor.role, "support:manage");
    const input = parse(
      z
        .object({
          status: z
            .enum(["open", "pending_customer", "resolved", "closed"])
            .optional(),
          priority: z.enum(["normal", "high"]).optional(),
          assign: z.enum(["me", "none"]).optional(),
        })
        .strict(),
      raw,
    );
    const t = await this.db.supportTicket.findFirst({
      where: { id, outletId: actor.outletId },
    });
    if (!t) throw new NotFoundException("Request not found");
    const notes: string[] = [];
    const data: Record<string, unknown> = {};
    if (input.status && input.status !== t.status) {
      data.status = input.status;
      data.resolvedAt = ["resolved", "closed"].includes(input.status)
        ? (t.resolvedAt ?? new Date())
        : null;
      notes.push(`Status changed to ${input.status.replace("_", " ")}`);
    }
    if (input.priority && input.priority !== t.priority) {
      data.priority = input.priority;
      notes.push(`Priority set to ${input.priority}`);
    }
    if (input.assign) {
      data.assignedToId = input.assign === "me" ? actor.id : null;
      notes.push(
        input.assign === "me" ? "Assigned to themselves" : "Unassigned",
      );
    }
    if (Object.keys(data).length)
      await this.db.$transaction(async (tx) => {
        await tx.supportTicket.update({ where: { id }, data: data as never });
        for (const note of notes)
          await tx.supportMessage.create({
            data: {
              ticketId: id,
              authorId: actor.id,
              authorRole: "system",
              internal: true,
              body: note,
            },
          });
        if (data.status)
          await tx.auditEvent.create({
            data: {
              outletId: actor.outletId,
              actorId: actor.id,
              action: `support.${String(data.status)}`,
              resourceId: id,
            },
          });
      });
    return this.detail(actor, id);
  }

  async stats(actor: Actor) {
    permit(actor.role, "support:manage");
    const now = new Date();
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    const week = new Date(now.getTime() - 7 * 86400000);
    const month = new Date(now.getTime() - 30 * 86400000);
    const [needs, waiting, mine, resolvedToday, responded, rated, openRows] =
      await Promise.all([
        this.db.supportTicket.count({
          where: { outletId: actor.outletId, status: "open" },
        }),
        this.db.supportTicket.count({
          where: { outletId: actor.outletId, status: "pending_customer" },
        }),
        this.db.supportTicket.count({
          where: {
            outletId: actor.outletId,
            status: { in: LIVE },
            assignedToId: actor.id,
          },
        }),
        this.db.supportTicket.count({
          where: {
            outletId: actor.outletId,
            resolvedAt: { gte: day },
            status: { in: ["resolved", "closed"] },
          },
        }),
        this.db.supportTicket.findMany({
          where: {
            outletId: actor.outletId,
            firstResponseAt: { gte: week },
          },
          select: { createdAt: true, firstResponseAt: true },
        }),
        this.db.supportTicket.aggregate({
          where: {
            outletId: actor.outletId,
            rating: { not: null },
            updatedAt: { gte: month },
          },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        this.db.supportTicket.findMany({
          where: { outletId: actor.outletId, status: "open" },
          select: {
            status: true,
            lastCustomerMessageAt: true,
            lastStaffMessageAt: true,
          },
        }),
      ]);
    const minutes = responded
      .map(
        (r) => (r.firstResponseAt!.getTime() - r.createdAt.getTime()) / 60000,
      )
      .filter((m) => m >= 0);
    return {
      needsReply: needs,
      overdue: openRows.filter((t) => this.overdue(t)).length,
      waitingOnCustomer: waiting,
      assignedToMe: mine,
      resolvedToday,
      avgFirstResponseMinutes: minutes.length
        ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)
        : null,
      satisfaction: rated._count.rating
        ? {
            average: Math.round((rated._avg.rating ?? 0) * 10) / 10,
            ratings: rated._count.rating,
          }
        : null,
      slaMinutes: slaMinutes(),
    };
  }
}

@Controller("api/support")
@UseGuards(SessionGuard)
export class SupportController {
  constructor(@Inject(Support) private support: Support) {}
  // customer
  @Post("tickets") create(@Req() req: AuthRequest, @Body() b: unknown) {
    return this.support.create(req.actor, b);
  }
  @Get("tickets") list(@Req() req: AuthRequest) {
    return this.support.list(req.actor);
  }
  @Get("tickets/:id") get(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.support.get(req.actor, id);
  }
  @Post("tickets/:id/messages") reply(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.support.reply(req.actor, id, b);
  }
  @Post("tickets/:id/close") close(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.support.closeByCustomer(req.actor, id);
  }
  @Post("tickets/:id/rating") rate(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.support.rate(req.actor, id, b);
  }
  // staff
  @Get("stats") stats(@Req() req: AuthRequest) {
    return this.support.stats(req.actor);
  }
  @Get("inbox") inbox(
    @Req() req: AuthRequest,
    @Query("filter") filter?: string,
    @Query("mine") mine?: string,
    @Query("search") search?: string,
  ) {
    return this.support.inbox(req.actor, { filter, mine, search });
  }
  @Get("inbox/:id") detail(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.support.detail(req.actor, id);
  }
  @Post("inbox/:id/reply") staffReply(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.support.staffReply(req.actor, id, b);
  }
  @Patch("inbox/:id") update(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.support.update(req.actor, id, b);
  }
}
