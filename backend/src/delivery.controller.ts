import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthRequest, SessionGuard } from "./auth";
import { Delivery } from "./delivery";
@Controller("api")
@UseGuards(SessionGuard)
export class DeliveryController {
  constructor(@Inject(Delivery) private delivery: Delivery) {}
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
