import { useCallback, useEffect, useRef, useState } from "react";
import { Api } from "@pista/web-api";
import "./SupportDesk.css";

type Item = {
  id: string;
  number: number;
  subject: string;
  status: string;
  customer: string;
  orderNumber: number | null;
  waitingMinutes: number | null;
  overdue: boolean;
  priority: string;
};
type Photo = { id: string; contentType: string; size: number };
type Message = {
  id: string;
  from: string;
  author?: string;
  body: string;
  internal?: boolean;
  createdAt: string;
  attachments?: Photo[];
};
type Detail = {
  id: string;
  number: number;
  subject: string;
  status: string;
  customer: { name: string };
  messages: Message[];
};

const FILTERS: [string, string][] = [
  ["needs_reply", "Needs reply"],
  ["waiting", "Waiting on customer"],
  ["finished", "Finished"],
  ["all", "All"],
];

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
}

/** Photos need the signed-in session, so they are fetched and shown from a blob. */
function SecurePhoto({ api, id }: { api: Api; id: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url = "";
    let live = true;
    fetch(`${api.base}/support/attachments/${id}`, {
      headers: { Authorization: `Bearer ${api.token}` },
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        if (!live) return;
        url = URL.createObjectURL(b);
        setSrc(url);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, id]);
  if (failed) return <span className="photo-fail">Photo unavailable</span>;
  if (!src) return <span className="photo-fail">Loading photo…</span>;
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt="Customer photo" />
    </a>
  );
}

/** Desktop alerts (only after permission) when new requests arrive. */
function useDeskAlerts(api: Api, onNew: () => void) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    let live = true;
    async function tick() {
      try {
        const r = await api.request<{ count: number }>(
          "/notifications/unread-count",
        );
        if (!live) return;
        if (last.current !== null && r.count > last.current) {
          onNew();
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          )
            new Notification("Pista House", {
              body: "New customer message or order",
            });
        }
        last.current = r.count;
      } catch {
        /* alerts are a convenience */
      }
    }
    void tick();
    const t = setInterval(tick, 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [api, onNew]);
}

export function SupportDesk({ api }: { api: Api }) {
  const [filter, setFilter] = useState("needs_reply");
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState(false);
  const [resolve, setResolve] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.request<Item[]>(`/support/inbox?filter=${filter}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, filter]);
  useEffect(() => {
    void load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);
  useDeskAlerts(api, load);

  async function show(id: string) {
    try {
      setOpen(await api.request<Detail>(`/support/inbox/${id}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send() {
    if (!open || !text.trim() || busy) return;
    setBusy(true);
    try {
      const next = await api.request<Detail>(
        `/support/inbox/${open.id}/reply`,
        "POST",
        {
          body: text.trim(),
          ...(note ? { internal: true } : {}),
          ...(resolve && !note ? { status: "resolved" } : {}),
        },
      );
      setOpen(next);
      setText("");
      setNote(false);
      setResolve(false);
      void load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="support-desk" aria-label="Customer support">
      <header>
        <h2>Customer support</h2>
        {typeof Notification !== "undefined" &&
          Notification.permission === "default" && (
            <button
              className="ghost"
              onClick={() => void Notification.requestPermission()}
            >
              Turn on desktop alerts
            </button>
          )}
      </header>
      {error && (
        <div className="error banner" role="alert">
          {error}
        </div>
      )}
      <div className="support-grid">
        <div className="support-list">
          <div className="tabs" role="group" aria-label="Request filter">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {items === null && <p>Loading…</p>}
          {items?.length === 0 && <p>Nothing here.</p>}
          {items?.map((t) => (
            <button
              key={t.id}
              className={`support-row ${open?.id === t.id ? "selected" : ""}`}
              onClick={() => void show(t.id)}
            >
              <b>
                #{t.number} · {t.subject}
              </b>
              <small>
                {t.customer}
                {t.orderNumber ? ` · order #${t.orderNumber}` : ""}
                {t.waitingMinutes !== null
                  ? ` · waiting ${t.waitingMinutes} min`
                  : ""}
              </small>
              {t.overdue && <span className="overdue">Overdue</span>}
            </button>
          ))}
        </div>
        <div className="support-thread">
          {!open && <p>Choose a request to read and reply.</p>}
          {open && (
            <>
              <h3>
                #{open.number} · {open.subject}
              </h3>
              <small>
                {open.customer.name} · {open.status.replace("_", " ")}
              </small>
              <div className="messages">
                {open.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`msg ${m.from} ${m.internal ? "internal" : ""}`}
                  >
                    <b>
                      {m.from === "system"
                        ? "Update"
                        : m.internal
                          ? `${m.author ?? "Staff"} · private note`
                          : (m.author ??
                            (m.from === "staff"
                              ? "Staff"
                              : open.customer.name))}
                    </b>
                    <p>{m.body}</p>
                    {(m.attachments ?? []).map((p) => (
                      <SecurePhoto key={p.id} api={api} id={p.id} />
                    ))}
                    <small>{ago(m.createdAt)}</small>
                  </div>
                ))}
              </div>
              <textarea
                aria-label="Reply"
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  note
                    ? "Private note (the customer never sees this)"
                    : "Reply to the customer"
                }
              />
              <div className="support-actions">
                <label>
                  <input
                    type="checkbox"
                    checked={note}
                    onChange={(e) => setNote(e.target.checked)}
                  />{" "}
                  Private note
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={resolve && !note}
                    disabled={note}
                    onChange={(e) => setResolve(e.target.checked)}
                  />{" "}
                  Mark resolved
                </label>
                <button
                  className="primary"
                  disabled={busy || !text.trim()}
                  onClick={() => void send()}
                >
                  {busy ? "Sending…" : note ? "Save note" : "Send reply"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
