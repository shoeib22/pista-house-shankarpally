import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Actor, hash, publicActor, developmentEnabled } from "../auth";
import { Database } from "../database";
import { permit } from "../domain";
import { dummyPasswordHash, passwordHash, passwordMatches } from "./passwords";
import { betaEnabled } from "../runtime";
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,47}$/,
    "Use 3–48 lowercase letters, numbers, dots, underscores or hyphens",
  );
/**
 * Indian mobile numbers are the customer handle. Accepts "+91 90000 00000",
 * "09000000000" and similar, and returns the 10 digits, or null if it is not a
 * mobile number.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s().-]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0"))
    digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
/** A sign-in handle: a username, or a mobile number written any usual way. */
const loginHandle = z
  .string()
  .trim()
  .toLowerCase()
  .transform((h) => normalizePhone(h) ?? h)
  .pipe(handleSchema);
export const passwordSchema = z
  .string()
  .min(12, "Use a passphrase of at least 12 characters")
  .max(128, "Use at most 128 characters");
const audienceSchema = z.enum(["employee", "owner", "rider", "customer"]);
const workerRoles = ["counter", "kitchen", "rider"];
const teamSelect = {
  id: true,
  outletId: true,
  name: true,
  role: true,
  disabledAt: true,
  riderAvailable: true,
  developmentOnly: true,
  credential: { select: { handle: true } },
};
const invitationSelect = {
  id: true,
  handle: true,
  name: true,
  role: true,
  kind: true,
  developmentOnly: true,
  userId: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
  createdAt: true,
};
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const p = schema.safeParse(body);
  if (!p.success)
    throw new BadRequestException(
      p.error.issues.map((i) => i.message).join("; "),
    );
  return p.data;
}
function allows(role: string, audience: string) {
  return audience === "employee"
    ? ["owner", "counter", "kitchen"].includes(role)
    : role === audience;
}
async function newSession(
  tx: Prisma.TransactionClient,
  user: Actor & { authVersion: number },
) {
  const token = randomBytes(32).toString("hex"),
    expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await tx.session.create({
    data: {
      tokenHash: hash(token),
      userId: user.id,
      expiresAt,
      authVersion: user.authVersion,
      authMethod: "password",
    },
  });
  return { token, expiresAt, user: publicActor(user) };
}
@Injectable()
export class Accounts {
  constructor(@Inject(Database) private db: Database) {}
  async throttle(scope: string, ip: string, identity: string) {
    // Never trust caller-supplied forwarding headers. Store only opaque bucket keys.
    const buckets = [
      { key: hash(`${scope}:ip:${ip}`), limit: 30 },
      { key: hash(`${scope}:identity:${identity}`), limit: 8 },
    ];
    const blocked = await this.db.$transaction(async (tx) => {
      let blocked = false;
      for (const bucket of buckets) {
        const rows = await tx.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "AuthThrottle" ("key","attempts","resetAt") VALUES (${bucket.key},1,NOW()+INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts"=CASE WHEN "AuthThrottle"."resetAt"<=NOW() THEN 1 ELSE LEAST("AuthThrottle"."attempts"+1,1000) END,
      "resetAt"=CASE WHEN "AuthThrottle"."resetAt"<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE "AuthThrottle"."resetAt" END
    RETURNING "attempts"`;
        if (rows[0].attempts > bucket.limit) blocked = true;
      }
      return blocked;
    });
    await this.db.authThrottle.deleteMany({
      where: { resetAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (blocked)
      throw new HttpException(
        "Too many sign-in attempts. Try again in 15 minutes.",
        429,
      );
  }
  async login(body: unknown, ip: string) {
    const { handle, password, audience } = parse(
      z
        .object({
          handle: loginHandle,
          password: z.string().min(1).max(128),
          audience: audienceSchema,
        })
        .strict(),
      body,
    );
    await this.throttle("login", ip, handle);
    if (audience === "customer" && !betaEnabled())
      throw new ServiceUnavailableException(
        "Customer phone verification is not configured",
      );
    const credential = await this.db.credential.findUnique({
      where: { handle },
      include: { user: true },
    });
    const matched = await passwordMatches(
      password,
      credential?.passwordHash ?? dummyPasswordHash,
    );
    if (
      !matched ||
      !credential ||
      credential.user.disabledAt ||
      (credential.user.developmentOnly && !developmentEnabled()) ||
      !allows(credential.user.role, audience)
    )
      throw new UnauthorizedException("Unable to sign in with these details");
    return this.db.$transaction(async (tx) => {
      // Recheck after password work to handle suspension/reset racing with login.
      const current = await tx.user.findFirst({
        where: {
          id: credential.userId,
          disabledAt: null,
          authVersion: credential.user.authVersion,
        },
      });
      if (!current)
        throw new UnauthorizedException("Unable to sign in with these details");
      const session = await newSession(tx, current);
      await tx.authThrottle.deleteMany({
        where: { key: hash(`login:identity:${handle}`) },
      });
      await tx.auditEvent.create({
        data: {
          actorId: current.id,
          outletId: current.outletId,
          resourceId: current.id,
          action: "account.signed_in",
        },
      });
      return session;
    });
  }
  /**
   * Customer self-registration with a mobile number and a passphrase. The number
   * is NOT verified (no SMS provider is configured), and this is only available
   * where customer password sign-in is, i.e. the private beta.
   */
  async register(body: unknown, ip: string) {
    const { name, phone, password, email } = parse(
      z
        .object({
          name: z.string().trim().min(2, "Enter your name").max(60),
          phone: z
            .string()
            .transform((v) => normalizePhone(v))
            .refine(
              (v): v is string => v !== null,
              "Enter a valid 10-digit mobile number",
            ),
          password: passwordSchema,
          email: z
            .string()
            .trim()
            .toLowerCase()
            .email("Enter a valid email address")
            .max(120)
            .optional(),
        })
        .strict(),
      body,
    );
    if (!betaEnabled() || process.env.CUSTOMER_REGISTRATION === "off")
      throw new ServiceUnavailableException(
        "Customer sign-up is not available yet",
      );
    await this.throttle("register", ip, phone as string);
    const outletId = process.env.DEFAULT_OUTLET_ID || "shankarpally";
    const outlet = await this.db.outlet.findUnique({ where: { id: outletId } });
    if (!outlet)
      throw new ServiceUnavailableException("The outlet is not configured");
    if (
      await this.db.credential.findUnique({
        where: { handle: phone as string },
      })
    )
      throw new ConflictException(
        "An account with this mobile number already exists. Sign in instead.",
      );
    const hashed = await passwordHash(password);
    try {
      return await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { outletId, name, role: "customer", email: email ?? null },
        });
        await tx.credential.create({
          data: {
            userId: user.id,
            handle: phone as string,
            passwordHash: hashed,
          },
        });
        const session = await newSession(tx, user);
        await tx.auditEvent.create({
          data: {
            actorId: user.id,
            outletId,
            resourceId: user.id,
            action: "account.registered",
            detail: "customer, phone not verified",
          },
        });
        return {
          ...session,
          phoneVerified: false,
          handle: phone,
          emailPending: email ?? null,
        };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ConflictException(
          "An account with this mobile number already exists. Sign in instead.",
        );
      throw e;
    }
  }
  async accept(body: unknown, ip: string) {
    const { token, password, audience } = parse(
      z
        .object({
          token: z.string().regex(/^[a-f0-9]{64}$/),
          password: passwordSchema,
          audience: audienceSchema,
        })
        .strict(),
      body,
    );
    await this.throttle("invitation", ip, hash(token));
    const invite = await this.db.invitation.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (
      !invite ||
      invite.usedAt ||
      invite.revokedAt ||
      invite.expiresAt <= new Date() ||
      (invite.developmentOnly && !developmentEnabled())
    )
      throw new BadRequestException(
        "This invitation is invalid or has expired",
      );
    if (!allows(invite.role, audience))
      throw new BadRequestException(
        "Open this invitation in the app for your role",
      );
    const encoded = await passwordHash(password);
    try {
      return await this.db.$transaction(async (tx) => {
        const issuer = await tx.user.findFirst({
          where: {
            id: invite.createdById,
            outletId: invite.outletId,
            role: "owner",
            disabledAt: null,
          },
        });
        if (!issuer || (issuer.developmentOnly && !developmentEnabled()))
          throw new BadRequestException("This invitation is no longer valid");
        const claimed = await tx.invitation.updateMany({
          where: {
            id: invite.id,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });
        if (!claimed.count)
          throw new ConflictException(
            "This invitation was already used, revoked or expired",
          );
        let user;
        if (invite.kind === "reset") {
          const changed = await tx.user.updateMany({
            where: {
              id: invite.userId!,
              outletId: invite.outletId,
              role: invite.role,
              ...(!developmentEnabled() ? { developmentOnly: false } : {}),
              disabledAt: null,
            },
            data: { authVersion: { increment: 1 }, riderAvailable: false },
          });
          if (!changed.count)
            throw new BadRequestException("This account is unavailable");
          user = await tx.user.findUniqueOrThrow({
            where: { id: invite.userId! },
          });
          await tx.credential.update({
            where: { userId: user.id },
            data: { passwordHash: encoded, changedAt: new Date() },
          });
          await tx.session.deleteMany({ where: { userId: user.id } });
        } else {
          user = await tx.user.create({
            data: {
              outletId: invite.outletId,
              name: invite.name,
              role: invite.role,
              developmentOnly: invite.developmentOnly,
              credential: {
                create: { handle: invite.handle, passwordHash: encoded },
              },
            },
          });
        }
        await tx.invitation.updateMany({
          where: { userId: user.id, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.auditEvent.create({
          data: {
            outletId: user.outletId,
            actorId: user.id,
            resourceId: user.id,
            action:
              invite.kind === "reset"
                ? "account.recovered"
                : "account.invitation_accepted",
          },
        });
        return newSession(tx, user);
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ConflictException("This handle is already registered");
      throw e;
    }
  }
  async team(actor: Actor) {
    permit(actor.role, "users:manage");
    return this.db.user.findMany({
      where: {
        outletId: actor.outletId,
        role: { in: ["owner", ...workerRoles] },
      },
      select: teamSelect,
      orderBy: { name: "asc" },
    });
  }
  async invitations(actor: Actor) {
    permit(actor.role, "users:manage");
    return this.db.invitation.findMany({
      where: { outletId: actor.outletId },
      select: invitationSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async invite(actor: Actor, body: unknown) {
    permit(actor.role, "users:manage");
    const input = parse(
      z
        .object({
          name: z.string().trim().min(2).max(100),
          handle: handleSchema,
          role: z.enum(["counter", "kitchen", "rider"]),
        })
        .strict(),
      body,
    );
    return this.createInvitation(actor, input, null);
  }
  async recover(actor: Actor, id: string) {
    permit(actor.role, "users:manage");
    const user = await this.db.user.findFirst({
      where: {
        id,
        outletId: actor.outletId,
        role: { in: workerRoles },
        disabledAt: null,
      },
      include: { credential: true },
    });
    if (!user?.credential)
      throw new NotFoundException("An enabled password account was not found");
    return this.createInvitation(
      actor,
      { name: user.name, handle: user.credential.handle, role: user.role },
      user.id,
    );
  }
  private async createInvitation(
    actor: Actor,
    input: { name: string; handle: string; role: string },
    userId: string | null,
  ) {
    const token = randomBytes(32).toString("hex"),
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      return await this.db.$transaction(async (tx) => {
        if (
          !userId &&
          (await tx.credential.findUnique({ where: { handle: input.handle } }))
        )
          throw new ConflictException("This handle is already registered");
        await tx.invitation.updateMany({
          where: {
            handle: input.handle,
            usedAt: null,
            revokedAt: null,
            ...(userId ? {} : { expiresAt: { lte: new Date() } }),
          },
          data: { revokedAt: new Date() },
        });
        const invite = await tx.invitation.create({
          data: {
            ...input,
            outletId: actor.outletId,
            createdById: actor.id,
            userId,
            kind: userId ? "reset" : "create",
            developmentOnly: actor.developmentOnly ?? false,
            tokenHash: hash(token),
            expiresAt,
          },
          select: invitationSelect,
        });
        await tx.auditEvent.create({
          data: {
            outletId: actor.outletId,
            actorId: actor.id,
            resourceId: invite.id,
            action: userId ? "account.recovery_invited" : "account.invited",
          },
        });
        return { ...invite, token };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ConflictException(
          "An active invitation already uses this handle",
        );
      throw e;
    }
  }
  async revokeInvitation(actor: Actor, id: string) {
    permit(actor.role, "users:manage");
    return this.db.$transaction(async (tx) => {
      const changed = await tx.invitation.updateMany({
        where: { id, outletId: actor.outletId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!changed.count)
        throw new NotFoundException("An unused invitation was not found");
      await tx.auditEvent.create({
        data: {
          outletId: actor.outletId,
          actorId: actor.id,
          resourceId: id,
          action: "account.invitation_revoked",
        },
      });
      return { ok: true };
    });
  }
  async status(actor: Actor, id: string, body: unknown) {
    permit(actor.role, "users:manage");
    const { disabled } = parse(
      z.object({ disabled: z.boolean() }).strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id, outletId: actor.outletId, role: { in: workerRoles } },
      });
      if (!user)
        throw new NotFoundException("A staff or rider account was not found");
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${id} FOR UPDATE`;
      if (disabled) {
        await tx.$queryRaw`SELECT "id" FROM "DeliveryAssignment" WHERE "riderId"=${id} AND "isActive"=true ORDER BY "id" FOR UPDATE`;
        const assignments = await tx.deliveryAssignment.findMany({
          where: { riderId: id, isActive: true },
          include: { order: true },
        });
        for (const assignment of assignments) {
          const beforePickup = assignment.status === "assigned",
            status = beforePickup ? "unassigned" : "failed",
            reason = "Rider account suspended by the outlet owner";
          await tx.deliveryAssignment.update({
            where: { id: assignment.id },
            data: {
              status,
              isActive: !beforePickup,
              version: { increment: 1 },
              failureReason: beforePickup ? null : reason,
              location: Prisma.DbNull,
              locationAt: null,
              locationRecordedAt: null,
              locationLease: null,
              otpHash: null,
              otpSalt: null,
            },
          });
          const order = await tx.order.updateMany({
            where: {
              id: assignment.orderId,
              version: assignment.order.version,
            },
            data: {
              status: beforePickup ? "ready" : "delivery_failed",
              version: { increment: 1 },
            },
          });
          if (!order.count)
            throw new ConflictException(
              "Delivery changed; retry account suspension",
            );
          await tx.assignmentEvent.create({
            data: {
              assignmentId: assignment.id,
              actorId: actor.id,
              action: status,
              reason,
            },
          });
          await tx.orderEvent.create({
            data: {
              orderId: assignment.orderId,
              actorId: actor.id,
              action: `delivery.${status}`,
              reason,
            },
          });
          await tx.outboxEvent.create({
            data: {
              outletId: actor.outletId,
              kind: `delivery.${status}`,
              resourceId: assignment.orderId,
              payload: { assignmentId: assignment.id, reason },
            },
          });
        }
      }
      await tx.user.update({
        where: { id },
        data: {
          disabledAt: disabled ? new Date() : null,
          authVersion: { increment: 1 },
          riderAvailable: false,
        },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.invitation.updateMany({
        where: { userId: id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          outletId: actor.outletId,
          actorId: actor.id,
          resourceId: id,
          action: disabled ? "account.suspended" : "account.reenabled",
        },
      });
      return { ok: true };
    });
  }
  async sessions(actor: Actor, currentHash: string) {
    const sessions = await this.db.session.findMany({
      where: {
        userId: actor.id,
        expiresAt: { gt: new Date() },
        authVersion: actor.authVersion ?? 0,
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        authMethod: true,
        tokenHash: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return sessions.map(({ tokenHash, ...session }) => ({
      ...session,
      current: tokenHash === currentHash,
    }));
  }
  async revokeSession(actor: Actor, id: string) {
    const changed = await this.db.session.deleteMany({
      where: { id, userId: actor.id },
    });
    if (!changed.count) throw new NotFoundException("Session not found");
    return { ok: true };
  }
  async logoutAll(actor: Actor) {
    return this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { authVersion: { increment: 1 } },
      });
      await tx.session.deleteMany({ where: { userId: actor.id } });
      return { ok: true };
    });
  }
  async changePassword(actor: Actor, body: unknown) {
    const { currentPassword, password } = parse(
      z
        .object({
          currentPassword: z.string().min(1).max(128),
          password: passwordSchema,
        })
        .strict(),
      body,
    );
    await this.throttle("password", actor.id, actor.id);
    const credential = await this.db.credential.findUnique({
      where: { userId: actor.id },
    });
    if (
      !credential ||
      !(await passwordMatches(currentPassword, credential.passwordHash))
    )
      throw new UnauthorizedException("Current password is incorrect");
    if (currentPassword === password)
      throw new BadRequestException("Choose a different passphrase");
    const encoded = await passwordHash(password);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: actor.id,
          disabledAt: null,
          authVersion: actor.authVersion ?? 0,
        },
        data: { authVersion: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException("Account changed; sign in again");
      await tx.credential.update({
        where: { userId: actor.id },
        data: { passwordHash: encoded, changedAt: new Date() },
      });
      await tx.session.deleteMany({ where: { userId: actor.id } });
      await tx.invitation.updateMany({
        where: { userId: actor.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          outletId: actor.outletId,
          actorId: actor.id,
          resourceId: actor.id,
          action: "account.password_changed",
        },
      });
      return newSession(
        tx,
        await tx.user.findUniqueOrThrow({ where: { id: actor.id } }),
      );
    });
  }
}
