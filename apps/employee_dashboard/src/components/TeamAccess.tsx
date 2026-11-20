import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Api, IssuedInvitation, Invitation, TeamMember } from "@pista/web-api";
import "./Accounts.css";
export function TeamAccess({ api }: { api: Api }) {
  const [members, setMembers] = useState<TeamMember[]>([]),
    [invitations, setInvitations] = useState<Invitation[]>([]),
    [issued, setIssued] = useState<IssuedInvitation | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [handle, setHandle] = useState(""),
    [role, setRole] = useState("counter");
  const mounted = useRef(true);
  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      api.request<TeamMember[]>("/team"),
      api.request<Invitation[]>("/team/invitations"),
    ]);
    if (mounted.current) {
      setMembers(m);
      setInvitations(i);
    }
  }, [api]);
  useEffect(() => {
    mounted.current = true;
    load().catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, [load]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await load();
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function invite(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      setIssued(
        await api.request<IssuedInvitation>("/team/invitations", "POST", {
          name,
          handle,
          role,
        }),
      );
      setName("");
      setHandle("");
    });
  }
  const active = (i: Invitation) =>
    !i.usedAt && !i.revokedAt && new Date(i.expiresAt) > new Date();
  return (
    <section className="accounts-page">
      <div className="account-heading">
        <div>
          <h2>Team access</h2>
          <p>
            Invite counter, kitchen and delivery teammates with the role they
            need.
          </p>
        </div>
        <button
          className="outline"
          disabled={busy}
          onClick={() => void run(async () => {})}
        >
          Refresh
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {issued && (
        <section className="issued-code" aria-label="New invitation code">
          <h3>
            {issued.kind === "reset" ? "Recovery code" : "Invitation created"} ·{" "}
            {issued.handle}
          </h3>
          <p>
            This code is shown once. Share it privately with the intended
            teammate.
          </p>
          <label>
            One-time code
            <textarea
              readOnly
              value={issued.token}
              rows={2}
              autoComplete="off"
            />
          </label>
          <p>
            Expires{" "}
            {new Date(issued.expiresAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST. The recipient sets their own passphrase.
          </p>
          <button className="outline" onClick={() => setIssued(null)}>
            Dismiss code
          </button>
        </section>
      )}
      <form className="invite-form" onSubmit={invite}>
        <h3>Invite a teammate</h3>
        <div className="account-form-grid">
          <label>
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Sign-in handle
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
              minLength={3}
              maxLength={48}
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="counter">Counter</option>
              <option value="kitchen">Kitchen</option>
              <option value="rider">Delivery rider</option>
            </select>
          </label>
        </div>
        <button className="primary" disabled={busy}>
          Create invitation
        </button>
      </form>
      <h3>Outlet accounts</h3>
      <div className="team-list">
        {members.map((m) => (
          <article key={m.id}>
            <div>
              <b>{m.name}</b>
              <p>
                {m.role} · {m.credential?.handle || "Development identity"}
                {m.developmentOnly ? " · Development only" : ""} ·{" "}
                {m.disabledAt ? "Suspended" : "Enabled"}
              </p>
            </div>
            {m.role !== "owner" && (
              <div className="account-row-actions">
                {m.credential && !m.disabledAt && (
                  <button
                    className="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Create a password-recovery code for ${m.name}? Their sessions will be revoked when the code is accepted.`,
                        )
                      )
                        void run(async () =>
                          setIssued(
                            await api.request<IssuedInvitation>(
                              `/team/${m.id}/recovery-invitation`,
                              "POST",
                              {},
                            ),
                          ),
                        );
                    }}
                  >
                    Recovery code
                  </button>
                )}
                <button
                  className="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `${m.disabledAt ? "Re-enable" : "Suspend"} ${m.name}? Existing sessions will be revoked. Open deliveries will return to outlet review.`,
                      )
                    )
                      void run(async () => {
                        await api.request(`/team/${m.id}/status`, "PATCH", {
                          disabled: !m.disabledAt,
                        });
                      });
                  }}
                >
                  {m.disabledAt ? "Re-enable" : "Suspend"}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <h3>Recent invitations</h3>
      <div className="team-list">
        {invitations.length ? (
          invitations.map((i) => (
            <article key={i.id}>
              <div>
                <b>
                  {i.name} · {i.handle}
                </b>
                <p>
                  {i.role} · {i.kind === "reset" ? "Recovery" : "New account"}
                  {i.developmentOnly ? " · Development only" : ""} ·{" "}
                  {i.usedAt
                    ? "Accepted"
                    : i.revokedAt
                      ? "Revoked"
                      : active(i)
                        ? "Awaiting acceptance"
                        : "Expired"}
                </p>
              </div>
              {active(i) && (
                <button
                  className="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api.request(`/team/invitations/${i.id}`, "DELETE");
                    })
                  }
                >
                  Revoke
                </button>
              )}
            </article>
          ))
        ) : (
          <p>No invitations yet.</p>
        )}
      </div>
    </section>
  );
}
