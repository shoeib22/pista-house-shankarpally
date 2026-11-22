import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Inject,
  Injectable,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./database";
import { Actor, AuthRequest, SessionGuard } from "./auth";
import { z } from "zod";
const feature = z.object({
  geometry: z.object({
    coordinates: z.tuple([
      z.number().finite().min(-180).max(180),
      z.number().finite().min(-90).max(90),
    ]),
  }),
  properties: z.record(z.string(), z.unknown()),
});
@Injectable()
export class MapsSearch {
  constructor(@Inject(Database) private db: Database) {}
  private cache = new Map<
    string,
    {
      until: number;
      places: { label: string; latitude: number; longitude: number }[];
    }
  >();
  private lastLookup = 0;
  async search(actor: Actor, raw: unknown) {
    const input = z.string().trim().min(3).max(100).safeParse(raw);
    if (!input.success)
      throw new BadRequestException(
        "Enter an area or landmark with at least three letters",
      );
    const endpoint = process.env.MAPS_GEOCODING_URL;
    if (!endpoint)
      throw new ServiceUnavailableException(
        "Area search is not configured. Choose a pin on the map instead.",
      );
    const key = actor.outletId + ":" + input.data.toLowerCase(),
      cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return { places: cached.places };
    if (Date.now() - this.lastLookup < 1000)
      throw new HttpException(
        "Please wait a moment before another area search",
        429,
      );
    this.lastLookup = Date.now();
    const outlet = await this.db.outlet.findUnique({
      where: { id: actor.outletId },
      select: { latitude: true, longitude: true },
    });
    try {
      const url = new URL(endpoint);
      url.searchParams.set("q", input.data);
      url.searchParams.set("limit", "5");
      url.searchParams.set("lang", "en");
      if (
        outlet?.latitude !== null &&
        outlet?.latitude !== undefined &&
        outlet.longitude !== null
      ) {
        url.searchParams.set("lat", String(outlet.latitude));
        url.searchParams.set("lon", String(outlet.longitude));
      }
      const response = await fetch(url, {
        headers: { "User-Agent": "PistaHouseShankarpallyBeta/0.4" },
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as any;
      if (!Array.isArray(body?.features)) throw new Error();
      const places = body.features.slice(0, 5).flatMap((raw: unknown) => {
        const parsed = feature.safeParse(raw);
        if (!parsed.success) return [];
        const f = parsed.data,
          p = f.properties;
        const parts = [p.name, p.street, p.district, p.city, p.state].filter(
          (v): v is string => typeof v === "string" && v.length > 0,
        );
        return [
          {
            label:
              [...new Set(parts)].join(", ").slice(0, 250) || "Map location",
            latitude: f.geometry.coordinates[1],
            longitude: f.geometry.coordinates[0],
          },
        ];
      });
      if (this.cache.size >= 200) this.cache.clear();
      this.cache.set(key, { until: Date.now() + 86400000, places });
      return { places };
    } catch {
      throw new ServiceUnavailableException(
        "Area search is temporarily unavailable. You can still choose a pin manually.",
      );
    }
  }
}
@Controller("api/maps")
@UseGuards(SessionGuard)
export class MapsController {
  constructor(@Inject(MapsSearch) private maps: MapsSearch) {}
  @Get("search") search(@Req() req: AuthRequest, @Query("q") query: unknown) {
    return this.maps.search(req.actor, query);
  }
}
