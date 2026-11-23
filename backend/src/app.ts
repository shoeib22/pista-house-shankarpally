import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Database } from "./database";
import {
  AuthRequest,
  developmentEnabled,
  hash,
  publicActor,
  SessionGuard,
} from "./auth";
import { Orders } from "./orders";
import { permit } from "./domain";
import { Addresses, AddressesController } from "./addresses";
import {
  EmailAccounts,
  EmailManagementController,
  EmailRecoveryController,
} from "./accounts/email";
import { Mailer } from "./mailer";
import { Support, SupportController } from "./support";
import { Engagement, EngagementController } from "./engagement";
import {
  Notifications,
  NotificationsController,
} from "./notifications/notifications";
import {
  PaymentWebhookController,
  Payments,
  PaymentsController,
} from "./payments/payments";
import { Delivery } from "./delivery";
import { Dispatch } from "./dispatch";
import { DeliveryController } from "./delivery.controller";
import { Accounts } from "./accounts/accounts";
import { betaEnabled } from "./runtime";
import { Tracking } from "./tracking";
import { TrackingGateway } from "./tracking.gateway";
import { TrackingController } from "./tracking.controller";
import { MapsController, MapsSearch } from "./maps";
import {
  AccountAccessController,
  AccountManagementController,
} from "./accounts/accounts.controller";
@Controller("api")
class PublicController {
  constructor(@Inject(Database) private db: Database) {}
  @Get("health") async health() {
    await this.db.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      development: developmentEnabled(),
      payments: betaEnabled()
        ? "beta_simulated"
        : developmentEnabled()
          ? "development"
          : "not_configured",
      beta: betaEnabled(),
      otp: "not_configured",
      push: "not_configured",
      petpooja: "not_configured",
      deliveryVerification:
        (process.env.DELIVERY_OTP_SECRET?.length ?? 0) >= 32
          ? "configured"
          : "not_configured",
      staffAuthentication: "password",
    };
  }
  @Get("menu") async menu() {
    return this.db.product.findMany({
      where: { outletId: "shankarpally" },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }
  @Get("outlet") async outlet() {
    return this.db.outlet.findUniqueOrThrow({ where: { id: "shankarpally" } });
  }
  @Post("auth/development") async login(@Body() body: unknown) {
    if (!developmentEnabled())
      throw new ServiceUnavailableException(
        "Authentication provider is not configured",
      );
    const parsed = z
      .object({
        identity: z.enum([
          "customer",
          "customer2",
          "counter",
          "kitchen",
          "owner",
          "rider",
          "rider2",
        ]),
      })
      .strict()
      .safeParse(body);
    if (!parsed.success)
      throw new BadRequestException("Select a development identity");
    const user = await this.db.user.findUnique({
      where: { id: `dev-${parsed.data.identity}` },
    });
    if (!user || user.disabledAt)
      throw new ServiceUnavailableException(
        "Development identities are not seeded",
      );
    const token = randomBytes(32).toString("hex");
    await this.db.session.create({
      data: {
        tokenHash: hash(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        authVersion: user.authVersion,
        authMethod: "development",
      },
    });
    return { token, user: publicActor(user), development: true };
  }
}
@Controller("api")
@UseGuards(SessionGuard)
class ProtectedController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(Orders) private orders: Orders,
  ) {}
  @Get("me") me(@Req() req: AuthRequest) {
    return publicActor(req.actor);
  }
  @Delete("session") async logout(@Headers("authorization") header: string) {
    await this.db.session.deleteMany({
      where: { tokenHash: hash(header.slice(7)) },
    });
    return { ok: true };
  }
  @Get("orders") list(@Req() req: AuthRequest) {
    return this.orders.list(req.actor);
  }
  @Post("orders") create(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.orders.create(req.actor, body, key);
  }
  @Post("orders/:id/development-payment") pay(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    if (!developmentEnabled())
      throw new ServiceUnavailableException(
        "Development payments are disabled",
      );
    const parsed = z
      .object({ eventId: z.string().min(8).max(128) })
      .strict()
      .safeParse(body);
    if (!parsed.success)
      throw new BadRequestException("A payment event ID is required");
    return this.orders.payDevelopment(req.actor, id, parsed.data.eventId);
  }
  @Post("orders/:id/actions") action(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.orders.action(req.actor, id, body);
  }
  @Post("orders/:id/beta-payment") betaPayment(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    if (!betaEnabled())
      throw new ServiceUnavailableException("Beta payments are disabled");
    const parsed = z
      .object({ eventId: z.string().min(8).max(128) })
      .strict()
      .safeParse(body);
    if (!parsed.success)
      throw new BadRequestException("A payment event ID is required");
    return this.orders.payDevelopment(
      req.actor,
      id,
      parsed.data.eventId,
      "beta_simulated",
    );
  }
  @Patch("menu/:id") async availability(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    permit(req.actor.role, "menu:write");
    const p = z.object({ available: z.boolean() }).strict().safeParse(body);
    if (!p.success)
      throw new BadRequestException("Availability must be a boolean");
    return this.db.$transaction(async (tx) => {
      const changed = await tx.product.updateMany({
        where: { id, outletId: req.actor.outletId },
        data: p.data,
      });
      if (!changed.count) throw new NotFoundException("Product not found");
      await tx.auditEvent.create({
        data: {
          actorId: req.actor.id,
          outletId: req.actor.outletId,
          resourceId: id,
          action: "menu.availability",
          detail: String(p.data.available),
        },
      });
      return { ok: true };
    });
  }
  @Patch("outlet") async pause(@Req() req: AuthRequest, @Body() body: unknown) {
    permit(req.actor.role, "outlet:pause");
    const p = z.object({ paused: z.boolean() }).strict().safeParse(body);
    if (!p.success) throw new BadRequestException("Paused must be a boolean");
    return this.db.$transaction(async (tx) => {
      const outlet = await tx.outlet.update({
        where: { id: req.actor.outletId },
        data: p.data,
      });
      await tx.auditEvent.create({
        data: {
          actorId: req.actor.id,
          outletId: req.actor.outletId,
          resourceId: outlet.id,
          action: "outlet.pause",
          detail: String(p.data.paused),
        },
      });
      return outlet;
    });
  }
  @Get("audit") audit(@Req() req: AuthRequest) {
    permit(req.actor.role, "audit:read");
    return this.db.auditEvent.findMany({
      where: { outletId: req.actor.outletId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
@Module({
  controllers: [
    PublicController,
    ProtectedController,
    DeliveryController,
    AddressesController,
    AccountAccessController,
    EmailRecoveryController,
    EmailManagementController,
    PaymentsController,
    PaymentWebhookController,
    SupportController,
    EngagementController,
    NotificationsController,
    AccountManagementController,
    TrackingController,
    MapsController,
  ],
  providers: [
    Database,
    SessionGuard,
    Orders,
    Delivery,
    Addresses,
    Mailer,
    EmailAccounts,
    Payments,
    Notifications,
    Support,
    Engagement,
    Dispatch,
    Accounts,
    Tracking,
    TrackingGateway,
    MapsSearch,
  ],
})
export class AppModule {}
