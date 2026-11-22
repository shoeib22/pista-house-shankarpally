import { Injectable, Logger } from "@nestjs/common";

export type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Sends transactional email through a free-tier provider's web API (no extra
 * dependencies). Choose one with MAIL_PROVIDER:
 *
 *  - `resend`  RESEND_API_KEY, MAIL_FROM (a sender on a domain verified in Resend)
 *  - `brevo`   BREVO_API_KEY,  MAIL_FROM (a sender verified in Brevo)
 *  - `log`     (default) nothing is sent; the message, including any one-time
 *              code, is written to this server's own log. For testing on the PC.
 *  - `memory`  keeps messages in `outbox` (automated tests only)
 *
 * Secrets come only from the environment and are never logged.
 */
@Injectable()
export class Mailer {
  private log = new Logger("Mailer");
  readonly outbox: Mail[] = [];

  provider() {
    return (process.env.MAIL_PROVIDER || "log").toLowerCase();
  }

  /** True when mail really leaves this server. */
  delivers() {
    const p = this.provider();
    return (
      (p === "resend" &&
        !!process.env.RESEND_API_KEY &&
        !!process.env.MAIL_FROM) ||
      (p === "brevo" && !!process.env.BREVO_API_KEY && !!process.env.MAIL_FROM)
    );
  }

  async send(mail: Mail): Promise<boolean> {
    const provider = this.provider();
    try {
      if (provider === "memory") {
        this.outbox.push(mail);
        return true;
      }
      if (!this.delivers()) {
        this.log.warn(
          `Email provider not configured (MAIL_PROVIDER=${provider}). Email NOT sent.\n` +
            `To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`,
        );
        return false;
      }
      const from = process.env.MAIL_FROM as string;
      const response =
        provider === "resend"
          ? await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({
                from,
                to: [mail.to],
                subject: mail.subject,
                text: mail.text,
                ...(mail.html ? { html: mail.html } : {}),
              }),
              signal: AbortSignal.timeout(10000),
            })
          : await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: {
                "api-key": process.env.BREVO_API_KEY as string,
                "content-type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify({
                sender: { email: from, name: "Pista House" },
                to: [{ email: mail.to }],
                subject: mail.subject,
                textContent: mail.text,
                ...(mail.html ? { htmlContent: mail.html } : {}),
              }),
              signal: AbortSignal.timeout(10000),
            });
      if (!response.ok) {
        this.log.error(
          `${provider} rejected an email (HTTP ${response.status})`,
        );
        return false;
      }
      return true;
    } catch (e) {
      this.log.error(`Email send failed: ${(e as Error).name}`);
      return false;
    }
  }
}
