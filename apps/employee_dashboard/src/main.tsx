import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ClipboardList,
  ChefHat,
  Bike,
  UtensilsCrossed,
  History,
  Search,
  LogOut,
  RefreshCw,
  CircleCheck,
  Clock3,
  ShoppingBag,
  Pause,
  Play,
  ArrowRight,
  AlertCircle,
  Users,
  UserRound,
} from "lucide-react";
import { Api, ApiError, Order, Product, Status, Rider } from "@pista/web-api";
import { DeliveryDesk } from "./components/DeliveryDesk";
import "./style.css";
import { AccountAccess, SignedIn } from "./components/AccountAccess";
import { TeamAccess } from "./components/TeamAccess";
import { AccountSettings } from "./components/AccountSettings";
const api = new Api(sessionStorage.getItem("pista-session") || "");
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v / 100);
const names: Record<Status, string> = {
  awaiting_acceptance: "New orders",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  collected: "Collected",
  delivered: "Delivered",
  rejected: "Declined",
  delivery_failed: "Delivery exception",
};
type User = { name: string; role: string };
type Audit = {
  id: string;
  action: string;
  resourceId: string;
  detail: string | null;
  createdAt: string;
};
function App() {
  const [user, setUser] = useState<User | null>(null),
    [health, setHealth] = useState<{ development: boolean } | null>(null),
    [error, setError] = useState(""),
    [orders, setOrders] = useState<Order[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [audit, setAudit] = useState<Audit[]>([]),
    [paused, setPaused] = useState(false),
    [view, setView] = useState("Orders"),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [updated, setUpdated] = useState<Date | null>(null),
    [detail, setDetail] = useState<Order | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const clearSession = useCallback(() => {
    api.token = "";
    sessionStorage.removeItem("pista-session");
    setUser(null);
    setOrders([]);
    setProducts([]);
    setAudit([]);
    setRiders([]);
    setView("Orders");
  }, []);
  const requestRunning = useRef(false);
  const sync = useCallback(async () => {
    if (!api.token || requestRunning.current) return;
    requestRunning.current = true;
    const sessionToken = api.token;
    try {
      const [o, m, s] = await Promise.all([
        api.request<Order[]>("/orders"),
        api.request<Product[]>("/menu"),
        api.request<{ paused: boolean }>("/outlet"),
      ]);
      if (api.token !== sessionToken) return;
      setOrders(o);
      setProducts(m);
      setPaused(s.paused);
      setConnected(true);
      setUpdated(new Date());
      if (user && ["counter", "owner"].includes(user.role)) {
        const [a, r] = await Promise.all([
          api.request<Audit[]>("/audit"),
          api.request<Rider[]>("/riders"),
        ]);
        if (api.token !== sessionToken) return;
        setAudit(a);
        setRiders(r);
      }
    } catch (e) {
      setConnected(false);
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 401) clearSession();
    } finally {
      requestRunning.current = false;
    }
  }, [user, clearSession]);
  useEffect(() => {
    api
      .request<{ development: boolean }>("/health")
      .then(setHealth)
      .catch(() =>
        setError("API is unavailable. Start the backend to connect."),
      );
    const restoring = api.token;
    if (restoring)
      api
        .request<User>("/me")
        .then((data) => {
          if (api.token === restoring) setUser(data);
        })
        .catch(() => {
          if (api.token === restoring) clearSession();
        });
  }, [clearSession]);
  useEffect(() => {
    if (!user) return;
    void sync();
    const id = setInterval(() => void sync(), 4000);
    return () => clearInterval(id);
  }, [user, sync]);
  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await sync();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 401) clearSession();
    } finally {
      setBusy(false);
    }
  }
  function signedIn(data: SignedIn) {
    api.token = data.token;
    sessionStorage.setItem("pista-session", data.token);
    setUser(data.user);
    setError("");
  }
  async function logout() {
    setBusy(true);
    try {
      await api.request("/session", "DELETE");
    } catch {
      setError(
        "Signed out on this device. Server revocation could not be confirmed.",
      );
    } finally {
      clearSession();
      setBusy(false);
    }
  }
  async function action(order: Order, action: string) {
    let reason: string | undefined;
    if (action === "reject") {
      reason = window
        .prompt(
          "Why can this order not be fulfilled? A paid order will need refund review.",
        )
        ?.trim();
      if (!reason) return;
    }
    await run(() =>
      api.request(`/orders/${order.id}/actions`, "POST", {
        action,
        version: order.version,
        ...(reason ? { reason } : {}),
      }),
    );
  }
  const nav = [
    { name: "Orders", icon: ClipboardList },
    { name: "Kitchen", icon: ChefHat },
    ...(user?.role === "kitchen" ? [] : [{ name: "Delivery", icon: Bike }]),
    ...(user?.role === "kitchen"
      ? []
      : [
          { name: "Menu", icon: UtensilsCrossed },
          { name: "Shift log", icon: History },
        ]),
  ];
  nav.push({ name: "Account", icon: UserRound });
  if (user?.role === "owner") nav.push({ name: "Team", icon: Users });
  const filtered = orders.filter(
    (o) =>
      (filter === "all" || o.fulfilment === filter) &&
      `PH${String(o.number).padStart(4, "0")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const stages: Status[] =
    view === "Kitchen"
      ? ["accepted", "preparing", "ready"]
      : ["awaiting_acceptance", "accepted", "preparing", "ready"];
  const counts = (status: Status) =>
    orders.filter((o) => o.status === status && o.paymentStatus === "paid")
      .length;
  const paid = orders.filter((o) => o.paymentStatus === "paid");
  const renderCard = (o: Order) => (
    <article className="order" key={o.id}>
      <div className="order-top">
        <button className="order-id" onClick={() => setDetail(o)}>
          #PH{String(o.number).padStart(4, "0")}
        </button>
        <span className="time">
          <Clock3 size={12} />
          {new Date(o.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          })}
        </span>
      </div>
      <div className="order-type">
        <ShoppingBag size={13} />
        {o.fulfilment === "pickup" ? "Takeaway pickup" : "Delivery"}
        <span className={`tag ${o.paymentStatus === "paid" ? "paid" : ""}`}>
          {o.paymentStatus === "paid" ? "Paid · test" : o.paymentStatus}
        </span>
      </div>
      <ul className="items">
        {o.items.map((i, index) => (
          <li key={index}>
            <span>{i.quantity} ×</span> {i.name}
          </li>
        ))}
      </ul>
      <div className="total">
        <span>Order total</span>
        <b>{money(o.totalPaise)}</b>
      </div>
      {o.status === "awaiting_acceptance" &&
        o.paymentStatus === "paid" &&
        user?.role !== "kitchen" && (
          <>
            <button
              disabled={busy || !connected}
              className="primary full"
              onClick={() => void action(o, "accept")}
            >
              Accept order <ArrowRight size={15} />
            </button>
            <button
              disabled={busy || !connected}
              className="decline full"
              onClick={() => void action(o, "reject")}
            >
              Decline with reason
            </button>
          </>
        )}
      {o.status === "accepted" && (
        <button
          disabled={busy || !connected}
          className="outline full"
          onClick={() => void action(o, "prepare")}
        >
          Start preparing <ArrowRight size={15} />
        </button>
      )}
      {o.status === "preparing" && (
        <button
          disabled={busy || !connected}
          className="outline full"
          onClick={() => void action(o, "ready")}
        >
          <CircleCheck size={15} /> Mark ready
        </button>
      )}
      {o.status === "ready" &&
        user?.role !== "kitchen" &&
        o.fulfilment === "pickup" && (
          <button
            disabled={busy || !connected}
            className="outline full"
            onClick={() => void action(o, "collect")}
          >
            Confirm collection
          </button>
        )}
      {o.status === "rejected" && o.paymentStatus === "paid" && (
        <p className="refund-warning">Paid order · refund review required</p>
      )}
      {o.status === "ready" &&
        o.fulfilment === "delivery" &&
        user?.role !== "kitchen" && (
          <button className="outline full" onClick={() => setView("Delivery")}>
            Open dispatch <Bike size={15} />
          </button>
        )}
    </article>
  );
  if (!user)
    return (
      <AccountAccess
        api={api}
        development={health?.development ?? false}
        onSignedIn={signedIn}
        error={error}
        logo={<Logo />}
      />
    );
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <Logo />
          <p>Shankarpally</p>
          <span>OUTLET OPERATIONS</span>
        </div>
        <nav aria-label="Primary navigation">
          {nav.map((n) => (
            <button
              key={n.name}
              className={view === n.name ? "active" : ""}
              onClick={() => {
                setView(n.name);
                setSearch("");
              }}
            >
              <n.icon size={20} />
              {n.name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div>
            <b>{user.role === "counter" ? "Counter team" : user.name}</b>
            <small>{user.role} access</small>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void logout()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main
        className={["Team", "Account"].includes(view) ? "settings-view" : ""}
      >
        <div className="environment">
          DEVELOPMENT{" "}
          <span>
            Sample catalogue · test payments · no live restaurant activity
          </span>
        </div>
        <header>
          <div>
            <p className="eyebrow">PISTA HOUSE / SHANKARPALLY</p>
            <h1>
              {view === "Orders"
                ? "Order desk"
                : view === "Kitchen"
                  ? "Kitchen queue"
                  : view === "Delivery"
                    ? "Delivery desk"
                    : view === "Menu"
                      ? "Menu availability"
                      : view === "Team"
                        ? "Team access"
                        : view === "Account"
                          ? "Your account"
                          : "Shift activity"}
            </h1>
            <p className="muted">
              {view === "Orders"
                ? "Every order. A clear next step."
                : view === "Kitchen"
                  ? "From the counter to the pass."
                  : view === "Menu"
                    ? "Keep the counter and customer menu in sync."
                    : view === "Delivery"
                      ? "Restaurant-managed deliveries."
                      : view === "Team"
                        ? "Invite teammates and manage their outlet access."
                        : view === "Account"
                          ? "Manage your passphrase and signed-in sessions."
                          : "A record of actions at your outlet."}
            </p>
          </div>
          <div className="header-actions">
            <span className={`store ${paused ? "paused" : ""}`}>
              <i />
              {paused ? "Orders paused" : "Store open"}
            </span>
            {user.role === "owner" && (
              <button
                className="outline"
                disabled={busy || !connected}
                onClick={() =>
                  void run(() =>
                    api.request("/outlet", "PATCH", { paused: !paused }),
                  )
                }
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                {paused ? "Resume orders" : "Pause orders"}
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="error banner" role="alert">
            <AlertCircle size={17} />
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        <section className="metrics" aria-label="Order summary">
          {[
            {
              status: "awaiting_acceptance" as Status,
              icon: ClipboardList,
              label: "New orders",
            },
            {
              status: "preparing" as Status,
              icon: ChefHat,
              label: "Preparing",
            },
            {
              status: "ready" as Status,
              icon: ShoppingBag,
              label: "Ready for handoff",
            },
            {
              status: "collected" as Status,
              icon: CircleCheck,
              label: "Collected",
            },
          ].map((s) => (
            <div className="metric" key={s.status}>
              <div>
                <p>{s.label}</p>
                <strong>{counts(s.status).toString().padStart(2, "0")}</strong>
              </div>
              <s.icon size={25} />
            </div>
          ))}
        </section>
        {["Orders", "Kitchen"].includes(view) && (
          <>
            <div className="toolbar">
              <div className="tabs" role="group" aria-label="Fulfilment filter">
                {["all", "delivery", "pickup"].map((f) => (
                  <button
                    key={f}
                    className={filter === f ? "selected" : ""}
                    onClick={() => setFilter(f)}
                  >
                    {f === "all"
                      ? "All orders"
                      : f === "pickup"
                        ? "Pickup"
                        : "Delivery"}
                  </button>
                ))}
              </div>
              <div className="search">
                <Search size={17} />
                <input
                  aria-label="Search order ID"
                  placeholder="Search order ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                className="refresh"
                aria-label="Refresh orders"
                disabled={busy}
                onClick={() => void sync()}
              >
                <RefreshCw size={17} />
              </button>
            </div>
            <div
              className="board"
              style={{
                gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))`,
              }}
            >
              {stages.map((status) => (
                <section className="lane" key={status}>
                  <div className="lane-heading">
                    <span>
                      <i className={status} />
                      {names[status]}
                    </span>
                    <b>
                      {
                        filtered.filter(
                          (o) =>
                            o.status === status && o.paymentStatus === "paid",
                        ).length
                      }
                    </b>
                  </div>
                  <div className="lane-body">
                    {filtered
                      .filter(
                        (o) =>
                          o.status === status && o.paymentStatus === "paid",
                      )
                      .map(renderCard)}
                    {!filtered.some(
                      (o) => o.status === status && o.paymentStatus === "paid",
                    ) && (
                      <div className="empty-lane">
                        <CircleCheck size={24} />
                        <p>
                          {status === "awaiting_acceptance"
                            ? "All caught up"
                            : `No ${names[status].toLowerCase()} orders`}
                        </p>
                        <small>
                          {status === "awaiting_acceptance"
                            ? "Verified orders will appear here."
                            : "Updates appear automatically."}
                        </small>
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
            {paid.some((o) => ["collected", "rejected"].includes(o.status)) && (
              <details className="history">
                <summary>
                  Completed and declined orders (
                  {
                    paid.filter((o) =>
                      ["collected", "rejected"].includes(o.status),
                    ).length
                  }
                  )
                </summary>
                <div className="history-grid">
                  {filtered
                    .filter((o) => ["collected", "rejected"].includes(o.status))
                    .map(renderCard)}
                </div>
              </details>
            )}
            {orders.some((o) => o.paymentStatus !== "paid") && (
              <p className="pending">
                {orders.filter((o) => o.paymentStatus !== "paid").length}{" "}
                payment-pending order(s) are awaiting verification and cannot be
                accepted.
              </p>
            )}
          </>
        )}
        {view === "Delivery" && (
          <DeliveryDesk
            orders={orders}
            riders={riders}
            busy={busy}
            connected={connected}
            run={run}
            api={api}
          />
        )}
        {view === "Menu" && (
          <section className="menu-list">
            {products.map((p) => (
              <div className="menu-row" key={p.id}>
                <span className={`diet ${p.vegetarian ? "veg" : "nonveg"}`}>
                  ●
                </span>
                <div>
                  <b>{p.name}</b>
                  <p>
                    {p.category} · {money(p.pricePaise)} · sample pricing
                  </p>
                </div>
                <button
                  disabled={busy || !connected}
                  className={p.available ? "availability" : "outline"}
                  onClick={() =>
                    void run(() =>
                      api.request(`/menu/${p.id}`, "PATCH", {
                        available: !p.available,
                      }),
                    )
                  }
                >
                  {p.available ? "Available" : "Sold out"}
                  <span className={`toggle ${p.available ? "on" : ""}`} />
                </button>
              </div>
            ))}
          </section>
        )}
        {view === "Shift log" && (
          <section className="activity">
            <h2>Recent outlet actions</h2>
            {audit.length ? (
              audit.map((a) => (
                <div className="activity-row" key={a.id}>
                  <History size={18} />
                  <div>
                    <b>{a.action.replaceAll(".", " · ")}</b>
                    <p>
                      {a.resourceId}
                      {a.detail ? ` · ${a.detail}` : ""}
                    </p>
                  </div>
                  <time>
                    {new Date(a.createdAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </time>
                </div>
              ))
            ) : (
              <p className="muted">
                Actions will appear when your team starts processing orders.
              </p>
            )}
          </section>
        )}
        {view === "Team" && user.role === "owner" && <TeamAccess api={api} />}
        {view === "Account" && (
          <AccountSettings
            api={api}
            onToken={(token) => {
              api.token = token;
              sessionStorage.setItem("pista-session", token);
            }}
            onSignedOut={clearSession}
          />
        )}
        <footer>
          <span className={connected ? "connection" : "connection offline"}>
            <i />
            {connected
              ? "Connected to outlet"
              : "Connection interrupted · actions unavailable"}
          </span>
          <span>
            {updated
              ? `Updated ${updated.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
              : "Connecting…"}{" "}
            · Refreshes every 4 seconds
          </span>
        </footer>
      </main>
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Order details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              onClick={() => setDetail(null)}
              autoFocus
              aria-label="Close details"
            >
              ×
            </button>
            <p className="eyebrow">ORDER DETAILS</p>
            <h2>#PH{String(detail.number).padStart(4, "0")}</h2>
            <p>
              {names[detail.status]} · Payment {detail.paymentStatus}
            </p>
            {detail.items.map((i, n) => (
              <p key={n}>
                {i.quantity} × {i.name} <b>{money(i.unitPaise * i.quantity)}</b>
              </p>
            ))}
            <hr />
            <p>
              Total <b>{money(detail.totalPaise)}</b>
            </p>
            <h3>Order history</h3>
            {detail.events.map((e, i) => (
              <p key={i} className="muted">
                {e.action.replaceAll("_", " ")} ·{" "}
                {new Date(e.createdAt).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </p>
            ))}
            <button className="outline full" onClick={() => setDetail(null)}>
              Close
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function Logo() {
  return (
    <div className="logo-crop">
      <img src="/brand/logo.svg" alt="Pista House" />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
