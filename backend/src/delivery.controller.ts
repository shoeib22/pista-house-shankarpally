import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, SessionGuard } from "./auth";
import { Database } from "./database";
import { permit } from "./domain";
import { Delivery } from "./delivery";
import { Dispatch } from "./dispatch";
import { Tracking } from "./tracking";
@Controller("api")
@UseGuards(SessionGuard)
export class DeliveryController {
  constructor(
    @Inject(Delivery) private delivery: Delivery,
    @Inject(Dispatch) private dispatch: Dispatch,
    @Inject(Tracking) private tracking: Tracking,
    @Inject(Database) private db: Database,
  ) {}
  @Get("rider/offer") offer(@Req() req: AuthRequest) {
    return this.delivery.currentOffer(req.actor);
  }
  @Post("rider/offers/:id/respond") respond(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.delivery.respondOffer(req.actor, id, body);
  }
  @Get("rider/tasks/:id/route") riderRoute(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Query("lat") lat: string,
    @Query("lon") lon: string,
  ) {
    return this.tracking.riderRoute(req.actor, id, lat, lon);
  }
  @Get("dispatch/status") dispatchStatus(@Req() req: AuthRequest) {
    permit(req.actor.role, "delivery:dispatch");
    return this.dispatch.status(req.actor.outletId);
  }
  @Patch("outlet/auto-dispatch") async autoDispatch(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    permit(req.actor.role, "outlet:pause");
    const p = z.object({ enabled: z.boolean() }).strict().safeParse(body);
    if (!p.success) throw new BadRequestException("Enabled must be a boolean");
    return this.db.$transaction(async (tx) => {
      const outlet = await tx.outlet.update({
        where: { id: req.actor.outletId },
        data: { autoDispatch: p.data.enabled },
        select: { id: true, autoDispatch: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: req.actor.id,
          outletId: req.actor.outletId,
          resourceId: outlet.id,
          action: "outlet.auto_dispatch",
          detail: String(p.data.enabled),
        },
      });
      return outlet;
    });
  }
  @Get("riders") riders(@Req() req: AuthRequest) {
    return this.delivery.riders(req.actor);
  }
  @Patch("rider/availability") availability(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.delivery.availability(req.actor, body);
  }
  @Get("rider/tasks") tasks(@Req() req: AuthRequest) {
    return this.delivery.tasks(req.actor);
  }
  @Post("orders/:id/assignment") assign(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.delivery.assign(req.actor, id, body);
  }
  @Post("assignments/:id/staff-actions") staff(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.delivery.staffAction(req.actor, id, body);
  }
  @Post("rider/tasks/:id/actions") action(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.delivery.riderAction(req.actor, id, body);
  }
  @Post("rider/tasks/:id/complete") complete(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.delivery.complete(req.actor, id, body);
  }
  @Post("orders/:id/delivery-code") code(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.delivery.issueCode(req.actor, id);
  }
}
