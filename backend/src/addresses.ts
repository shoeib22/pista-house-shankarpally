import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { Actor, AuthRequest, SessionGuard } from "./auth";
import { Database } from "./database";
import { customerOnly } from "./domain";

export const MAX_SAVED_ADDRESSES = 10;

/** Same field rules as the delivery address on an order, plus a label. */
export const savedAddress = z
  .object({
    label: z.string().trim().min(1).max(30),
    recipient: z.string().trim().min(2).max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/),
    line1: z.string().trim().min(5).max(250),
    city: z.string().trim().min(2).max(80),
    postalCode: z.string().regex(/^\d{6}$/),
    landmark: z.string().trim().max(150).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    makeDefault: z.boolean().optional(),
  })
  .strict()
  .refine(
    (a) => (a.latitude === undefined) === (a.longitude === undefined),
    "Both map coordinates are required",
  );

const select = {
  id: true,
  label: true,
  recipient: true,
  phone: true,
  line1: true,
  city: true,
  postalCode: true,
  landmark: true,
  latitude: true,
  longitude: true,
  isDefault: true,
  updatedAt: true,
} as const;

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const p = schema.safeParse(body);
  if (!p.success)
    throw new BadRequestException(
      p.error.issues.map((i) => i.message).join("; "),
    );
  return p.data;
}
const same = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, " ") ===
  b.trim().toLowerCase().replace(/\s+/g, " ");

@Injectable()
export class Addresses {
  constructor(@Inject(Database) private db: Database) {}

  async list(actor: Actor) {
    customerOnly(actor.role);
    return this.db.savedAddress.findMany({
      where: { customerId: actor.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select,
    });
  }

  /**
   * Saves an address. Saving the same street address and postcode again updates
   * that entry instead of adding a duplicate, so "Save this address" at checkout
   * is safe to repeat.
   */
  async create(actor: Actor, body: unknown) {
    customerOnly(actor.role);
    const { makeDefault, ...data } = parse(savedAddress, body);
    return this.db.$transaction(async (tx) => {
      const mine = await tx.savedAddress.findMany({
        where: { customerId: actor.id },
        select: { id: true, line1: true, postalCode: true, isDefault: true },
      });
      const existing = mine.find(
        (a) => a.postalCode === data.postalCode && same(a.line1, data.line1),
      );
      if (!existing && mine.length >= MAX_SAVED_ADDRESSES)
        throw new ConflictException(
          `You can save up to ${MAX_SAVED_ADDRESSES} addresses. Delete one first.`,
        );
      const makeThisDefault =
        makeDefault === true || (!existing && mine.length === 0);
      if (makeThisDefault)
        await tx.savedAddress.updateMany({
          where: { customerId: actor.id, isDefault: true },
          data: { isDefault: false },
        });
      const values = {
        ...data,
        landmark: data.landmark || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      };
      if (existing)
        return tx.savedAddress.update({
          where: { id: existing.id },
          data: {
            ...values,
            ...(makeThisDefault ? { isDefault: true } : {}),
          },
          select,
        });
      return tx.savedAddress.create({
        data: { ...values, customerId: actor.id, isDefault: makeThisDefault },
        select,
      });
    });
  }

  async update(actor: Actor, id: string, body: unknown) {
    customerOnly(actor.role);
    const { makeDefault, ...data } = parse(savedAddress, body);
    return this.db.$transaction(async (tx) => {
      const current = await tx.savedAddress.findFirst({
        where: { id, customerId: actor.id },
        select: { id: true },
      });
      if (!current) throw new NotFoundException("Address not found");
      if (makeDefault)
        await tx.savedAddress.updateMany({
          where: { customerId: actor.id, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      return tx.savedAddress.update({
        where: { id },
        data: {
          ...data,
          landmark: data.landmark || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          ...(makeDefault ? { isDefault: true } : {}),
        },
        select,
      });
    });
  }

  async setDefault(actor: Actor, id: string) {
    customerOnly(actor.role);
    return this.db.$transaction(async (tx) => {
      const current = await tx.savedAddress.findFirst({
        where: { id, customerId: actor.id },
        select: { id: true },
      });
      if (!current) throw new NotFoundException("Address not found");
      await tx.savedAddress.updateMany({
        where: { customerId: actor.id, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
      return tx.savedAddress.update({
        where: { id },
        data: { isDefault: true },
        select,
      });
    });
  }

  async remove(actor: Actor, id: string) {
    customerOnly(actor.role);
    return this.db.$transaction(async (tx) => {
      const current = await tx.savedAddress.findFirst({
        where: { id, customerId: actor.id },
        select: { id: true, isDefault: true },
      });
      if (!current) throw new NotFoundException("Address not found");
      await tx.savedAddress.delete({ where: { id } });
      if (current.isDefault) {
        const next = await tx.savedAddress.findFirst({
          where: { customerId: actor.id },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });
        if (next)
          await tx.savedAddress.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
      }
      return { ok: true };
    });
  }
}

@Controller("api/addresses")
@UseGuards(SessionGuard)
export class AddressesController {
  constructor(@Inject(Addresses) private addresses: Addresses) {}
  @Get() list(@Req() req: AuthRequest) {
    return this.addresses.list(req.actor);
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.addresses.create(req.actor, body);
  }
  @Put(":id") update(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.addresses.update(req.actor, id, body);
  }
  @Patch(":id/default") setDefault(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.addresses.setDefault(req.actor, id);
  }
  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.addresses.remove(req.actor, id);
  }
}
