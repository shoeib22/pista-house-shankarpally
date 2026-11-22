import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Database } from "./database";
import { INF, assignBest } from "./matching";

/**
 * Cost weights, in "minutes-equivalent". Lower total cost wins.
 * cost(order, rider) =
 *     lastMile + 1.5*firstMile + 0.8*wait
 *   + 0.4*(deliveries by this rider in the last 3 h)   (spread the work)
 *   + 1.0*(offers this rider declined or missed in 24 h)
 *   - 0.05*(minutes this rider has been idle, up to 60) (longest idle first)
 *   - 0.5*(minutes the order has been waiting)          (oldest order first)
 *
 * Idle riders do not share a location, by design, so firstMile is a fixed
 * default for everyone rather than a measured distance.
 */
export const WEIGHTS = {
  lastMile: 1,
  firstMile: 1.5,
  wait: 0.8,
  load: 0.4,
  decline: 1,
  idle: 0.05,
  age: 0.5,
};
export const DEFAULT_FIRST_MILE_MIN = 3;
const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
export const offerSeconds = () => num("DISPATCH_OFFER_SECONDS", 30);
export const cycleSeconds = () => num("DISPATCH_INTERVAL_SECONDS", 15);

type Point = { latitude: number; longitude: number };
const point = (data: unknown): Point | null => {
  const d = data as { latitude?: unknown; longitude?: unknown } | null;
  return d && typeof d.latitude === "number" && typeof d.longitude === "number"
    ? { latitude: d.latitude, longitude: d.longitude }
    : null;
};
/** Straight-line distance in km. */
export function haversineKm(a: Point, b: Point) {
  const rad = (d: number) => (d * Math.PI) / 180,
    dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude),
    h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitude)) *
        Math.cos(rad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
/** Rough urban drive time: 1.4x straight line at 20 km/h. */
export const driveMinutesEstimate = (a: Point, b: Point) =>
  Math.max(2, ((haversineKm(a, b) * 1.4) / 20) * 60);

@Injectable()
export class Dispatch implements OnModuleInit, OnModuleDestroy {
  private log = new Logger("Dispatch");
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(@Inject(Database) private db: Database) {}

  onModuleInit() {
    if (process.env.DISPATCH_DISABLED === "true") return;
    this.timer = setInterval(() => void this.cycleAll(), cycleSeconds() * 1000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async cycleAll() {
    if (this.running) return;
    this.running = true;
    try {
      const outlets = await this.db.outlet.findMany({
        where: { autoDispatch: true },
        select: { id: true },
      });
      for (const o of outlets) {
        try {
          await this.cycle(o.id);
        } catch (e) {
          this.log.error(`Dispatch cycle failed: ${(e as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Close out offers that timed out or no longer make sense. */
  private async housekeeping(outletId: string, now: Date) {
    await this.db.deliveryOffer.updateMany({
      where: { outletId, status: "offered", expiresAt: { lte: now } },
      data: { status: "expired", respondedAt: now },
    });
    const live = await this.db.deliveryOffer.findMany({
      where: { outletId, status: "offered" },
      select: {
        id: true,
        order: {
          select: {
            status: true,
            assignments: { where: { isActive: true }, select: { id: true } },
          },
        },
        rider: { select: { riderAvailable: true, disabledAt: true } },
      },
    });
    const stale = live
      .filter(
        (o) =>
          o.order.status !== "ready" ||
          o.order.assignments.length > 0 ||
          !o.rider.riderAvailable ||
          o.rider.disabledAt,
      )
      .map((o) => o.id);
    if (stale.length)
      await this.db.deliveryOffer.updateMany({
        where: { id: { in: stale }, status: "offered" },
        data: { status: "cancelled", respondedAt: now },
      });
  }

  private async pool(outletId: string, now: Date) {
    const since = new Date(now.getTime() - 24 * 3600000);
    const [outlet, orders, riders] = await Promise.all([
      this.db.outlet.findUnique({
        where: { id: outletId },
        select: { latitude: true, longitude: true },
      }),
      this.db.order.findMany({
        where: {
          outletId,
          fulfilment: "delivery",
          status: "ready",
          paymentStatus: "paid",
          assignments: { none: { isActive: true } },
          offers: { none: { status: "offered" } },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
          id: true,
          number: true,
          deliveryAddress: true,
          events: {
            where: { action: "ready" },
            select: { createdAt: true },
            take: 1,
          },
          createdAt: true,
        },
      }),
      this.db.user.findMany({
        where: {
          outletId,
          role: "rider",
          riderAvailable: true,
          disabledAt: null,
          assignments: { none: { isActive: true } },
          deliveryOffers: { none: { status: "offered" } },
        },
        select: { id: true, name: true },
      }),
    ]);
    const orderIds = orders.map((o) => o.id),
      riderIds = riders.map((r) => r.id);
    const [done, missed, refused] = await Promise.all([
      this.db.deliveryAssignment.findMany({
        where: {
          riderId: { in: riderIds },
          status: "delivered",
          updatedAt: { gte: since },
        },
        select: { riderId: true, updatedAt: true },
      }),
      this.db.deliveryOffer.findMany({
        where: {
          riderId: { in: riderIds },
          status: { in: ["declined", "expired"] },
          createdAt: { gte: since },
        },
        select: { riderId: true },
      }),
      this.db.deliveryOffer.findMany({
        where: {
          orderId: { in: orderIds },
          status: { in: ["declined", "expired"] },
        },
        select: { orderId: true, riderId: true },
      }),
    ]);
    const stats = new Map<
      string,
      { recent: number; lastDone: number | null; declines: number }
    >();
    for (const r of riders)
      stats.set(r.id, { recent: 0, lastDone: null, declines: 0 });
    for (const d of done) {
      const s = stats.get(d.riderId)!;
      if (d.updatedAt.getTime() >= now.getTime() - 3 * 3600000) s.recent++;
      s.lastDone = Math.max(s.lastDone ?? 0, d.updatedAt.getTime());
    }
    for (const m of missed) stats.get(m.riderId)!.declines++;
    const excluded = new Set(refused.map((x) => `${x.orderId}:${x.riderId}`));
    return { outlet, orders, riders, stats, excluded };
  }

  /** The cost of offering this order to this rider, or INF if not allowed. */
  cost(
    order: { createdAt: Date; ready?: Date; destination: Point | null },
    rider: { recent: number; lastDone: number | null; declines: number },
    outlet: Point | null,
    now: Date,
  ) {
    const lastMile =
      outlet && order.destination
        ? driveMinutesEstimate(outlet, order.destination)
        : 10;
    const waitedMin = Math.max(
      0,
      (now.getTime() - (order.ready ?? order.createdAt).getTime()) / 60000,
    );
    const idleMin = Math.min(
      60,
      rider.lastDone === null ? 30 : (now.getTime() - rider.lastDone) / 60000,
    );
    return (
      WEIGHTS.lastMile * lastMile +
      WEIGHTS.firstMile * DEFAULT_FIRST_MILE_MIN +
      WEIGHTS.wait * 0 + // ready orders never wait for the kitchen
      WEIGHTS.load * rider.recent +
      WEIGHTS.decline * rider.declines -
      WEIGHTS.idle * idleMin -
      WEIGHTS.age * waitedMin
    );
  }

  /** One dispatch cycle for one outlet. Safe to call repeatedly. */
  async cycle(outletId: string, now = new Date()) {
    const outletRow = await this.db.outlet.findUnique({
      where: { id: outletId },
      select: { autoDispatch: true },
    });
    if (!outletRow?.autoDispatch) return { offered: 0, method: "off" as const };
    await this.housekeeping(outletId, now);
    const { outlet, orders, riders, stats, excluded } = await this.pool(
      outletId,
      now,
    );
    if (!orders.length || !riders.length)
      return { offered: 0, method: "none" as const };
    const origin = outlet ? point(outlet) : null;
    const matrix = orders.map((o) =>
      riders.map((r) =>
        excluded.has(`${o.id}:${r.id}`)
          ? INF
          : this.cost(
              {
                createdAt: o.createdAt,
                ready: o.events[0]?.createdAt,
                destination: point(o.deliveryAddress),
              },
              stats.get(r.id)!,
              origin,
              now,
            ),
      ),
    );
    const { pairs, method } = assignBest(matrix);
    let offered = 0;
    for (const [oi, ri] of pairs) {
      try {
        await this.db.$transaction(async (tx) => {
          await tx.deliveryOffer.create({
            data: {
              outletId,
              orderId: orders[oi].id,
              riderId: riders[ri].id,
              score: matrix[oi][ri],
              expiresAt: new Date(now.getTime() + offerSeconds() * 1000),
            },
          });
          await tx.auditEvent.create({
            data: {
              outletId,
              actorId: riders[ri].id,
              action: "delivery.offered",
              resourceId: orders[oi].id,
              detail: method,
            },
          });
        });
        offered++;
      } catch (e) {
        // The partial unique indexes reject a second live offer for the same
        // rider or order: someone else got there first. Try again next cycle.
        if (
          !(e instanceof Prisma.PrismaClientKnownRequestError) ||
          e.code !== "P2002"
        )
          throw e;
      }
    }
    return { offered, method };
  }

  /** What the owner and counter staff see about auto-dispatch. */
  async status(outletId: string, now = new Date()) {
    const outlet = await this.db.outlet.findUnique({
      where: { id: outletId },
      select: { autoDispatch: true },
    });
    const [offers, pool] = await Promise.all([
      this.db.deliveryOffer.findMany({
        where: { outletId, status: "offered", expiresAt: { gt: now } },
        select: {
          expiresAt: true,
          order: { select: { id: true, number: true } },
          rider: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.pool(outletId, now),
    ]);
    const needsManual = pool.orders
      .filter((o) =>
        pool.riders.every((r) => pool.excluded.has(`${o.id}:${r.id}`)),
      )
      .map((o) => ({ orderId: o.id, number: o.number }));
    return {
      enabled: !!outlet?.autoDispatch,
      offers: offers.map((o) => ({
        orderId: o.order.id,
        number: o.order.number,
        rider: o.rider.name,
        expiresAt: o.expiresAt.toISOString(),
      })),
      needsManual,
    };
  }
}
