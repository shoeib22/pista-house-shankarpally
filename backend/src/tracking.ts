import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Database } from "./database";
import { Actor, developmentEnabled, hash } from "./auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const position = z
  .object({
    assignmentId: z.string().min(1).max(100),
    lease: z.string().uuid(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracy: z.number().finite().min(0).max(100),
    heading: z.number().finite().min(0).max(360).optional(),
    recordedAt: z.string().datetime(),
  })
  .strict();
@Injectable()
export class Tracking {
  constructor(@Inject(Database) private db: Database) {}
  async authenticate(token: unknown): Promise<Actor> {
    if (typeof token !== "string" || token.length > 256)
      throw new UnauthorizedException("Sign in to use delivery tracking");
    const session = await this.db.session.findUnique({
      where: { tokenHash: hash(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.user.disabledAt ||
      session.authVersion !== session.user.authVersion ||
      ((session.authMethod === "development" || session.user.developmentOnly) &&
        !developmentEnabled())
    )
      throw new UnauthorizedException("Session expired");
    return session.user;
  }
  async snapshot(actor: Actor, id: string, lease?: string) {
    if (!["customer", "owner", "counter", "rider"].includes(actor.role))
      throw new NotFoundException("Order unavailable");
    const order = await this.db.order.findFirst({
      where: {
        id,
        outletId: actor.outletId,
        ...(actor.role === "customer" ? { customerId: actor.id } : {}),
      },
      include: {
        items: true,
        outlet: { select: { latitude: true, longitude: true } },
        assignments: {
          where: { isActive: true, status: { in: ["assigned", "picked_up"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { rider: { select: { name: true, disabledAt: true } } },
        },
      },
    });
    if (!order || order.fulfilment !== "delivery")
      throw new NotFoundException("Order unavailable");
    const assignment = order.assignments[0];
    if (
      actor.role === "rider" &&
      (!assignment || assignment.riderId !== actor.id)
    )
      throw new NotFoundException("Order unavailable");
    const active =
      ["ready", "out_for_delivery"].includes(order.status) &&
      assignment &&
      !assignment.rider.disabledAt;
    const address = order.deliveryAddress as {
      latitude?: number;
      longitude?: number;
    } | null;
    const location =
      active && assignment.status === "picked_up" && assignment.locationLease
        ? assignment.location
        : null;
    const fresh =
      !!location &&
      !!assignment?.locationAt &&
      !!assignment.locationRecordedAt &&
      Date.now() - assignment.locationAt.getTime() < 45000 &&
      Date.now() - assignment.locationRecordedAt.getTime() < 45000;
    return {
      orderId: order.id,
      number: order.number,
      items: order.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPaise: i.unitPaise,
      })),
      totalPaise: order.totalPaise,
      deliveryPaise: order.deliveryPaise,
      taxPaise: order.taxPaise,
      status: order.status,
      paymentStatus: order.paymentStatus,
      version: order.version,
      serverTime: new Date().toISOString(),
      destination:
        typeof address?.latitude === "number" &&
        typeof address?.longitude === "number"
          ? { latitude: address.latitude, longitude: address.longitude }
          : null,
      rider: active
        ? { name: assignment.rider.name, assignmentId: assignment.id }
        : null,
      location: location ?? null,
      locationAt: location ? assignment.locationAt : null,
      fresh,
      sharing:
        !!active &&
        assignment.status === "picked_up" &&
        !!assignment.locationLease,
      publisherCurrent:
        actor.role === "rider" && lease
          ? assignment?.locationLease === lease
          : undefined,
      outlet:
        order.outlet.latitude !== null && order.outlet.longitude !== null
          ? order.outlet
          : null,
    };
  }
  async publish(actor: Actor, raw: unknown) {
    if (actor.role !== "rider")
      throw new UnauthorizedException("Rider access required");
    const parsed = position.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException("A recent, accurate GPS fix is required");
    const p = parsed.data,
      captured = new Date(p.recordedAt);
    if (
      Date.now() - captured.getTime() > 30000 ||
      captured.getTime() - Date.now() > 5000
    )
      throw new BadRequestException("GPS fix is out of date");
    const now = new Date();
    const changed = await this.db.deliveryAssignment.updateMany({
      where: {
        id: p.assignmentId,
        riderId: actor.id,
        isActive: true,
        status: "picked_up",
        locationLease: p.lease,
        order: { outletId: actor.outletId, status: "out_for_delivery" },
        OR: [
          { locationAt: null },
          { locationAt: { lt: new Date(now.getTime() - 3000) } },
        ],
        AND: [
          {
            OR: [
              { locationRecordedAt: null },
              { locationRecordedAt: { lt: captured } },
            ],
          },
        ],
      },
      data: {
        location: {
          latitude: p.latitude,
          longitude: p.longitude,
          accuracy: p.accuracy,
          heading: p.heading ?? 0,
          recordedAt: p.recordedAt,
        },
        locationAt: now,
        locationRecordedAt: captured,
      },
    });
    if (!changed.count)
      throw new BadRequestException(
        "Tracking is inactive or updates are arriving too quickly",
      );
    return { ok: true };
  }
  async begin(actor: Actor, id: string) {
    if (actor.role !== "rider" || typeof id !== "string" || id.length > 100)
      throw new UnauthorizedException();
    const lease = randomUUID();
    const changed = await this.db.deliveryAssignment.updateMany({
      where: {
        id,
        riderId: actor.id,
        isActive: true,
        status: "picked_up",
        order: { outletId: actor.outletId, status: "out_for_delivery" },
      },
      data: {
        locationLease: lease,
        location: Prisma.DbNull,
        locationAt: null,
        locationRecordedAt: null,
      },
    });
    if (!changed.count)
      throw new BadRequestException("No active delivery to share");
    this.routes.clear();
    return { ok: true, lease };
  }
  async stop(actor: Actor, id: string, lease: string) {
    if (actor.role !== "rider") throw new UnauthorizedException();
    if (!z.string().uuid().safeParse(lease).success)
      throw new BadRequestException("A sharing lease is required");
    await this.db.deliveryAssignment.updateMany({
      where: { id, riderId: actor.id, isActive: true, locationLease: lease },
      data: {
        location: Prisma.DbNull,
        locationAt: null,
        locationRecordedAt: null,
        locationLease: null,
      },
    });
    return { ok: true };
  }
  private routes = new Map<string, { until: number; value: unknown }>();
  async route(actor: Actor, id: string) {
    const snapshot = await this.snapshot(actor, id);
    if (!snapshot.fresh || !snapshot.location || !snapshot.destination)
      return {
        available: false,
        reason: "Waiting for a fresh rider position and delivery pin",
      };
    const endpoint = process.env.MAPS_ROUTING_URL;
    if (!endpoint)
      return {
        available: false,
        reason: "Road routing and ETA are not configured",
      };
    const point = snapshot.location as any,
      d = snapshot.destination;
    const key =
      id +
      ":" +
      snapshot.rider?.assignmentId +
      ":" +
      Math.round(point.latitude * 1000) +
      ":" +
      Math.round(point.longitude * 1000);
    const cached = this.routes.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    try {
      const url = new URL(
        `/route/v1/driving/${point.longitude},${point.latitude};${d.longitude},${d.latitude}`,
        endpoint,
      );
      url.searchParams.set("overview", "full");
      url.searchParams.set("geometries", "geojson");
      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      const data = (await response.json()) as any;
      const parsed = z
        .object({
          duration: z.number().finite().min(0).max(86400),
          distance: z.number().finite().min(0).max(20000000),
          geometry: z.object({
            coordinates: z
              .array(
                z.tuple([
                  z.number().finite().min(-180).max(180),
                  z.number().finite().min(-90).max(90),
                ]),
              )
              .min(2)
              .max(20000),
          }),
        })
        .safeParse(data.routes?.[0]);
      if (!response.ok || data.code !== "Ok" || !parsed.success)
        throw new Error();
      const route = parsed.data;
      const value = {
        available: true,
        coordinates: route.geometry.coordinates,
        durationSeconds: route.duration,
        distanceMetres: route.distance,
        calculatedAt: new Date().toISOString(),
        trafficAware: false,
      };
      const current = await this.snapshot(actor, id);
      if (
        !current.sharing ||
        !current.fresh ||
        current.rider?.assignmentId !== snapshot.rider?.assignmentId
      )
        return { available: false, reason: "Delivery state changed" };
      if (this.routes.size > 256) this.routes.clear();
      this.routes.set(key, { until: Date.now() + 30000, value });
      return value;
    } catch {
      return {
        available: false,
        reason: "Road routing is temporarily unavailable",
      };
    }
  }

  private etaHistory = new Map<string, { until: number; value: unknown }>();
  private etaRoutes = new Map<
    string,
    { until: number; value: number | null }
  >();

  /** Road travel time in minutes between two points, or null when unavailable. */
  private async driveMinutes(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
  ): Promise<number | null> {
    const endpoint = process.env.MAPS_ROUTING_URL;
    if (!endpoint) return null;
    const key = [from.latitude, from.longitude, to.latitude, to.longitude]
      .map((n) => n.toFixed(3))
      .join(",");
    const cached = this.etaRoutes.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    let value: number | null = null;
    try {
      const url = new URL(
        `/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}`,
        endpoint,
      );
      url.searchParams.set("overview", "false");
      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      const data = (await response.json()) as any;
      const seconds = data.routes?.[0]?.duration;
      if (
        response.ok &&
        data.code === "Ok" &&
        typeof seconds === "number" &&
        Number.isFinite(seconds) &&
        seconds >= 0 &&
        seconds < 86400
      )
        value = seconds / 60;
    } catch {
      value = null;
    }
    if (this.etaRoutes.size > 256) this.etaRoutes.clear();
    this.etaRoutes.set(key, { until: Date.now() + 60000, value });
    return value;
  }

  /** Median minutes this outlet took for each stage over its recent deliveries. */
  private async stageHistory(outletId: string) {
    const cached = this.etaHistory.get(outletId);
    if (cached && cached.until > Date.now())
      return cached.value as Record<"prep" | "assign" | "pickup", number[]>;
    const recent = await this.db.order.findMany({
      where: { outletId, fulfilment: "delivery", status: "delivered" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        events: { select: { action: true, createdAt: true } },
        assignments: {
          select: {
            createdAt: true,
            events: { select: { action: true, createdAt: true } },
          },
        },
      },
    });
    const history: Record<"prep" | "assign" | "pickup", number[]> = {
      prep: [],
      assign: [],
      pickup: [],
    };
    const when = (list: { action: string; createdAt: Date }[], a: string) =>
      list.find((e) => e.action === a)?.createdAt.getTime();
    const keep = (target: number[], from?: number, to?: number) => {
      if (from === undefined || to === undefined) return;
      const minutes = (to - from) / 60000;
      if (minutes >= 0.5 && minutes <= 120) target.push(minutes);
    };
    for (const order of recent) {
      const accepted = when(order.events, "accept"),
        ready = when(order.events, "ready");
      keep(history.prep, accepted, ready);
      const assignment = order.assignments.find((a) =>
        a.events.some((e) => e.action === "picked_up"),
      );
      if (!assignment) continue;
      const assigned = assignment.createdAt.getTime();
      keep(history.assign, ready, assigned);
      keep(history.pickup, assigned, when(assignment.events, "picked_up"));
    }
    this.etaHistory.set(outletId, {
      until: Date.now() + 300000,
      value: history,
    });
    return history;
  }

  /**
   * A transparent, stage-based delivery estimate:
   * preparation + rider assignment + pickup + road travel + handoff.
   * Stage durations come from this outlet's own recent deliveries when there are
   * at least five samples, otherwise from labelled defaults. It is not
   * traffic-aware and is always returned as a range.
   */
  async eta(actor: Actor, id: string) {
    const snapshot = await this.snapshot(actor, id);
    if (
      [
        "delivered",
        "collected",
        "cancelled",
        "rejected",
        "delivery_failed",
      ].includes(snapshot.status)
    )
      return { available: false, reason: "This delivery has finished" };
    if (snapshot.paymentStatus !== "paid")
      return { available: false, reason: "The estimate starts after payment" };
    const order = await this.db.order.findFirst({
      where: { id, outletId: actor.outletId },
      select: {
        events: { select: { action: true, createdAt: true } },
        assignments: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, status: true },
        },
      },
    });
    if (!order) throw new NotFoundException("Order unavailable");
    const history = await this.stageHistory(actor.outletId);
    const median = (xs: number[]) => {
      const sorted = [...xs].sort((a, b) => a - b),
        mid = Math.floor(sorted.length / 2);
      return sorted.length % 2
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const typical = (samples: number[], fallback: number) =>
      samples.length >= 5
        ? { minutes: median(samples), source: "history" as const }
        : { minutes: fallback, source: "default" as const };
    const now = Date.now(),
      when = (a: string) =>
        order.events.find((e) => e.action === a)?.createdAt.getTime();
    const remaining = (total: number, since?: number) =>
      since === undefined ? total : Math.max(1, total - (now - since) / 60000);
    const assignment = order.assignments[0];
    const accepted = when("accept"),
      ready = when("ready");
    const stages: {
      key: string;
      label: string;
      minutes: number;
      source: "history" | "default" | "route" | "estimate";
    }[] = [];
    const prep = typical(history.prep, 15),
      assign = typical(history.assign, 4),
      pickup = typical(history.pickup, 6);
    const dispatched = snapshot.status === "out_for_delivery";
    if (
      ["awaiting_acceptance", "accepted", "preparing"].includes(snapshot.status)
    )
      stages.push({
        key: "prep",
        label: "Preparing your food",
        minutes: remaining(prep.minutes, accepted),
        source: prep.source,
      });
    if (!dispatched && !assignment)
      stages.push({
        key: "assign",
        label: "Finding a delivery partner",
        minutes: remaining(assign.minutes, ready),
        source: assign.source,
      });
    if (!dispatched && (!assignment || assignment.status === "assigned"))
      stages.push({
        key: "pickup",
        label: "Rider collecting your order",
        minutes: remaining(pickup.minutes, assignment?.createdAt.getTime()),
        source: pickup.source,
      });
    const destination = snapshot.destination as {
      latitude: number;
      longitude: number;
    } | null;
    const live = snapshot.fresh && snapshot.location ? snapshot.location : null;
    const origin =
      (live as { latitude: number; longitude: number } | null) ??
      (snapshot.outlet as { latitude: number; longitude: number } | null);
    if (!destination || !origin)
      return {
        available: false,
        reason: "A delivery pin is needed to estimate travel",
      };
    let travel = await this.driveMinutes(origin, destination);
    let source: "route" | "estimate" = "route";
    if (travel === null) {
      // No routing provider: straight-line distance at a modest urban speed.
      const R = 6371,
        rad = (d: number) => (d * Math.PI) / 180,
        dLat = rad(destination.latitude - origin.latitude),
        dLon = rad(destination.longitude - origin.longitude),
        h =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(rad(origin.latitude)) *
            Math.cos(rad(destination.latitude)) *
            Math.sin(dLon / 2) ** 2;
      const km = 2 * R * Math.asin(Math.sqrt(h)) * 1.4;
      travel = Math.max(2, (km / 20) * 60);
      source = "estimate";
    }
    stages.push({
      key: "travel",
      label: live ? "Rider on the way" : "Travel to you",
      minutes: travel,
      source,
    });
    stages.push({
      key: "handoff",
      label: "Handing over at your door",
      minutes: 3,
      source: "default",
    });
    const total = stages.reduce((sum, s) => sum + s.minutes, 0);
    return {
      available: true,
      totalMinutes: Math.round(total),
      minutesLow: Math.max(1, Math.round(total * 0.85)),
      minutesHigh: Math.round(total * 1.3 + 2),
      stages: stages.map((s) => ({ ...s, minutes: Math.round(s.minutes) })),
      confidence: stages.every(
        (s) =>
          s.key === "handoff" || s.source === "history" || s.source === "route",
      )
        ? "history"
        : "rough",
      trafficAware: false,
      calculatedAt: new Date().toISOString(),
    };
  }

  private riderRoutes = new Map<string, { until: number; value: unknown }>();

  /**
   * Road route for the rider's own active delivery: from where the rider's phone
   * says they are, to the outlet (before pickup) and on to the customer's pin.
   * The rider's position is supplied by the rider for this request only and is
   * not stored. Not traffic-aware.
   */
  async riderRoute(
    actor: Actor,
    assignmentId: string,
    rawLat: unknown,
    rawLon: unknown,
  ) {
    if (actor.role !== "rider") throw new UnauthorizedException();
    const q = z
      .object({
        lat: z.coerce.number().finite().min(-90).max(90),
        lon: z.coerce.number().finite().min(-180).max(180),
      })
      .safeParse({ lat: rawLat, lon: rawLon });
    if (!q.success)
      throw new BadRequestException("A valid current position is required");
    if (typeof assignmentId !== "string" || assignmentId.length > 100)
      throw new NotFoundException("No active delivery");
    const a = await this.db.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        riderId: actor.id,
        isActive: true,
        status: { in: ["assigned", "picked_up"] },
        order: { outletId: actor.outletId },
      },
      select: {
        status: true,
        order: {
          select: {
            deliveryAddress: true,
            outlet: { select: { latitude: true, longitude: true } },
          },
        },
      },
    });
    if (!a) throw new NotFoundException("No active delivery");
    const address = a.order.deliveryAddress as {
      latitude?: unknown;
      longitude?: unknown;
    } | null;
    if (
      typeof address?.latitude !== "number" ||
      typeof address?.longitude !== "number"
    )
      return { available: false, reason: "This order has no delivery pin" };
    const endpoint = process.env.MAPS_ROUTING_URL;
    if (!endpoint)
      return { available: false, reason: "Road routing is not configured" };
    const stops: {
      kind: "outlet" | "customer";
      latitude: number;
      longitude: number;
    }[] = [];
    const o = a.order.outlet;
    if (a.status === "assigned" && o.latitude !== null && o.longitude !== null)
      stops.push({
        kind: "outlet",
        latitude: o.latitude,
        longitude: o.longitude,
      });
    stops.push({
      kind: "customer",
      latitude: address.latitude,
      longitude: address.longitude,
    });
    const key =
      assignmentId +
      ":" +
      a.status +
      ":" +
      q.data.lat.toFixed(3) +
      ":" +
      q.data.lon.toFixed(3);
    const cached = this.riderRoutes.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    try {
      const path = [{ latitude: q.data.lat, longitude: q.data.lon }, ...stops]
        .map((p) => `${p.longitude},${p.latitude}`)
        .join(";");
      const url = new URL(`/route/v1/driving/${path}`, endpoint);
      url.searchParams.set("overview", "full");
      url.searchParams.set("geometries", "geojson");
      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      const data = (await response.json()) as any;
      const parsed = z
        .object({
          duration: z.number().finite().min(0).max(86400),
          distance: z.number().finite().min(0).max(20000000),
          geometry: z.object({
            coordinates: z
              .array(
                z.tuple([
                  z.number().finite().min(-180).max(180),
                  z.number().finite().min(-90).max(90),
                ]),
              )
              .min(2)
              .max(20000),
          }),
          legs: z
            .array(
              z.object({
                duration: z.number().finite().min(0),
                distance: z.number().finite().min(0),
              }),
            )
            .max(4),
        })
        .safeParse(data.routes?.[0]);
      if (!response.ok || data.code !== "Ok" || !parsed.success)
        throw new Error();
      const value = {
        available: true,
        coordinates: parsed.data.geometry.coordinates,
        durationSeconds: parsed.data.duration,
        distanceMetres: parsed.data.distance,
        legs: parsed.data.legs.map((l) => ({
          durationSeconds: l.duration,
          distanceMetres: l.distance,
        })),
        stops,
        trafficAware: false,
        calculatedAt: new Date().toISOString(),
      };
      if (this.riderRoutes.size > 256) this.riderRoutes.clear();
      this.riderRoutes.set(key, { until: Date.now() + 20000, value });
      return value;
    } catch {
      return {
        available: false,
        reason: "Road routing is temporarily unavailable",
      };
    }
  }
}
