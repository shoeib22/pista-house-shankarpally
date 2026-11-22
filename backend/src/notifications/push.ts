import { createSign } from "node:crypto";

export type PushMessage = {
  title: string;
  body: string;
  /** Small string map the app uses to open the right screen. */
  data: Record<string, string>;
  /** p0 is time-critical (order and delivery updates). */
  priority: "p0" | "p1" | "p2";
};
export type PushResult = {
  token: string;
  ok: boolean;
  /** True when the token is dead (app uninstalled, token expired) and must be dropped. */
  invalidToken?: boolean;
  error?: string;
};

/**
 * Delivers a notification to phones. Notifications are always saved for the
 * in-app inbox; this only handles the extra "wake the phone" step.
 */
export interface PushProvider {
  readonly name: string;
  /** Whether messages really leave this server. */
  readonly delivers: boolean;
  send(tokens: string[], message: PushMessage): Promise<PushResult[]>;
}

/** Writes nothing anywhere and reports "not sent". The default until FCM is set up. */
export class NoPush implements PushProvider {
  readonly name = "none";
  readonly delivers = false;
  async send(tokens: string[]): Promise<PushResult[]> {
    return tokens.map((token) => ({
      token,
      ok: false,
      error: "push not configured",
    }));
  }
}

/** Keeps everything it was asked to send (automated tests only). */
export class MemoryPush implements PushProvider {
  readonly name = "memory";
  readonly delivers = true;
  readonly sent: { token: string; message: PushMessage }[] = [];
  deadTokens = new Set<string>();
  async send(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    return tokens.map((token) => {
      if (this.deadTokens.has(token))
        return { token, ok: false, invalidToken: true, error: "UNREGISTERED" };
      this.sent.push({ token, message });
      return { token, ok: true };
    });
  }
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString("base64url");

/**
 * Firebase Cloud Messaging (HTTP v1). Covers Android, and iOS through Firebase's
 * link to Apple's push service. Written from Google's documentation and covered
 * by tests against a fake server; NOT yet run against a real Firebase project.
 *
 * Settings: FCM_PROJECT_ID and the service-account JSON in FCM_SERVICE_ACCOUNT
 * (the JSON text) or FCM_SERVICE_ACCOUNT_FILE (a path). Keep the key on the
 * server only. For iPhones, upload an Apple push (APNs) key to the Firebase
 * project; for the apps, add firebase_messaging (see docs/notifications.md).
 */
export class FcmPush implements PushProvider {
  readonly name = "fcm";
  readonly delivers = true;
  private cached?: { token: string; until: number };

  private account(): { client_email: string; private_key: string } | null {
    try {
      const raw =
        process.env.FCM_SERVICE_ACCOUNT ??
        (process.env.FCM_SERVICE_ACCOUNT_FILE
          ? require("node:fs").readFileSync(
              process.env.FCM_SERVICE_ACCOUNT_FILE,
              "utf8",
            )
          : "");
      const a = JSON.parse(raw);
      return a.client_email && a.private_key ? a : null;
    } catch {
      return null;
    }
  }
  configured() {
    return !!process.env.FCM_PROJECT_ID && !!this.account();
  }

  /** A short-lived Google access token from the service account (JWT bearer). */
  async accessToken(): Promise<string> {
    if (this.cached && this.cached.until > Date.now() + 60000)
      return this.cached.token;
    const account = this.account();
    if (!account) throw new Error("FCM service account is not configured");
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
    const signature = createSign("RSA-SHA256")
      .update(`${header}.${claims}`)
      .sign(account.private_key);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${header}.${claims}.${b64url(signature)}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await response.json().catch(() => null)) as any;
    if (!response.ok || typeof data?.access_token !== "string")
      throw new Error(`Google token request failed (${response.status})`);
    this.cached = {
      token: data.access_token,
      until: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    return data.access_token;
  }

  async send(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    if (!this.configured())
      return tokens.map((token) => ({
        token,
        ok: false,
        error: "FCM not configured",
      }));
    let access: string;
    try {
      access = await this.accessToken();
    } catch (e) {
      return tokens.map((token) => ({
        token,
        ok: false,
        error: (e as Error).message,
      }));
    }
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
      process.env.FCM_PROJECT_ID as string,
    )}/messages:send`;
    const urgent = message.priority === "p0";
    return Promise.all(
      tokens.map(async (token): Promise<PushResult> => {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              authorization: `Bearer ${access}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: message.title, body: message.body },
                data: message.data,
                android: { priority: urgent ? "HIGH" : "NORMAL" },
                apns: {
                  headers: { "apns-priority": urgent ? "10" : "5" },
                  payload: { aps: { sound: "default" } },
                },
              },
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) return { token, ok: true };
          const err = (await response.json().catch(() => null)) as any;
          const code = `${err?.error?.status ?? response.status}`;
          return {
            token,
            ok: false,
            invalidToken:
              response.status === 404 ||
              code === "UNREGISTERED" ||
              code === "NOT_FOUND",
            error: code,
          };
        } catch {
          return { token, ok: false, error: "network" };
        }
      }),
    );
  }
}

/** The provider named by PUSH_PROVIDER (default: none). */
export function currentPush(): PushProvider {
  const name = (process.env.PUSH_PROVIDER || "none").toLowerCase();
  if (name === "fcm") return new FcmPush();
  if (name === "memory") return memoryPush;
  return new NoPush();
}
export const memoryPush = new MemoryPush();
