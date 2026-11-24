import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/**
 * Response headers for a JSON-only API. Nothing here is ever meant to be
 * rendered, framed or cached by a browser or a shared proxy.
 */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  next();
}

export interface LimiterOptions {
  windowMs: number;
  /** Requests allowed per window for a caller who sent no credentials. */
  anonymousMax: number;
  /** Requests allowed per window for a caller who sent a bearer token. */
  signedInMax: number;
  now?: () => number;
  /** Paths (prefixes) that skip the limiter, such as signed gateway callbacks. */
  skip?: string[];
}

/**
 * A per-address request ceiling in front of everything under /api. It is
 * deliberately simple and in memory: it blunts scraping and floods from one
 * address on one server. Password guessing has its own, database-backed,
 * per-account throttle in the accounts module.
 */
export function createRateLimiter(options: LimiterOptions) {
  const now = options.now ?? Date.now;
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    if (!path.startsWith("/api") || options.skip?.some((p) => path.startsWith(p)))
      return next();
    const signedIn = /^Bearer \S+$/.test(req.headers.authorization ?? "");
    const limit = signedIn ? options.signedInMax : options.anonymousMax;
    const key = `${signedIn ? "s" : "a"}:${req.ip ?? "unknown"}`;
    const t = now();
    if (buckets.size > 20000)
      for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= t) {
      bucket = { count: 0, resetAt: t + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > limit) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((bucket.resetAt - t) / 1000))),
      );
      res
        .status(429)
        .json({ statusCode: 429, message: "Too many requests. Slow down." });
      return;
    }
    next();
  };
}

const number = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function configureSecurity(app: INestApplication) {
  const server = app.getHttpAdapter().getInstance();
  server.disable("x-powered-by");
  // Behind the Cloudflare tunnel every request reaches us from loopback, so
  // without this the per-address limits would treat the whole world as one
  // caller. Only a loopback peer is believed about forwarded addresses.
  if (process.env.TRUST_PROXY === "true") server.set("trust proxy", "loopback");
  app.use(securityHeaders);
  app.use(
    createRateLimiter({
      windowMs: 60_000,
      anonymousMax: number(process.env.RATE_LIMIT_ANONYMOUS_PER_MIN, 90),
      signedInMax: number(process.env.RATE_LIMIT_SIGNED_IN_PER_MIN, 600),
      skip: ["/api/payments/webhook/"],
    }),
  );
}
