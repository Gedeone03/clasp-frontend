import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

type Mode = "login" | "register";

export default function AuthPage() {
  const nav = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");

  // login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // register
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const resetMessages = () => {
    setMsg(null);
    setErr(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    try {
      setLoading(true);

      if (mode === "login") {
        const id = identifier.trim();
        const pw = password;

        if (!id || !pw) {
          setErr("Inserisci email/username e password.");
          return;
        }

        await login(id, pw);
        setMsg("Login effettuato.");
        nav("/", { replace: true });
        return;
      }

      // REGISTER
      const em = email.trim();
      const un = username.trim();
      const dn = displayName.trim();
      const pw = password;

      if (!em || !un || !dn || !pw) {
        setErr("Compila tutti i campi obbligatori.");
        return;
      }
      if (!termsAccepted) {
        setErr("Devi accettare i Termini e le Condizioni.");
        return;
      }

      await register({
        email: em,
        password: pw,
        username: un,
        displayName: dn,
        termsAccepted,
      });

      setMsg("Registrazione completata.");
      nav("/", { replace: true });
    } catch (e: any) {
      const text = String(e?.message || "Errore durante la richiesta.");
      setErr(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--tiko-bg-dark)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          background: "var(--tiko-bg-card)",
          border: "1px solid #222",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setMode("login");
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              background: mode === "login" ? "var(--tiko-purple)" : "transparent",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              resetMessages();
              setMode("register");
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              background: mode === "register" ? "var(--tiko-purple)" : "transparent",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Registrati
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "login" ? (
            <>
              <input
                placeholder="Email o username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #2a2a2a",
                  background: "var(--tiko-bg-dark)",
                  color: "var(--tiko-text)",
                }}
              />
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #2a2a2a",
                  background: "var(--tiko-bg-dark)",
                  color: "var(--tiko-text)",
                }}
              />
            </>
          ) : (
            <>
              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #2a2a2a",
                  background: "var(--tiko-bg-dark)",
                  color: "var(--tiko-text)",
                }}
              />

              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #2a2a2a",
                  background: "var(--tiko-bg-dark)",
                  color: "var(--tiko-text)",
                }}
              />

              <input
                placeholder="Nome visualizzato"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #2a2a2a",
                  background: "var(--tiko-bg-dark)",
                  color: "var(--tiko-text)",
                }}
              />

              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #2a2a2a",
                  background: "var(--tiko-bg-dark)",
                  color: "var(--tiko-text)",
                }}
              />

              <label style={{ fontSize: 13, color: "var(--tiko-text-dim)" }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Accetto i <Link to="/terms">Termini</Link> e la <Link to="/privacy">Privacy</Link>
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              background: "var(--tiko-mint)",
              color: "#000",
              fontWeight: 950,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Invio..." : mode === "login" ? "Entra" : "Crea account"}
          </button>

          {err && (
            <div style={{ marginTop: 6, color: "#ff6b6b", fontWeight: 800, fontSize: 13 }}>
              {err}
            </div>
          )}
          {msg && (
            <div style={{ marginTop: 6, color: "var(--tiko-text-dim)", fontWeight: 800, fontSize: 13 }}>
              {msg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
