import { FormEvent, ReactNode, useState } from "react";
import { Api } from "@pista/web-api";
import "./Accounts.css";
export type SignedIn = {
  token: string;
  user: { id: string; name: string; role: string };
};
export function AccountAccess({
  api,
  development,
  onSignedIn,
  error: initialError,
  logo,
}: {
  api: Api;
  development: boolean;
  onSignedIn: (data: SignedIn) => void;
  error: string;
  logo: ReactNode;
}) {
  const [mode, setMode] = useState<"login" | "invite" | "development">("login"),
    [handle, setHandle] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [token, setToken] = useState(""),
    [identity, setIdentity] = useState("counter"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "invite" && password !== confirm) {
      setError("Passphrases do not match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data =
        mode === "development"
          ? await api.request<SignedIn>("/auth/development", "POST", {
              identity,
            })
          : mode === "invite"
            ? await api.request<SignedIn>("/auth/accept-invitation", "POST", {
                token: token.trim(),
                password,
                audience: "employee",
              })
            : await api.request<SignedIn>("/auth/login", "POST", {
                handle,
                password,
                audience: "employee",
              });
      setPassword("");
      setConfirm("");
      setToken("");
      onSignedIn(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-wrap account-access">
      <form className="login" onSubmit={submit}>
        {logo}
        <p className="eyebrow">SHANKARPALLY · EMPLOYEE ACCESS</p>
        <h1>Your order desk.</h1>
        <p className="muted">Sign in to coordinate the counter and kitchen.</p>
        <div className="account-tabs" aria-label="Access options">
          <button
            type="button"
            aria-pressed={mode === "login"}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={mode === "invite"}
            onClick={() => setMode("invite")}
          >
            Use invitation
          </button>
          {development && (
            <button
              type="button"
              aria-pressed={mode === "development"}
              onClick={() => setMode("development")}
            >
              Test access
            </button>
          )}
        </div>
        {mode === "development" ? (
          <>
            <p className="dev-note">
              Development identities only. Sample orders and test payments.
            </p>
            <label>
              Development identity
              <select
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
              >
                <option value="counter">Counter team</option>
                <option value="kitchen">Kitchen team</option>
                <option value="owner">Owner</option>
              </select>
            </label>
          </>
        ) : (
          <>
            {mode === "invite" ? (
              <label>
                Invitation or recovery code
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  maxLength={64}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            ) : (
              <label>
                Sign-in handle
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  required
                  maxLength={48}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
            )}
            <label>
              {mode === "invite" ? "Choose a passphrase" : "Passphrase"}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "invite" ? 12 : 1}
                maxLength={128}
                autoComplete={
                  mode === "invite" ? "new-password" : "current-password"
                }
              />
            </label>
            {mode === "invite" && (
              <>
                <label>
                  Confirm passphrase
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
                <p className="account-help">
                  Use at least 12 characters. Your owner assigns your role;
                  invitations expire after 24 hours.
                </p>
              </>
            )}
          </>
        )}
        <button className="primary full" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "invite"
              ? "Activate account"
              : mode === "development"
                ? "Open test order desk"
                : "Sign in"}
        </button>
        {(error || initialError) && (
          <p className="error" role="alert">
            {error || initialError}
          </p>
        )}
        <p className="account-help">
          Need access or password recovery? Ask your outlet owner. The first
          owner account is configured on the server.
        </p>
        <small>Internal operations · authorised employees only</small>
      </form>
    </div>
  );
}
