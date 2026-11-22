import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Everything the app needs from a payment gateway, in one small interface. The
 * rest of the server never talks to a gateway directly, so changing gateway
 * means writing one adapter and setting PAYMENT_PROVIDER.
 */
export type SessionInput = {
  paymentId: string;
  orderNumber: number;
  amountPaise: number;
  currency: "INR";
  customerName: string;
  expiresAt: Date;
};
export type SessionOutput = {
  providerOrderId: string;
  /** Public values the app hands to the gateway's checkout. Never secrets. */
  clientParams: Record<string, unknown>;
};
export type ProviderStatus = {
  status: "paid" | "pending" | "failed";
  providerPaymentId?: string;
  amountPaise?: number;
  method?: string;
  failureCode?: string;
  failureReason?: string;
};
export type ProviderEvent = {
  /** Unique per delivery, used to ignore retried webhooks. */
  eventId: string;
  type:
    "payment.paid" | "payment.failed" | "refund.succeeded" | "refund.failed";
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  amountPaise?: number;
  method?: string;
  failureCode?: string;
  failureReason?: string;
};
export type RefundResult = {
  providerRefundId: string;
  status: "processing" | "succeeded";
};

export class SignatureError extends Error {}
export class ProviderError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  /** True for the built-in test provider that moves no money. */
  readonly simulated: boolean;
  /** Whether every setting this provider needs is present. */
  configured(): boolean;
  createSession(input: SessionInput): Promise<SessionOutput>;
  /** The public checkout values for an existing session (so a live one can be reused). */
  clientParams(
    input: SessionInput,
    providerOrderId: string,
  ): Record<string, unknown>;
  /**
   * Checks the proof the app got back from the gateway's checkout. A match only
   * shows the result is authentic: the server still confirms with the gateway
   * before treating an order as paid.
   */
  verifyClientResult?(input: {
    providerOrderId: string;
    result: Record<string, unknown>;
  }): { providerPaymentId: string } | null;
  /** Asks the gateway directly what happened to an order. */
  fetchStatus(providerOrderId: string): Promise<ProviderStatus>;
  /** Verifies a webhook's signature and describes it, or null if irrelevant. */
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): ProviderEvent | null;
  refund(input: {
    providerPaymentId: string;
    amountPaise: number;
    /** Our own refund id, so a retried call cannot refund twice. */
    reference: string;
  }): Promise<RefundResult>;
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export const hmacHex = (secret: string, data: string | Buffer) =>
  createHmac("sha256", secret).update(data).digest("hex");

/** Moves no money. Results are chosen by the tester through the simulate endpoint. */
export class SimulatedProvider implements PaymentProvider {
  readonly name = "simulated";
  readonly simulated = true;
  configured() {
    return true;
  }
  clientParams(input: SessionInput) {
    return {
      simulated: true,
      amountPaise: input.amountPaise,
      currency: input.currency,
      description: `Order #PH${String(input.orderNumber).padStart(4, "0")}`,
    };
  }
  async createSession(input: SessionInput): Promise<SessionOutput> {
    const providerOrderId = `sim_${input.paymentId}`;
    return { providerOrderId, clientParams: this.clientParams(input) };
  }
  async fetchStatus(): Promise<ProviderStatus> {
    // The simulated result arrives through the simulate endpoint, not from here.
    return { status: "pending" };
  }
  parseWebhook(): ProviderEvent | null {
    return null;
  }
  async refund(input: { reference: string }): Promise<RefundResult> {
    return {
      providerRefundId: `simref_${input.reference}`,
      status: "succeeded",
    };
  }
}

/**
 * Razorpay (https://razorpay.com/docs/). Written from the documented API shapes
 * and covered by signature tests, but NOT yet run against a live account:
 * check it end to end in Razorpay test mode before going live.
 *
 * Settings: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (server only),
 * RAZORPAY_WEBHOOK_SECRET (a separate secret set on the webhook).
 * Turn on auto-capture in the Razorpay dashboard: an authorized payment that is
 * never captured is refunded automatically after a few days.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";
  readonly simulated = false;
  private base = "https://api.razorpay.com/v1";
  configured() {
    return !!(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_WEBHOOK_SECRET
    );
  }
  private auth() {
    return (
      "Basic " +
      Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
      ).toString("base64")
    );
  }
  private async call(method: string, path: string, body?: unknown) {
    let response: Response;
    try {
      response = await fetch(this.base + path, {
        method,
        headers: {
          authorization: this.auth(),
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ProviderError("The payment service could not be reached");
    }
    const data = (await response.json().catch(() => null)) as any;
    if (!response.ok)
      throw new ProviderError(
        `Razorpay error ${response.status}: ${data?.error?.description ?? "request failed"}`,
      );
    return data;
  }
  async createSession(input: SessionInput): Promise<SessionOutput> {
    const order = await this.call("POST", "/orders", {
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.paymentId.slice(0, 40),
      notes: {
        paymentId: input.paymentId,
        orderNumber: String(input.orderNumber),
      },
    });
    if (typeof order?.id !== "string")
      throw new ProviderError("Unexpected response creating the payment");
    return {
      providerOrderId: order.id,
      clientParams: this.clientParams(input, order.id),
    };
  }
  clientParams(input: SessionInput, providerOrderId: string) {
    return {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: providerOrderId,
      amountPaise: input.amountPaise,
      currency: input.currency,
      name: "Pista House",
      description: `Order #PH${String(input.orderNumber).padStart(4, "0")}`,
      prefill: { name: input.customerName },
    };
  }
  verifyClientResult(input: {
    providerOrderId: string;
    result: Record<string, unknown>;
  }) {
    const paymentId = input.result.razorpay_payment_id,
      signature = input.result.razorpay_signature;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (
      typeof paymentId !== "string" ||
      typeof signature !== "string" ||
      !secret
    )
      return null;
    // Sign OUR stored order id, never the one the app sent back.
    const expected = hmacHex(secret, `${input.providerOrderId}|${paymentId}`);
    return same(expected, signature) ? { providerPaymentId: paymentId } : null;
  }
  async fetchStatus(providerOrderId: string): Promise<ProviderStatus> {
    const data = await this.call(
      "GET",
      `/orders/${encodeURIComponent(providerOrderId)}/payments`,
    );
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    const captured = items.find((p) => p.status === "captured");
    if (captured)
      return {
        status: "paid",
        providerPaymentId: captured.id,
        amountPaise: captured.amount,
        method: captured.method,
      };
    if (items.some((p) => p.status === "authorized" || p.status === "created"))
      return { status: "pending" };
    const failed = items.find((p) => p.status === "failed");
    return failed
      ? {
          status: "failed",
          failureCode: failed.error_code,
          failureReason: failed.error_description,
        }
      : { status: "pending" };
  }
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): ProviderEvent | null {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = headers["x-razorpay-signature"];
    if (!secret || !signature) throw new SignatureError("Missing signature");
    // Signed over the exact bytes received, so never re-serialise the JSON first.
    if (!same(hmacHex(secret, rawBody), signature))
      throw new SignatureError("Invalid signature");
    let body: any;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return null;
    }
    const eventId =
      headers["x-razorpay-event-id"] ?? hmacHex(secret, rawBody).slice(0, 32);
    const payment = body?.payload?.payment?.entity,
      refund = body?.payload?.refund?.entity;
    switch (body?.event) {
      case "payment.captured":
      case "order.paid":
        return payment
          ? {
              eventId,
              type: "payment.paid",
              providerOrderId: payment.order_id,
              providerPaymentId: payment.id,
              amountPaise: payment.amount,
              method: payment.method,
            }
          : null;
      case "payment.failed":
        return payment
          ? {
              eventId,
              type: "payment.failed",
              providerOrderId: payment.order_id,
              providerPaymentId: payment.id,
              failureCode: payment.error_code,
              failureReason: payment.error_description,
            }
          : null;
      case "refund.processed":
      case "refund.failed":
        return refund
          ? {
              eventId,
              type:
                body.event === "refund.processed"
                  ? "refund.succeeded"
                  : "refund.failed",
              providerRefundId: refund.id,
              providerPaymentId: refund.payment_id,
              amountPaise: refund.amount,
            }
          : null;
      default:
        return null;
    }
  }
  async refund(input: {
    providerPaymentId: string;
    amountPaise: number;
    reference: string;
  }): Promise<RefundResult> {
    const r = await this.call(
      "POST",
      `/payments/${encodeURIComponent(input.providerPaymentId)}/refund`,
      {
        amount: input.amountPaise,
        speed: "normal",
        receipt: input.reference.slice(0, 40),
        notes: { reference: input.reference },
      },
    );
    if (typeof r?.id !== "string")
      throw new ProviderError("Unexpected response creating the refund");
    return {
      providerRefundId: r.id,
      status: r.status === "processed" ? "succeeded" : "processing",
    };
  }
}

/** The provider named by PAYMENT_PROVIDER (default: simulated). */
export function currentProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER || "simulated").toLowerCase();
  if (name === "razorpay") return new RazorpayProvider();
  if (name === "simulated") return new SimulatedProvider();
  throw new ProviderError(`Unknown payment provider "${name}"`);
}

/** A specific provider by name (used for payments created earlier). */
export function providerNamed(name: string): PaymentProvider {
  if (name === "razorpay") return new RazorpayProvider();
  if (name === "simulated") return new SimulatedProvider();
  throw new ProviderError(`Unknown payment provider "${name}"`);
}
