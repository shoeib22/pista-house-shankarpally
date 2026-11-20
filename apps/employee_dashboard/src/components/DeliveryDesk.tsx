import { useState } from "react";
import { Bike, MapPin, UserRound, CircleAlert } from "lucide-react";
import { Api, Order, Rider } from "@pista/web-api";
import "./DeliveryDesk.css";
export function DeliveryDesk({
  orders,
  riders,
  busy,
  connected,
  run,
  api,
}: {
  orders: Order[];
  riders: Rider[];
  busy: boolean;
  connected: boolean;
  run: (task: () => Promise<unknown>) => Promise<void>;
  api: Api;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const deliveries = orders.filter(
    (o) => o.fulfilment === "delivery" && o.paymentStatus === "paid",
  );
  const active = deliveries.filter(
    (o) => !["delivered", "rejected"].includes(o.status),
  );
  return (
    <section className="dispatch-desk">
      <div className="dispatch-heading">
        <div>
          <h2>Dispatch & handoff</h2>
          <p className="muted">
            Assign an available rider once the kitchen marks an order ready.
          </p>
        </div>
        <span className="dispatch-count">
          <Bike size={17} />
          {riders.filter((r) => r.riderAvailable).length} available riders
        </span>
      </div>
      <div className="rider-strip">
        {riders.map((r) => (
          <span
            key={r.id}
            className={r.riderAvailable ? "rider-online" : "rider-offline"}
          >
            <UserRound size={15} />
            {r.name}
            <small>{r.riderAvailable ? "Online" : "Offline"}</small>
          </span>
        ))}
        {!riders.length && (
          <p className="muted">No outlet riders are configured.</p>
        )}
      </div>
      {!active.length && (
        <div className="empty-page">
          <Bike size={38} />
          <h2>No active deliveries</h2>
          <p>
            Paid delivery orders will appear here. The current sample delivery
            zone is 000000; it is not a real service area.
          </p>
        </div>
      )}
      <div className="dispatch-grid">
        {active.map((o) => {
          const a = o.assignments.find((a) => a.isActive);
          const address = o.deliveryAddress as
            | { line1?: string; city?: string; postalCode?: string }
            | null
            | undefined;
          return (
            <article className="dispatch-card" key={o.id}>
              <div className="order-top">
                <b>#PH{String(o.number).padStart(4, "0")}</b>
                <span
                  className={`tag ${o.status === "delivery_failed" ? "exception" : "paid"}`}
                >
                  {o.status.replaceAll("_", " ")}
                </span>
              </div>
              <ul className="items">
                {o.items.map((i, n) => (
                  <li key={n}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>
              {address && (
                <p className="dispatch-address">
                  <MapPin size={15} />
                  <span>
                    {address.line1}
                    <br />
                    {address.city} · {address.postalCode}
                  </span>
                </p>
              )}
              {a && (
                <p className="assigned-rider">
                  <Bike size={16} />
                  {a.rider.name} · {a.status.replaceAll("_", " ")}
                </p>
              )}
              {a?.status === "failed" && (
                <div className="delivery-exception">
                  <CircleAlert size={16} />
                  <p>
                    {a.failureReason}
                    <br />
                    <small>
                      Payment remains paid. Confirm return only after receiving
                      the order at the outlet.
                    </small>
                  </p>
                </div>
              )}
              {o.status === "ready" && !a && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!selected[o.id]) return;
                    void run(() =>
                      api.request(`/orders/${o.id}/assignment`, "POST", {
                        riderId: selected[o.id],
                        version: o.version,
                      }),
                    );
                  }}
                >
                  <label className="field-label" htmlFor={`rider-${o.id}`}>
                    Assign rider
                  </label>
                  <select
                    id={`rider-${o.id}`}
                    value={selected[o.id] || ""}
                    disabled={busy || !connected}
                    onChange={(e) =>
                      setSelected({ ...selected, [o.id]: e.target.value })
                    }
                    required
                  >
                    <option value="">Choose available rider</option>
                    {riders
                      .filter((r) => r.riderAvailable)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="primary full"
                    disabled={busy || !connected || !selected[o.id]}
                  >
                    Assign delivery
                  </button>
                </form>
              )}
              {a?.status === "assigned" && (
                <button
                  className="outline full"
                  disabled={busy || !connected}
                  onClick={() =>
                    void run(() =>
                      api.request(
                        `/assignments/${a.id}/staff-actions`,
                        "POST",
                        { action: "unassign", version: a.version },
                      ),
                    )
                  }
                >
                  Unassign rider
                </button>
              )}
              {a?.status === "failed" && (
                <button
                  className="outline full"
                  disabled={busy || !connected}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Confirm this order has physically returned to the outlet?",
                      )
                    )
                      void run(() =>
                        api.request(
                          `/assignments/${a.id}/staff-actions`,
                          "POST",
                          { action: "confirm_return", version: a.version },
                        ),
                      );
                  }}
                >
                  Confirm return to outlet
                </button>
              )}
              {o.status !== "ready" && !a && (
                <p className="muted">Waiting for kitchen preparation.</p>
              )}
            </article>
          );
        })}
      </div>
      {deliveries.some((o) => o.status === "delivered") && (
        <p className="completed-note">
          {deliveries.filter((o) => o.status === "delivered").length} delivered
          order(s). Completion is verified by the customer's delivery code.
        </p>
      )}
    </section>
  );
}
