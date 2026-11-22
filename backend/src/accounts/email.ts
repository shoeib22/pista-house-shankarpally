import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Inject,
  Injectable,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Actor, AuthRequest, SessionGuard } from "../auth";
import { Database } from "../database";
import { Mailer } from "../mailer";
import { betaEnabled } from "../runtime";
import { Accounts, normalizePhone, passwordSchema } from "./accounts";
import { passwordHash } from "./passwords";

export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 60;
const dailyLimit = () => {
  const v = Number(process.env.MAIL_DAILY_LIMIT);
  return Number.isFinite(v) && v > 0 ? v : 80; // stays inside a 100/day free tier
};
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(120);
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const p = schema.safeParse(body);
  if (!p.success)
    throw new BadRequestException(
      p.error.issues.map((i) => i.message).join("; "),
    );
  return p.data;
}
const secret = () => {
  const v = process.env.DELIVERY_OTP_SECRET;
  if (!v || v.length < 32)
    throw new ServiceUnavailableException("Email codes are not configured");
  return v;
};
const digest = (id: string, code: string) =>
  createHmac("sha256", secret())
    .update(`email-code:${id}:${code}`)
    .digest("hex");
const same = (a: string, b: string) => {
  const x = Buffer.from(a, "hex"),
    y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
};
const WRONG = "That code is not right, or it has expired. Request a new one.";

type Purpose = "verify" | "reset";

@Injectable()
export class EmailAccounts {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(Accounts) private accounts: Accounts,
    @Inject(Mailer) private mailer: Mailer,
  ) {}

  /** Creates and emails a one-time code. Returns whether the email was sent. */
  async issue(
    user: { id: string; name: string },
    email: string,
    purpose: Purpose,
    options: { silentCooldown?: boolean } = {},
  ): Promise<boolean> {
    const now = new Date();
    const last = await this.db.emailCode.findFirst({
      where: { userId: user.id, purpose },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      last &&
      now.getTime() - last.createdAt.getTime() < RESEND_SECONDS * 1000
    ) {
      if (options.silentCooldown) return false;
      throw new HttpException(
        `Please wait a minute before asking for another code.`,
        429,
      );
    }
    const today = await this.db.emailCode.count({
      where: { createdAt: { gte: new Date(now.getTime() - 24 * 3600000) } },
    });
    if (today >= dailyLimit()) {
      if (options.silentCooldown) return false;
      throw new ServiceUnavailableException(
        "Email is temporarily unavailable. Please try again later.",
      );
    }
    const code = String(randomInt(100000, 1000000));
    const row = await this.db.$transaction(async (tx) => {
      await tx.emailCode.updateMany({
        where: { userId: user.id, purpose, usedAt: null },
        data: { usedAt: now },
      });
      const created = await tx.emailCode.create({
        data: {
          userId: user.id,
          purpose,
          email,
          codeHash: "pending",
          expiresAt: new Date(now.getTime() + CODE_MINUTES * 60000),
        },
      });
      return tx.emailCode.update({
        where: { id: created.id },
        data: { codeHash: digest(created.id, code) },
      });
    });
    const verifying = purpose === "verify";
    const sent = await this.mailer.send({
      to: email,
      subject: verifying
        ? `Your Pista House verification code: ${code}`
        : `Your Pista House passphrase reset code: ${code}`,
      text:
        `Hello ${user.name},\n\n` +
        (verifying
          ? `Your Pista House verification code is ${code}.\n`
          : `Your Pista House passphrase reset code is ${code}.\n`) +
        `It works once and expires in ${CODE_MINUTES} minutes.\n\n` +
        (verifying
          ? `If you did not create a Pista House account, you can ignore this email.`
          : `If you did not ask to reset your passphrase, ignore this email. Your passphrase has not changed.`),
    });
    // A real provider that failed leaves no usable code behind. In local `log`
    // mode the code is in this server's log, so it stays valid for testing.
    if (!sent && this.mailer.delivers())
      await this.db.emailCode.update({
        where: { id: row.id },
        data: { usedAt: now },
      });
    return sent;
  }

  /**
   * Checks a code against the latest live one for this user and purpose. Wrong
   * guesses count; after MAX_ATTEMPTS the code is dead. Returns the code row id.
   */
  private async check(userId: string, purpose: Purpose, code: string) {
    const live = await this.db.emailCode.findFirst({
      where: {
        userId,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!live) throw new BadRequestException(WRONG);
    const counted = await this.db.emailCode.updateMany({
      where: { id: live.id, usedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (!counted.count) throw new BadRequestException(WRONG);
    if (!same(digest(live.id, code), live.codeHash))
      throw new BadRequestException(WRONG);
    return live;
  }

  async me(actor: Actor) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        emailVerifiedAt: true,
        credential: { select: { handle: true } },
      },
    });
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      handle: user.credential?.handle ?? null,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
    };
  }

  async setEmail(actor: Actor, body: unknown) {
    this.customer(actor);
    const { email } = parse(z.object({ email: emailSchema }).strict(), body);
    const current = await this.db.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { name: true, email: true, emailVerifiedAt: true },
    });
    if (current.email === email && current.emailVerifiedAt)
      return { email, verified: true, sent: false };
    await this.db.user.update({
      where: { id: actor.id },
      data: { email, emailVerifiedAt: null },
    });
    const sent = await this.issue(
      { id: actor.id, name: current.name },
      email,
      "verify",
    );
    return { email, verified: false, sent };
  }

  async resend(actor: Actor) {
    this.customer(actor);
    const u = await this.db.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { name: true, email: true, emailVerifiedAt: true },
    });
    if (!u.email) throw new BadRequestException("Add an email address first");
    if (u.emailVerifiedAt) return { verified: true, sent: false };
    const sent = await this.issue(
      { id: actor.id, name: u.name },
      u.email,
      "verify",
    );
    return { verified: false, sent };
  }

  async verify(actor: Actor, body: unknown) {
    this.customer(actor);
    const { code } = parse(
      z
        .object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") })
        .strict(),
      body,
    );
    await this.accounts.throttle("verify-email", actor.id, actor.id);
    const u = await this.db.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { email: true, emailVerifiedAt: true },
    });
    if (u.emailVerifiedAt) return { verified: true };
    if (!u.email) throw new BadRequestException("Add an email address first");
    const row = await this.check(actor.id, "verify", code);
    if (row.email !== u.email) throw new BadRequestException(WRONG);
    try {
      await this.db.$transaction(async (tx) => {
        await tx.emailCode.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        });
        await tx.user.update({
          where: { id: actor.id },
          data: { emailVerifiedAt: new Date() },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            outletId: actor.outletId,
            resourceId: actor.id,
            action: "account.email_verified",
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ConflictException(
          "That email address is already verified on another account.",
        );
      throw e;
    }
    return { verified: true };
  }

  /** The customer an identifier (mobile number or email) points to, if verified. */
  private async customerFor(identifier: string) {
    const id = identifier.trim().toLowerCase();
    const match = id.includes("@")
      ? { email: id }
      : { credential: { handle: normalizePhone(id) ?? id } };
    return this.db.user.findFirst({
      where: {
        AND: [
          match,
          {
            role: "customer",
            disabledAt: null,
            emailVerifiedAt: { not: null },
          },
          { email: { not: null } },
        ],
      },
      select: { id: true, name: true, email: true, outletId: true },
    });
  }

  /** Always answers the same, so it cannot be used to find out who has an account. */
  async forgot(body: unknown, ip: string) {
    const { identifier } = parse(
      z.object({ identifier: z.string().trim().min(3).max(120) }).strict(),
      body,
    );
    if (!betaEnabled() || process.env.CUSTOMER_REGISTRATION === "off")
      throw new ServiceUnavailableException(
        "Passphrase reset is not available",
      );
    await this.accounts.throttle("forgot", ip, identifier.toLowerCase());
    const user = await this.customerFor(identifier);
    if (user?.email)
      await this.issue(user, user.email, "reset", { silentCooldown: true });
    return {
      ok: true,
      message:
        "If a verified email matches, a reset code is on its way. It expires in 10 minutes.",
    };
  }

  async reset(body: unknown, ip: string) {
    const { identifier, code, password } = parse(
      z
        .object({
          identifier: z.string().trim().min(3).max(120),
          code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
          password: passwordSchema,
        })
        .strict(),
      body,
    );
    if (!betaEnabled() || process.env.CUSTOMER_REGISTRATION === "off")
      throw new ServiceUnavailableException(
        "Passphrase reset is not available",
      );
    await this.accounts.throttle("reset", ip, identifier.toLowerCase());
    const user = await this.customerFor(identifier);
    if (!user) throw new BadRequestException(WRONG);
    const row = await this.check(user.id, "reset", code);
    const encoded = await passwordHash(password);
    await this.db.$transaction(async (tx) => {
      const claimed = await tx.emailCode.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!claimed.count) throw new BadRequestException(WRONG);
      await tx.user.update({
        where: { id: user.id },
        data: { authVersion: { increment: 1 } },
      });
      await tx.credential.update({
        where: { userId: user.id },
        data: { passwordHash: encoded, changedAt: new Date() },
      });
      // Everyone signed in with the old passphrase is signed out.
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          outletId: user.outletId,
          resourceId: user.id,
          action: "account.password_reset",
          detail: "by emailed code",
        },
      });
    });
    return { ok: true };
  }

  private customer(actor: Actor) {
    if (actor.role !== "customer")
      throw new ForbiddenException("Customer access required");
  }
}

@Controller("api/auth")
export class EmailRecoveryController {
  constructor(@Inject(EmailAccounts) private email: EmailAccounts) {}
  @Post("forgot") forgot(@Body() body: unknown, @Req() req: Request) {
    return this.email.forgot(body, req.ip ?? "unknown");
  }
  @Post("reset") reset(@Body() body: unknown, @Req() req: Request) {
    return this.email.reset(body, req.ip ?? "unknown");
  }
}

@Controller("api/auth")
@UseGuards(SessionGuard)
export class EmailManagementController {
  constructor(@Inject(EmailAccounts) private email: EmailAccounts) {}
  @Get("me") me(@Req() req: AuthRequest) {
    return this.email.me(req.actor);
  }
  @Post("email") set(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.email.setEmail(req.actor, body);
  }
  @Post("email/resend") resend(@Req() req: AuthRequest) {
    return this.email.resend(req.actor);
  }
  @Post("email/verify") verify(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.email.verify(req.actor, body);
  }
}
