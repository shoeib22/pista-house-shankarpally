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
}
