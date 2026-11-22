import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Actor, AuthRequest, SessionGuard } from "../auth";
import { Database } from "../database";
import { customerOnly, permit } from "../domain";
import { currentPush } from "./push";

export type Priority = "p0" | "p1" | "p2";
export type NotifyInput = {
  userId: string;
  kind: string;
  priority: Priority;
  title: string;
  body: string;
  data?: Record<string, string>;
  dedupeKey?: string;
  campaign?: string;
  variant?: string;
  visible?: boolean;
};
export type NotifyResult = {
  status: "created" | "deduped" | "suppressed";
  reason?: string;
  id?: string;
};

const IST_MS = 5.5 * 3600000;
/** Wall-clock parts in India Standard Time. */
export function ist(date: Date) {
  const d = new Date(date.getTime() + IST_MS);
  return {
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    day: d.toISOString().slice(0, 10),
  };
}
const startOfIstDay = (date: Date) => {
  const d = new Date(date.getTime() + IST_MS);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - IST_MS);
};
const tag = (n: number) => `#PH${String(n).padStart(4, "0")}`;
const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};
export const promoDailyCap = () => num("PUSH_PROMO_DAILY_CAP", 2);
export const marketingDailyCap = () => num("PUSH_MARKETING_DAILY_CAP", 3);
export const holdoutPercent = () => num("PUSH_HOLDOUT_PERCENT", 10);

type Copy = { key: string; title: string; body: string };
/** Plain, honest copy: no invented discounts, deadlines or crowd numbers. */
export const COPY: Record<string, Copy[]> = {
  reorder: [
    {
      key: "friendly",
      title: "Craving your usual?",
      body: "Your {dish} is a few taps away.",
    },
    {
      key: "direct",
      title: "{dish}, again?",
      body: "Order it again in under a minute.",
    },
    {
      key: "warm",
      title: "Meal sorted?",
      body: "Pista House has your {dish} ready to go.",
    },
  ],
  abandoned_cart: [
    {
      key: "gentle",
      title: "You left something behind",
      body: "{count} in your cart, {total}. Finish your order in a tap.",
    },
    {
      key: "light",
      title: "Still hungry?",
      body: "Your cart is waiting for you.",
    },
  ],
  lapsed: [
    {
      key: "miss",
      title: "We miss you",
      body: "Your favourites are on the menu today.",
    },
    {
      key: "dish",
      title: "Biryani time?",
      body: "It has been a while. Come back for {dish}.",
    },
  ],
  rainy_day: [
    {
      key: "rain1",
      title: "Rain outside?",
      body: "Hot biryani, no umbrella needed.",
    },
    { key: "rain2", title: "Weather for {dish}", body: "Stay in. We deliver." },
  ],
};
const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/** Gamma(k, 1) sample (Marsaglia-Tsang), for Thompson sampling. */
function gamma(k: number, rng: () => number): number {
  if (k < 1) return gamma(k + 1, rng) * Math.pow(rng() || 1e-12, 1 / k);
  const d = k - 1 / 3,
    c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      const u1 = rng() || 1e-12,
        u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng() || 1e-12;
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
export const betaSample = (a: number, b: number, rng: () => number) => {
  const x = gamma(a, rng),
    y = gamma(b, rng);
  return x / (x + y);
};

@Injectable()
export class Notifications implements OnModuleInit, OnModuleDestroy {
  private log = new Logger("Notifications");
  private timers: NodeJS.Timeout[] = [];
  private polling = false;
  private rain?: { at: number; value: boolean };
  /** Replaceable in tests. */
  random: () => number = Math.random;
  constructor(@Inject(Database) private db: Database) {}

  onModuleInit() {
    if (process.env.NOTIFICATIONS_POLL_DISABLED !== "true") {
      const poll = setInterval(() => void this.tick(), 3000);
      poll.unref();
      this.timers.push(poll);
    }
    if (process.env.NOTIFICATIONS_CAMPAIGNS_DISABLED !== "true") {
      const c = setInterval(
        () =>
          void this.runCampaigns().catch((e) =>
            this.log.error(`Campaigns failed: ${(e as Error).message}`),
          ),
        5 * 60000,
      );
      c.unref();
      this.timers.push(c);
    }
  }
  onModuleDestroy() {
    for (const t of this.timers) clearInterval(t);
  }

  private async tick() {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.pollEvents();
      await this.flushScheduled();
    } catch (e) {
      this.log.error(`Notification poll failed: ${(e as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  // ---- creating and delivering --------------------------------------

  /** Reminders and offers need the customer's opt-in, a daily cap and quiet hours. */
  private async gate(userId: string, priority: Priority, now: Date) {
    const prefs = await this.db.notificationPreference.findUnique({
      where: { userId },
    });
    if (priority === "p1" && !prefs?.reminders)
      return { suppress: "not_opted_in" as const };
    if (priority === "p2" && !prefs?.promotions)
      return { suppress: "not_opted_in" as const };
    const dayStart = startOfIstDay(now);
    const today = await this.db.notification.findMany({
      where: {
        userId,
        visible: true,
        priority: { in: ["p1", "p2"] },
        createdAt: { gte: dayStart },
      },
      select: { priority: true },
    });
    if (today.length >= marketingDailyCap())
      return { suppress: "fatigue" as const };
    if (
      priority === "p2" &&
      today.filter((n) => n.priority === "p2").length >= promoDailyCap()
    )
      return { suppress: "fatigue" as const };
    const qs = prefs?.quietStart ?? 22,
      qe = prefs?.quietEnd ?? 8,
      h = ist(now).hour;
    const quiet = qs > qe ? h >= qs || h < qe : h >= qs && h < qe;
    if (!quiet)
      return { suppress: null, sendAt: undefined as Date | undefined };
    // Hold it until quiet hours end rather than waking someone up.
    const base = startOfIstDay(now);
    let at = new Date(base.getTime() + qe * 3600000);
    if (at <= now) at = new Date(at.getTime() + 86400000);
    return { suppress: null, sendAt: at };
  }

  async notify(input: NotifyInput, now = new Date()): Promise<NotifyResult> {
    let sendAt: Date | undefined;
    if (input.priority !== "p0") {
      const g = await this.gate(input.userId, input.priority, now);
      if (g.suppress) return { status: "suppressed", reason: g.suppress };
      sendAt = g.sendAt;
    }
    let row;
    try {
      row = await this.db.notification.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          priority: input.priority,
          title: input.title,
          body: input.body,
          data: input.data ?? undefined,
          visible: input.visible ?? true,
          campaign: input.campaign,
          variant: input.variant,
          sendAt,
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        return { status: "deduped" };
      throw e;
    }
    if (!sendAt) await this.deliver(row.id);
    return { status: "created", id: row.id };
  }

  /** Sends one notification to the user's registered phones, if any. */
  async deliver(id: string) {
    const n = await this.db.notification.findUnique({ where: { id } });
    if (!n || !n.visible || n.pushStatus) return;
    const tokens = await this.db.deviceToken.findMany({
      where: { userId: n.userId, disabledAt: null },
      select: { token: true },
    });
    const provider = currentPush();
    let status = "no_device";
    if (tokens.length) {
      if (!provider.delivers) status = "not_configured";
      else {
        const results = await provider.send(
          tokens.map((t) => t.token),
          {
            title: n.title,
            body: n.body,
            priority: n.priority as Priority,
            data: {
              ...((n.data as Record<string, string>) ?? {}),
              notificationId: n.id,
            },
          },
        );
        const dead = results.filter((r) => r.invalidToken).map((r) => r.token);
        if (dead.length)
          await this.db.deviceToken.updateMany({
            where: { token: { in: dead } },
            data: { disabledAt: new Date() },
          });
        status = results.some((r) => r.ok) ? "sent" : "failed";
      }
    }
    await this.db.notification.update({
      where: { id },
      data: {
        pushStatus: status,
        pushedAt: status === "sent" ? new Date() : null,
      },
    });
  }

  /** Delivers notifications that were held back (quiet hours). */
  async flushScheduled(now = new Date()) {
    const due = await this.db.notification.findMany({
      where: { sendAt: { lte: now }, pushStatus: null, visible: true },
      select: { id: true },
      take: 100,
    });
    for (const d of due) await this.deliver(d.id);
    return due.length;
  }

  // ---- order, delivery, refund and support events -------------------

  private async cursor(id: string, now: Date) {
    const c = await this.db.notificationCursor.findUnique({ where: { id } });
    if (c) return c.at;
    // The first time, start from now: never replay history as alerts.
    await this.db.notificationCursor.create({ data: { id, at: now } });
    return now;
  }
  private async advance(id: string, at: Date) {
    await this.db.notificationCursor.update({ where: { id }, data: { at } });
  }

  private async staffIds(outletId: string, roles: string[]) {
    const rows = await this.db.user.findMany({
      where: { outletId, role: { in: roles }, disabledAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  private async toMany(ids: string[], make: (id: string) => NotifyInput) {
    for (const id of ids) await this.notify(make(id));
  }

  /** Turns new order, delivery, offer and refund rows into notifications. */
  async pollEvents(now = new Date()) {
    let made = 0;
    const count = async (p: Promise<NotifyResult>) => {
      if ((await p).status === "created") made++;
    };

    // Orders
    let cur = await this.cursor("order_events", now);
    const events = await this.db.orderEvent.findMany({
      where: { createdAt: { gt: cur } },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: {
        order: {
          select: {
            id: true,
            number: true,
            customerId: true,
            outletId: true,
            fulfilment: true,
            totalPaise: true,
          },
        },
      },
    });
    for (const ev of events) {
      const o = ev.order,
        t = tag(o.number),
        data = { route: "order", orderId: o.id };
      const customer = (kind: string, title: string, body: string) =>
        count(
          this.notify({
            userId: o.customerId,
            kind,
            priority: "p0",
            title,
            body,
            data,
            dedupeKey: `oe:${ev.id}`,
          }),
        );
      if (ev.action.endsWith(".payment_verified")) {
        await customer(
          "order.confirmed",
          `Order ${t} confirmed`,
          `We have your payment of ${rupees(o.totalPaise)}. The outlet is on it.`,
        );
        await this.markConverted(o.customerId);
        for (const sid of await this.staffIds(o.outletId, [
          "owner",
          "counter",
          "kitchen",
        ]))
          await count(
            this.notify({
              userId: sid,
              kind: "staff.new_order",
              priority: "p0",
              title: `New order ${t}`,
              body: `${rupees(o.totalPaise)} · ${o.fulfilment === "delivery" ? "delivery" : "pickup"}`,
              data: { route: "orders", orderId: o.id },
              dedupeKey: `oe:${ev.id}:${sid}`,
            }),
          );
      } else if (ev.action === "accept")
        await customer(
          "order.accepted",
          `Order ${t} accepted`,
          "The kitchen has your order.",
        );
      else if (ev.action === "prepare")
        await customer(
          "order.preparing",
          "Being prepared",
          `Your order ${t} is being cooked now.`,
        );
      else if (ev.action === "ready")
        await customer(
          "order.ready",
          o.fulfilment === "delivery" ? "Packed and ready" : "Ready for pickup",
          o.fulfilment === "delivery"
            ? "We are finding a delivery partner."
            : `Your order ${t} is ready at the counter.`,
        );
      else if (ev.action === "reject")
        await customer(
          "order.declined",
          `Order ${t} declined`,
          `${ev.reason ? ev.reason + ". " : ""}If you paid, the outlet will refund you.`,
        );
      cur = ev.createdAt;
    }
    if (events.length) await this.advance("order_events", cur);

    // Deliveries
    let ac = await this.cursor("assignment_events", now);
    const aes = await this.db.assignmentEvent.findMany({
      where: { createdAt: { gt: ac } },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: {
        assignment: {
          select: {
            riderId: true,
            rider: { select: { name: true } },
            order: {
              select: {
                id: true,
                number: true,
                customerId: true,
                outletId: true,
              },
            },
          },
        },
      },
    });
    for (const ev of aes) {
      const a = ev.assignment,
        o = a.order,
        t = tag(o.number),
        data = { route: "track", orderId: o.id };
      const customer = (kind: string, title: string, body: string) =>
        count(
          this.notify({
            userId: o.customerId,
            kind,
            priority: "p0",
            title,
            body,
            data,
            dedupeKey: `ae:${ev.id}`,
          }),
        );
      if (ev.action === "assigned") {
        await customer(
          "delivery.assigned",
          "Delivery partner assigned",
          `${a.rider.name} will deliver your order ${t}.`,
        );
        await count(
          this.notify({
            userId: a.riderId,
            kind: "rider.assigned",
            priority: "p0",
            title: "Delivery assigned",
            body: `Order ${t} is yours. Open the app to collect it.`,
            data: { route: "tasks" },
            dedupeKey: `ae:${ev.id}:rider`,
          }),
        );
      } else if (ev.action === "picked_up")
        await customer(
          "delivery.on_the_way",
          "On the way",
          "Track your delivery partner live in the app.",
        );
      else if (ev.action === "delivered")
        await customer(
          "delivery.delivered",
          "Delivered",
          `Your order ${t} has arrived. Enjoy your meal!`,
        );
      else if (ev.action === "failed") {
        await customer(
          "delivery.failed",
          "We could not deliver",
          `The outlet will contact you about order ${t}.`,
        );
        for (const sid of await this.staffIds(o.outletId, ["owner", "counter"]))
          await count(
            this.notify({
              userId: sid,
              kind: "staff.delivery_failed",
              priority: "p0",
              title: `Delivery failed ${t}`,
              body: "The rider reported a failed delivery.",
              data: { route: "orders", orderId: o.id },
              dedupeKey: `ae:${ev.id}:${sid}`,
            }),
          );
      }
      ac = ev.createdAt;
    }
    if (aes.length) await this.advance("assignment_events", ac);

    // Delivery offers go to the rider as time-critical alerts.
    let oc = await this.cursor("offers", now);
    const offers = await this.db.deliveryOffer.findMany({
      where: { createdAt: { gt: oc } },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { order: { select: { number: true } } },
    });
    for (const f of offers) {
      await count(
        this.notify({
          userId: f.riderId,
          kind: "rider.offer",
          priority: "p0",
          title: "New delivery offer",
          body: `Order ${tag(f.order.number)}. Accept before it expires.`,
          data: { route: "offer", offerId: f.id },
          dedupeKey: `offer:${f.id}`,
        }),
      );
      oc = f.createdAt;
    }
    if (offers.length) await this.advance("offers", oc);

    // Refunds
    let rc = await this.cursor("refunds", now);
    const refunds = await this.db.refund.findMany({
      where: { createdAt: { gt: rc } },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    for (const r of refunds) {
      const o = await this.db.order.findUnique({
        where: { id: r.orderId },
        select: { customerId: true, number: true },
      });
      if (o)
        await count(
          this.notify({
            userId: o.customerId,
            kind: "refund.started",
            priority: "p0",
            title: `Refund of ${rupees(r.amountPaise)} started`,
            body: `For order ${tag(o.number)}. It can take 5 to 7 working days to reach your bank.`,
            data: { route: "order", orderId: r.orderId },
            dedupeKey: `refund:${r.id}`,
          }),
        );
      rc = r.createdAt;
    }
    if (refunds.length) await this.advance("refunds", rc);
    return made;
  }

  /** A customer acted after a nudge: remember that, to measure what nudges achieve. */
  async markConverted(userId: string) {
    await this.db.notification.updateMany({
      where: {
        userId,
        priority: { in: ["p1", "p2"] },
        createdAt: { gt: new Date(Date.now() - 24 * 3600000) },
        convertedAt: null,
      },
      data: { convertedAt: new Date() },
    });
  }

  // ---- support alerts (called by the support desk) ------------------

  async supportCustomerWrote(
    t: {
      id: string;
      number: number;
      subject: string;
      outletId: string;
      assignedToId: string | null;
    },
    isNew: boolean,
  ) {
    const ids = t.assignedToId
      ? [t.assignedToId]
      : await this.staffIds(t.outletId, ["owner", "counter"]);
    await this.toMany(ids, (userId) => ({
      userId,
      kind: isNew ? "support.new" : "support.reply",
      priority: "p0",
      title: isNew
        ? `New request #${t.number}`
        : `Customer replied on #${t.number}`,
      body: t.subject,
      data: { route: "support", ticketId: t.id },
    }));
  }
  async supportStaffReplied(t: {
    id: string;
    number: number;
    subject: string;
    customerId: string;
  }) {
    await this.notify({
      userId: t.customerId,
      kind: "support.reply",
      priority: "p0",
      title: "Pista House support replied",
      body: t.subject,
      data: { route: "support", ticketId: t.id },
    });
  }

  // ---- reminders and offers -----------------------------------------

  private inHolout(userId: string, campaign: string) {
    const h = createHash("sha256").update(`${userId}:${campaign}`).digest()[0];
    return (h / 256) * 100 < holdoutPercent();
  }

  /** Thompson sampling: favour copy that people open, but keep exploring. */
  async pickVariant(campaign: string): Promise<Copy> {
    const options = COPY[campaign];
    const since = new Date(Date.now() - 60 * 86400000);
    const rows = await this.db.notification.findMany({
      where: {
        campaign,
        visible: true,
        createdAt: { gte: since },
        variant: { not: null },
      },
      select: { variant: true, openedAt: true },
    });
    let best = options[0],
      bestScore = -1;
    for (const o of options) {
      const mine = rows.filter((r) => r.variant === o.key);
      const opened = mine.filter((r) => r.openedAt).length;
      const score = betaSample(
        opened + 1,
        mine.length - opened + 1,
        this.random,
      );
      if (score > bestScore) {
        best = o;
        bestScore = score;
      }
    }
    return best;
  }

  /** Sends a reminder or offer, or records a held-back control for measurement. */
  async sendCampaign(
    userId: string,
    campaign: string,
    priority: "p1" | "p2",
    vars: Record<string, string>,
    now = new Date(),
  ): Promise<NotifyResult> {
    const variant = await this.pickVariant(campaign);
    const base: NotifyInput = {
      userId,
      kind: `campaign.${campaign}`,
      priority,
      title: fill(variant.title, vars),
      body: fill(variant.body, vars),
      data: { route: "menu" },
      campaign,
      variant: variant.key,
    };
    if (this.inHolout(userId, campaign)) {
      // Deliberately not sent, so we can compare against people who were.
      const g = await this.gate(userId, priority, now);
      if (g.suppress) return { status: "suppressed", reason: g.suppress };
      await this.db.notification.create({
        data: {
          ...base,
          data: base.data,
          visible: false,
          pushStatus: "holdout",
        },
      });
      return { status: "suppressed", reason: "holdout" };
    }
    return this.notify(base, now);
  }

  private async rainingAtOutlet(outletId: string): Promise<boolean> {
    if (this.rain && Date.now() - this.rain.at < 20 * 60000)
      return this.rain.value;
    let value = false;
    try {
      const o = await this.db.outlet.findUnique({
        where: { id: outletId },
        select: { latitude: true, longitude: true },
      });
      if (o?.latitude != null && o.longitude != null) {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${o.latitude}&longitude=${o.longitude}&current=precipitation`,
          { signal: AbortSignal.timeout(5000) },
        );
        const d = (await r.json()) as any;
        value = r.ok && Number(d?.current?.precipitation) >= 0.2;
      }
    } catch {
      value = false;
    }
    this.rain = { at: Date.now(), value };
    return value;
  }

  /** Whether `now` is just before this person's usual meal time (default lunch/dinner). */
  private inMealWindow(now: Date, hours: number[]) {
    const p = ist(now),
      m = p.hour * 60 + p.minute;
    const targets = hours.length
      ? [Math.round(modeOf(hours)) * 60]
      : [12 * 60 + 30, 19 * 60 + 30];
    return targets.some((t) => m >= t - 20 && m <= t + 10);
  }

  /** Looks at opted-in customers and sends the reminders and offers that fit. */
  async runCampaigns(now = new Date()) {
    const sent: Record<string, number> = {};
    const bump = (c: string, r: NotifyResult) => {
      if (r.status === "created") sent[c] = (sent[c] ?? 0) + 1;
    };
    const prefs = await this.db.notificationPreference.findMany({
      where: { OR: [{ promotions: true }, { reminders: true }] },
    });
    const day0 = startOfIstDay(now);
    for (const pref of prefs) {
      const user = await this.db.user.findFirst({
        where: { id: pref.userId, role: "customer", disabledAt: null },
        select: { id: true, name: true, outletId: true },
      });
      if (!user) continue;
      const since = new Date(now.getTime() - 56 * 86400000);
      const orders = await this.db.order.findMany({
        where: {
          customerId: user.id,
          paymentStatus: { in: ["paid", "refunded"] },
          createdAt: { gte: new Date(now.getTime() - 90 * 86400000) },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      });
      const recent = orders.filter((o) => o.createdAt >= since);
      const orderedToday = orders.some((o) => o.createdAt >= day0);
      const wd = ist(now).weekday;
      const sameDay = recent.filter((o) => ist(o.createdAt).weekday === wd);
      const hours = (
        sameDay.length >= 2 ? sameDay : recent.length >= 3 ? recent : []
      ).map((o) => ist(o.createdAt).hour);
      const items = orders.length
        ? await this.db.orderItem.findMany({
            where: { orderId: { in: orders.map((o) => o.id) } },
            select: { name: true, quantity: true },
          })
        : [];
      const tally = new Map<string, number>();
      for (const i of items)
        tally.set(i.name, (tally.get(i.name) ?? 0) + i.quantity);
      const dish =
        [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "biryani";
      const first = user.name.split(" ")[0];
      const vars = { name: first, dish };
      const lastCampaign = async (c: string, days: number) =>
        this.db.notification.count({
          where: {
            userId: user.id,
            campaign: c,
            createdAt: { gte: new Date(now.getTime() - days * 86400000) },
          },
        });

      if (pref.reminders) {
        if (
          recent.length >= 3 &&
          sameDay.length >= 2 &&
          !orderedToday &&
          this.inMealWindow(now, hours) &&
          !(await lastCampaign("reorder", 6))
        )
          bump(
            "reorder",
            await this.sendCampaign(user.id, "reorder", "p1", vars, now),
          );
        const cart = await this.db.cartSnapshot.findUnique({
          where: { userId: user.id },
        });
        if (cart && cart.itemCount > 0) {
          const age = now.getTime() - cart.updatedAt.getTime();
          const ordered = orders.some((o) => o.createdAt > cart.updatedAt);
          const nudged = await this.db.notification.count({
            where: {
              userId: user.id,
              campaign: "abandoned_cart",
              createdAt: { gt: cart.updatedAt },
            },
          });
          if (age >= 30 * 60000 && age <= 180 * 60000 && !ordered && !nudged)
            bump(
              "abandoned_cart",
              await this.sendCampaign(
                user.id,
                "abandoned_cart",
                "p1",
                {
                  ...vars,
                  count: `${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`,
                  total: rupees(cart.totalPaise),
                },
                now,
              ),
            );
        }
      }
      if (pref.promotions && !orderedToday && this.inMealWindow(now, hours)) {
        const last = orders[0]?.createdAt;
        const quiet = last ? (now.getTime() - last.getTime()) / 86400000 : 0;
        if (
          last &&
          quiet >= 14 &&
          quiet <= 90 &&
          !(await lastCampaign("lapsed", 14))
        )
          bump(
            "lapsed",
            await this.sendCampaign(user.id, "lapsed", "p2", vars, now),
          );
        else if (
          !(await lastCampaign("rainy_day", 3)) &&
          (await this.rainingAtOutlet(user.outletId))
        )
          bump(
            "rainy_day",
            await this.sendCampaign(user.id, "rainy_day", "p2", vars, now),
          );
      }
    }
    return sent;
  }

  /** How each reminder or offer performed, against people deliberately not sent it. */
  async report(actor: Actor) {
    permit(actor.role, "reports:read");
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await this.db.notification.findMany({
      where: { campaign: { not: null }, createdAt: { gte: since } },
      select: {
        campaign: true,
        variant: true,
        visible: true,
        openedAt: true,
        convertedAt: true,
      },
    });
    const out: Record<string, any> = {};
    for (const r of rows) {
      const c = (out[r.campaign!] ??= {
        sent: 0,
        opened: 0,
        converted: 0,
        heldBack: 0,
        heldBackConverted: 0,
        variants: {},
      });
      if (r.visible) {
        c.sent++;
        if (r.openedAt) c.opened++;
        if (r.convertedAt) c.converted++;
        const v = (c.variants[r.variant ?? "?"] ??= { sent: 0, opened: 0 });
        v.sent++;
        if (r.openedAt) v.opened++;
      } else {
        c.heldBack++;
        if (r.convertedAt) c.heldBackConverted++;
      }
    }
    for (const c of Object.values(out)) {
      const t = c.sent ? c.converted / c.sent : null,
        h = c.heldBack ? c.heldBackConverted / c.heldBack : null;
      c.orderRate = t === null ? null : Math.round(t * 1000) / 10;
      c.heldBackOrderRate = h === null ? null : Math.round(h * 1000) / 10;
      c.liftPoints =
        t !== null && h !== null ? Math.round((t - h) * 1000) / 10 : null;
      c.enoughData = c.sent >= 100 && c.heldBack >= 30;
    }
    return { days: 30, holdoutPercent: holdoutPercent(), campaigns: out };
  }

  // ---- the user's own inbox -----------------------------------------

  async list(actor: Actor, limit = 50) {
    const now = new Date();
    const where = {
      userId: actor.id,
      visible: true,
      OR: [{ sendAt: null }, { sendAt: { lte: now } }],
    };
    const [rows, unread] = await Promise.all([
      this.db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
      }),
      this.db.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return {
      unread,
      items: rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        priority: n.priority,
        title: n.title,
        body: n.body,
        data: n.data ?? {},
        createdAt: n.createdAt.toISOString(),
        read: !!n.readAt,
      })),
    };
  }
  async unread(actor: Actor) {
    const count = await this.db.notification.count({
      where: {
        userId: actor.id,
        visible: true,
        readAt: null,
        OR: [{ sendAt: null }, { sendAt: { lte: new Date() } }],
      },
    });
    return { count };
  }
  async markRead(actor: Actor, raw: unknown) {
    const b = z
      .object({ ids: z.array(z.string().max(100)).max(200).optional() })
      .strict()
      .safeParse(raw ?? {});
    if (!b.success)
      throw new BadRequestException(
        b.error.issues.map((i) => i.message).join("; "),
      );
    const r = await this.db.notification.updateMany({
      where: {
        userId: actor.id,
        readAt: null,
        ...(b.data.ids ? { id: { in: b.data.ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return { updated: r.count };
  }
  async opened(actor: Actor, id: string) {
    const r = await this.db.notification.updateMany({
      where: { id, userId: actor.id },
      data: { openedAt: new Date(), readAt: new Date() },
    });
    if (!r.count) throw new NotFoundException("Notification not found");
    return { ok: true };
  }
  async getPrefs(actor: Actor) {
    const p = await this.db.notificationPreference.findUnique({
      where: { userId: actor.id },
    });
    return {
      promotions: p?.promotions ?? false,
      reminders: p?.reminders ?? false,
      quietStart: p?.quietStart ?? 22,
      quietEnd: p?.quietEnd ?? 8,
    };
  }
  async setPrefs(actor: Actor, raw: unknown) {
    customerOnly(actor.role);
    const body = z
      .object({
        promotions: z.boolean().optional(),
        reminders: z.boolean().optional(),
        quietStart: z.number().int().min(0).max(23).optional(),
        quietEnd: z.number().int().min(0).max(23).optional(),
      })
      .strict()
      .safeParse(raw);
    if (!body.success)
      throw new BadRequestException(
        body.error.issues.map((i) => i.message).join("; "),
      );
    await this.db.notificationPreference.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, ...body.data },
      update: body.data,
    });
    return this.getPrefs(actor);
  }
  async registerDevice(actor: Actor, raw: unknown) {
    const b = z
      .object({
        token: z.string().min(20).max(4096),
        platform: z.enum(["ios", "android"]),
        app: z.enum(["customer", "owner", "rider", "dashboard"]),
      })
      .strict()
      .safeParse(raw);
    if (!b.success)
      throw new BadRequestException(
        b.error.issues.map((i) => i.message).join("; "),
      );
    await this.db.deviceToken.upsert({
      where: { token: b.data.token },
      create: { userId: actor.id, ...b.data },
      update: {
        userId: actor.id,
        platform: b.data.platform,
        app: b.data.app,
        disabledAt: null,
        lastSeenAt: new Date(),
      },
    });
    return { ok: true };
  }
  async removeDevice(actor: Actor, raw: unknown) {
    const b = z
      .object({ token: z.string().min(20).max(4096) })
      .strict()
      .safeParse(raw);
    if (!b.success)
      throw new BadRequestException(
        b.error.issues.map((i) => i.message).join("; "),
      );
    await this.db.deviceToken.deleteMany({
      where: { token: b.data.token, userId: actor.id },
    });
    return { ok: true };
  }
  async setCart(actor: Actor, raw: unknown) {
    customerOnly(actor.role);
    const b = z
      .object({
        itemCount: z.number().int().min(0).max(100),
        totalPaise: z.number().int().min(0).max(100000000),
      })
      .strict()
      .safeParse(raw);
    if (!b.success)
      throw new BadRequestException(
        b.error.issues.map((i) => i.message).join("; "),
      );
    if (b.data.itemCount === 0)
      await this.db.cartSnapshot.deleteMany({ where: { userId: actor.id } });
    else
      await this.db.cartSnapshot.upsert({
        where: { userId: actor.id },
        create: { userId: actor.id, ...b.data },
        update: { ...b.data, updatedAt: new Date() },
      });
    return { ok: true };
  }
  /** Sends the signed-in owner a test alert, to check push is set up. */
  async test(actor: Actor) {
    permit(actor.role, "outlet:pause");
    const r = await this.notify({
      userId: actor.id,
      kind: "test",
      priority: "p0",
      title: "Test notification",
      body: "If you can read this on your phone, push is working.",
      data: { route: "none" },
    });
    const n = r.id
      ? await this.db.notification.findUnique({ where: { id: r.id } })
      : null;
    return { pushStatus: n?.pushStatus ?? null, provider: currentPush().name };
  }
}

function modeOf(xs: number[]) {
  const c = new Map<number, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

@Controller("api")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(@Inject(Notifications) private n: Notifications) {}
  @Get("notifications") list(
    @Req() req: AuthRequest,
    @Query("limit") limit?: string,
  ) {
    return this.n.list(req.actor, Number(limit) || 50);
  }
  @Get("notifications/unread-count") unread(@Req() req: AuthRequest) {
    return this.n.unread(req.actor);
  }
  @Get("notifications/preferences") prefs(@Req() req: AuthRequest) {
    return this.n.getPrefs(req.actor);
  }
  @Put("notifications/preferences") setPrefs(
    @Req() req: AuthRequest,
    @Body() b: unknown,
  ) {
    return this.n.setPrefs(req.actor, b);
  }
  @Get("notifications/report") report(@Req() req: AuthRequest) {
    return this.n.report(req.actor);
  }
  @Post("notifications/test") test(@Req() req: AuthRequest) {
    return this.n.test(req.actor);
  }
  @Post("notifications/read") read(
    @Req() req: AuthRequest,
    @Body() b: unknown,
  ) {
    return this.n.markRead(req.actor, b);
  }
  @Post("notifications/:id/open") open(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.n.opened(req.actor, id);
  }
  @Post("devices") register(@Req() req: AuthRequest, @Body() b: unknown) {
    return this.n.registerDevice(req.actor, b);
  }
  @Delete("devices") remove(@Req() req: AuthRequest, @Body() b: unknown) {
    return this.n.removeDevice(req.actor, b);
  }
  @Put("me/cart") cart(@Req() req: AuthRequest, @Body() b: unknown) {
    return this.n.setCart(req.actor, b);
  }
}
