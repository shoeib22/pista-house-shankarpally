import {
  BadRequestException,
  Body,
  ConflictException,
  ForbiddenException,
  Controller,
  Get,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { Actor, AuthRequest, SessionGuard } from "./auth";
import { Database } from "./database";
import { customerOnly, permit } from "./domain";
import { Notifications } from "./notifications/notifications";

const DONE = ["delivered", "collected"];
const tag = (n: number) => `#PH${String(n).padStart(4, "0")}`;
const DAY = 86400000;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value ?? {});
  if (!r.success)
    throw new BadRequestException(
      r.error.issues.map((i) => i.message).join("; "),
    );
  return r.data;
}

/**
 * Order ratings, owner-written offers and "picked for you". Nothing here invents
 * numbers or discounts: an offer says exactly what the owner typed, ratings are
 * what customers gave, and recommendations are ranked from real orders.
 */
@Injectable()
export class Engagement implements OnModuleInit, OnModuleDestroy {
  private log = new Logger(Engagement.name);
  private timer?: NodeJS.Timeout;
  constructor(
    @Inject(Database) private db: Database,
    @Inject(Notifications) private notify: Notifications,
  ) {}

  onModuleInit() {
    if (process.env.ENGAGEMENT_DISABLED === "true") return;
    this.timer = setInterval(() => void this.tick(), 5 * 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick(now = new Date()) {
    try {
      await this.runOffers(now);
      await this.runRatingPrompts(now);
    } catch (e) {
      this.log.error(`Engagement tick failed: ${(e as Error).message}`);
    }
  }

  // ---- ratings -------------------------------------------------------

  async rate(actor: Actor, orderId: string, raw: unknown) {
    customerOnly(actor.role);
    const input = parse(
      z
        .object({
          stars: z.number().int().min(1).max(5),
          comment: z.string().trim().max(500).optional(),
        })
        .strict(),
      raw,
    );
    const order = await this.db.order.findFirst({
      where: { id: orderId, customerId: actor.id, outletId: actor.outletId },
      select: { id: true, number: true, status: true, outletId: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (!DONE.includes(order.status))
      throw new BadRequestException("You can rate an order once it is done");
    try {
      await this.db.orderRating.create({
        data: {
          orderId: order.id,
          customerId: actor.id,
          outletId: order.outletId,
          stars: input.stars,
          comment: input.comment || null,
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002")
        throw new ConflictException("You have already rated this order");
      throw e;
    }
    if (input.stars <= 3) {
      const staff = await this.db.user.findMany({
        where: { outletId: order.outletId, role: { in: ["owner", "counter"] } },
        select: { id: true },
      });
      for (const s of staff)
        await this.notify.notify({
          userId: s.id,
          kind: "staff.low_rating",
          priority: "p0",
          title: `${input.stars}-star rating on ${tag(order.number)}`,
          body: input.comment || "No comment left.",
          data: { route: "order", orderId: order.id },
          dedupeKey: `rating:${order.id}:${s.id}`,
        });
    }
    return { ok: true };
  }

  async myRating(actor: Actor, orderId: string) {
    customerOnly(actor.role);
    const r = await this.db.orderRating.findFirst({
      where: { orderId, customerId: actor.id },
    });
    return r ? { stars: r.stars, comment: r.comment } : null;
  }

  async ratingSummary(actor: Actor) {
    permit(actor.role, "reports:read");
    const since = new Date(Date.now() - 30 * DAY);
    const [all, recent, low] = await Promise.all([
      this.db.orderRating.groupBy({
        by: ["stars"],
        where: { outletId: actor.outletId },
        _count: true,
      }),
      this.db.orderRating.aggregate({
        where: { outletId: actor.outletId, createdAt: { gte: since } },
        _avg: { stars: true },
        _count: true,
      }),
      this.db.orderRating.findMany({
        where: {
          outletId: actor.outletId,
          stars: { lte: 3 },
          comment: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
    const distribution = [1, 2, 3, 4, 5].map(
      (s) => all.find((a) => a.stars === s)?._count ?? 0,
    );
    const count = distribution.reduce((a, b) => a + b, 0);
    const sum = distribution.reduce((a, b, i) => a + b * (i + 1), 0);
    const numbers = await this.db.order.findMany({
      where: { id: { in: low.map((l) => l.orderId) } },
      select: { id: true, number: true },
    });
    return {
      count,
      average: count ? Math.round((sum / count) * 100) / 100 : null,
      distribution,
      last30Days: {
        count: recent._count,
        average: recent._avg.stars
          ? Math.round(recent._avg.stars * 100) / 100
          : null,
      },
      note:
        count < 20
          ? "Fewer than 20 ratings so far: treat the average as a rough guide."
          : null,
      lowRatings: low.map((l) => ({
        stars: l.stars,
        comment: l.comment,
        orderNumber: numbers.find((n) => n.id === l.orderId)?.number ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  /** Asks for a rating 30 minutes to 6 hours after an order is finished. */
  async runRatingPrompts(now = new Date()) {
    const from = new Date(now.getTime() - 6 * 3600000),
      to = new Date(now.getTime() - 30 * 60000);
    const orders = await this.db.order.findMany({
      where: {
        status: { in: DONE },
        events: { some: { createdAt: { gte: from, lte: to } } },
      },
      select: {
        id: true,
        number: true,
        customerId: true,
        events: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      take: 200,
    });
    let sent = 0;
    for (const o of orders) {
      const last = o.events[0]?.createdAt;
      if (!last || last < from || last > to) continue;
      if (await this.db.orderRating.findUnique({ where: { orderId: o.id } }))
        continue;
      const r = await this.notify.notify(
        {
          userId: o.customerId,
          kind: "order.rate",
          priority: "p1",
          title: `How was order ${tag(o.number)}?`,
          body: "Tap to rate it. It takes five seconds.",
          data: { route: "rate", orderId: o.id },
          dedupeKey: `rate:${o.id}`,
          campaign: "rating_prompt",
        },
        now,
      );
      if (r.status === "created") sent++;
    }
    return sent;
  }

  // ---- offers --------------------------------------------------------

  async createOffer(actor: Actor, raw: unknown) {
    this.owner(actor);
    const input = parse(
      z
        .object({
          title: z.string().trim().min(3).max(60),
          body: z.string().trim().min(5).max(160),
          productId: z.string().max(100).optional(),
          audience: z.enum(["all", "lapsed", "recent"]).default("all"),
          startsAt: z.coerce.date().optional(),
          endsAt: z.coerce.date().optional(),
        })
        .strict(),
      raw,
    );
    const now = new Date();
    const startsAt = input.startsAt ?? now;
    if (startsAt.getTime() > now.getTime() + 30 * DAY)
      throw new BadRequestException("Schedule within the next 30 days");
    if (startsAt.getTime() < now.getTime() - 60000)
      throw new BadRequestException("The start time is in the past");
    if (input.endsAt && input.endsAt <= startsAt)
      throw new BadRequestException("The end must be after the start");
    if (input.productId) {
      const p = await this.db.product.findFirst({
        where: {
          id: input.productId,
          outletId: actor.outletId,
          available: true,
        },
      });
      if (!p) throw new BadRequestException("That dish is not on today’s menu");
    }
    const today = await this.db.offer.count({
      where: {
        outletId: actor.outletId,
        status: { not: "cancelled" },
        createdAt: { gte: new Date(now.getTime() - DAY) },
      },
    });
    if (today >= 3)
      throw new BadRequestException(
        "Three offers a day is the limit, so customers are not flooded",
      );
    const o = await this.db.offer.create({
      data: {
        outletId: actor.outletId,
        createdById: actor.id,
        title: input.title,
        body: input.body,
        productId: input.productId ?? null,
        audience: input.audience,
        startsAt,
        endsAt: input.endsAt ?? null,
      },
    });
    await this.db.auditEvent.create({
      data: {
        outletId: actor.outletId,
        actorId: actor.id,
        action: "offer.created",
        resourceId: o.id,
      },
    });
    return this.offerView(o);
  }

  async listOffers(actor: Actor) {
    this.owner(actor);
    const rows = await this.db.offer.findMany({
      where: { outletId: actor.outletId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((o) => this.offerView(o));
  }

  async cancelOffer(actor: Actor, id: string) {
    this.owner(actor);
    const r = await this.db.offer.updateMany({
      where: { id, outletId: actor.outletId, status: "scheduled" },
      data: { status: "cancelled" },
    });
    if (!r.count) throw new NotFoundException("No scheduled offer to cancel");
    return { ok: true };
  }

  /** Offers customers can see in the app (sent, not ended, last three days). */
  async activeOffers(actor: Actor) {
    customerOnly(actor.role);
    const now = new Date();
    const rows = await this.db.offer.findMany({
      where: {
        outletId: actor.outletId,
        status: "sent",
        sentAt: { gte: new Date(now.getTime() - 3 * DAY) },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { sentAt: "desc" },
      take: 5,
    });
    return rows.map((o) => ({
      id: o.id,
      title: o.title,
      body: o.body,
      productId: o.productId,
      endsAt: o.endsAt?.toISOString() ?? null,
    }));
  }

  private owner(actor: Actor) {
    if (actor.role !== "owner")
      throw new ForbiddenException("Only the owner can manage offers");
  }
  private offerView(o: {
    id: string;
    title: string;
    body: string;
    productId: string | null;
    audience: string;
    startsAt: Date;
    endsAt: Date | null;
    status: string;
    sentCount: number;
    sentAt: Date | null;
  }) {
    return {
      id: o.id,
      title: o.title,
      body: o.body,
      productId: o.productId,
      audience: o.audience,
      startsAt: o.startsAt.toISOString(),
      endsAt: o.endsAt?.toISOString() ?? null,
      status: o.status,
      sentCount: o.sentCount,
      sentAt: o.sentAt?.toISOString() ?? null,
    };
  }

  /** Sends due offers once, to customers who opted in to promotions. */
  async runOffers(now = new Date()) {
    const due = await this.db.offer.findMany({
      where: {
        status: "scheduled",
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      take: 20,
    });
    let total = 0;
    for (const o of due) {
      // Claim it so two servers never send the same offer.
      const claim = await this.db.offer.updateMany({
        where: { id: o.id, status: "scheduled" },
        data: { status: "sent", sentAt: now },
      });
      if (!claim.count) continue;
      const ids = await this.audience(o.outletId, o.audience, now);
      let made = 0;
      for (const userId of ids) {
        const r = await this.notify.notify(
          {
            userId,
            kind: "offer",
            priority: "p2",
            title: o.title,
            body: o.body,
            data: {
              route: o.productId ? "product" : "menu",
              offerId: o.id,
              ...(o.productId ? { productId: o.productId } : {}),
            },
            dedupeKey: `offer:${o.id}:${userId}`,
            campaign: "owner_offer",
          },
          now,
        );
        if (r.status === "created") made++;
      }
      await this.db.offer.update({
        where: { id: o.id },
        data: { sentCount: made },
      });
      total += made;
    }
    return total;
  }

  private async audience(outletId: string, audience: string, now: Date) {
    const customers = await this.db.user.findMany({
      where: { outletId, role: "customer" },
      select: { id: true },
      take: 5000,
    });
    if (audience === "all") return customers.map((c) => c.id);
    const last = await this.db.order.groupBy({
      by: ["customerId"],
      where: { outletId, customerId: { in: customers.map((c) => c.id) } },
      _max: { createdAt: true },
    });
    const days = (d: Date | null) =>
      d ? (now.getTime() - d.getTime()) / DAY : Infinity;
    return last
      .filter((l) => {
        const age = days(l._max.createdAt);
        return audience === "recent" ? age <= 14 : age >= 14 && age <= 90;
      })
      .map((l) => l.customerId);
  }

  // ---- recommendations -----------------------------------------------

  /**
   * "Picked for you": what this customer orders often (recent orders count
   * more) blended with what is popular this month. Explainable, no hidden model.
   */
  async recommendations(actor: Actor, now = new Date()) {
    customerOnly(actor.role);
    const [products, mine, popular] = await Promise.all([
      this.db.product.findMany({
        where: { outletId: actor.outletId, available: true },
      }),
      this.db.orderItem.findMany({
        where: {
          order: {
            customerId: actor.id,
            outletId: actor.outletId,
            status: { in: DONE },
          },
        },
        select: {
          productId: true,
          quantity: true,
          order: { select: { createdAt: true } },
        },
        take: 500,
      }),
      this.db.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: {
            outletId: actor.outletId,
            status: { in: DONE },
            createdAt: { gte: new Date(now.getTime() - 30 * DAY) },
          },
        },
        _sum: { quantity: true },
      }),
    ]);
    const own = new Map<string, number>();
    for (const i of mine) {
      const age = (now.getTime() - i.order.createdAt.getTime()) / DAY;
      own.set(
        i.productId,
        (own.get(i.productId) ?? 0) + i.quantity * Math.pow(0.5, age / 30),
      );
    }
    const pop = new Map(
      popular.map((p) => [p.productId, p._sum.quantity ?? 0]),
    );
    const maxPop = Math.max(1, ...pop.values());
    const maxOwn = Math.max(1, ...own.values());
    return products
      .map((p) => {
        const o = (own.get(p.id) ?? 0) / maxOwn,
          g = (pop.get(p.id) ?? 0) / maxPop;
        return {
          productId: p.id,
          name: p.name,
          pricePaise: p.pricePaise,
          score: 3 * o + g,
          reason:
            o > 0.2
              ? "You order this often"
              : g > 0.2
                ? "Popular this month"
                : "On today’s menu",
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ score: _s, ...r }) => r);
  }
}

@Controller("api")
@UseGuards(SessionGuard)
export class EngagementController {
  constructor(@Inject(Engagement) private e: Engagement) {}
  @Post("orders/:id/rating") rate(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.e.rate(req.actor, id, b);
  }
  @Get("orders/:id/rating") mine(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.e.myRating(req.actor, id);
  }
  @Get("ratings/summary") summary(@Req() req: AuthRequest) {
    return this.e.ratingSummary(req.actor);
  }
  @Get("offers") list(@Req() req: AuthRequest) {
    return this.e.listOffers(req.actor);
  }
  @Post("offers") create(@Req() req: AuthRequest, @Body() b: unknown) {
    return this.e.createOffer(req.actor, b);
  }
  @Post("offers/:id/cancel") cancel(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.e.cancelOffer(req.actor, id);
  }
  @Get("me/offers") active(@Req() req: AuthRequest) {
    return this.e.activeOffers(req.actor);
  }
  @Get("me/recommendations") recs(@Req() req: AuthRequest) {
    return this.e.recommendations(req.actor);
  }
}
