import { FormEvent, useCallback, useEffect, useState } from "react";
import { Api, AccountSession } from "@pista/web-api";
import "./Accounts.css";
export function AccountSettings({
  api,
  onToken,
  onSignedOut,
}: {
  api: Api;
  onToken: (token: string) => void;
  onSignedOut: () => void;
}) {
  const [sessions, setSessions] = useState<AccountSession[]>([]),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(
    async () =>
      setSessions(await api.request<AccountSession[]>("/auth/sessions")),
    [api],
  );
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      if (api.token) await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function change(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passphrases do not match");
      return;
    }
    void run(async () => {
      const result = await api.request<{ token: string }>(
        "/auth/password",
        "POST",
        { currentPassword: current, password },
      );
      onToken(result.token);
      setCurrent("");
      setPassword("");
      setConfirm("");
      setMessage(
        "Passphrase changed. Other sessions and unused recovery codes were revoked.",
      );
    });
  }
  return (
    <section className="accounts-page">
      <h2>Your account</h2>
      <p className="account-help">
        Passphrases are available for invited staff and owner accounts.
        Development identities do not have a passphrase.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="account-success" role="status">
          {message}
        </p>
      )}
      <form className="password-form" onSubmit={change}>
        <h3>Change passphrase</h3>
        <label>
          Current passphrase
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            maxLength={128}
            required
          />
        </label>
        <label>
          New passphrase
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <label>
          Confirm new passphrase
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <button className="primary" disabled={busy}>
          Update passphrase
        </button>
      </form>
      <div className="account-heading">
        <h3>Active sessions</h3>
        <button
          className="outline"
          disabled={busy}
          onClick={() => void run(async () => {})}
        >
          Refresh
        </button>
      </div>
      <div className="team-list">
        {sessions.map((s) => (
          <article key={s.id}>
            <div>
              <b>
                {s.current ? "This session" : "Another session"} ·{" "}
                {s.authMethod === "password"
                  ? "Password sign-in"
                  : "Development access"}
              </b>
              <p>
                Created{" "}
                {new Date(s.createdAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
                <br />
                Expires{" "}
                {new Date(s.expiresAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </p>
            </div>
            <button
              className="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api.request(`/auth/sessions/${s.id}`, "DELETE");
                  if (s.current) onSignedOut();
                })
              }
            >
              {s.current ? "Sign out" : "Revoke"}
            </button>
          </article>
        ))}
      </div>
      <button
        className="outline"
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              "Sign out every session for your account, including this one?",
            )
          )
            void run(async () => {
              await api.request("/auth/logout-all", "POST", {});
              onSignedOut();
            });
        }}
      >
        Sign out all sessions
      </button>
    </section>
  );
}
