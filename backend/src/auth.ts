import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Request } from "express";
import { Database } from "./database";
export interface Actor {
  id: string;
  outletId: string;
  name: string;
  role: string;
  authVersion?: number;
  riderAvailable?: boolean;
  developmentOnly?: boolean;
}
export type AuthRequest = Request & { actor: Actor };
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const developmentEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.DEV_ADAPTERS === "true";
export const publicActor = (user: Actor) => ({
  id: user.id,
  outletId: user.outletId,
  name: user.name,
  role: user.role,
  riderAvailable: user.riderAvailable ?? false,
  developmentOnly: user.developmentOnly ?? false,
});
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(Database) private db: Database) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new UnauthorizedException("Sign in to continue");
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
      throw new UnauthorizedException("Session expired; sign in again");
    req.actor = session.user;
    return true;
  }
}
