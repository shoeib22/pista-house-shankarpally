import { Controller, Get, Inject, Param, Req, UseGuards } from "@nestjs/common";
import { AuthRequest, SessionGuard } from "./auth";
import { Tracking } from "./tracking";
@Controller("api/orders")
@UseGuards(SessionGuard)
export class TrackingController {
  constructor(@Inject(Tracking) private tracking: Tracking) {}
  @Get(":id/tracking") snapshot(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.tracking.snapshot(req.actor, id);
  }
  @Get(":id/route") route(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.tracking.route(req.actor, id);
  }
}
