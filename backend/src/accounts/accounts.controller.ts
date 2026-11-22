import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { Accounts } from "./accounts";
import { AuthRequest, hash, SessionGuard } from "../auth";
@Controller("api/auth")
export class AccountAccessController {
  constructor(@Inject(Accounts) private accounts: Accounts) {}
  @Post("login") login(@Body() body: unknown, @Req() req: Request) {
    return this.accounts.login(body, req.ip ?? "unknown");
  }
  @Post("register") register(@Body() body: unknown, @Req() req: Request) {
    return this.accounts.register(body, req.ip ?? "unknown");
  }
  @Post("accept-invitation") accept(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.accounts.accept(body, req.ip ?? "unknown");
  }
}
@Controller("api")
@UseGuards(SessionGuard)
export class AccountManagementController {
  constructor(@Inject(Accounts) private accounts: Accounts) {}
  @Get("team") team(@Req() req: AuthRequest) {
    return this.accounts.team(req.actor);
  }
  @Get("team/invitations") invitations(@Req() req: AuthRequest) {
    return this.accounts.invitations(req.actor);
  }
  @Post("team/invitations") invite(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.accounts.invite(req.actor, body);
  }
  @Delete("team/invitations/:id") revoke(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.accounts.revokeInvitation(req.actor, id);
  }
  @Post("team/:id/recovery-invitation") recover(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.accounts.recover(req.actor, id);
  }
  @Patch("team/:id/status") status(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.accounts.status(req.actor, id, body);
  }
  @Get("auth/sessions") sessions(
    @Req() req: AuthRequest,
    @Headers("authorization") value: string,
  ) {
    return this.accounts.sessions(req.actor, hash(value.slice(7)));
  }
  @Delete("auth/sessions/:id") revokeSession(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.accounts.revokeSession(req.actor, id);
  }
  @Post("auth/logout-all") logoutAll(@Req() req: AuthRequest) {
    return this.accounts.logoutAll(req.actor);
  }
  @Post("auth/password") password(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.accounts.changePassword(req.actor, body);
  }
}
