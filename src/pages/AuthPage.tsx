import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

type Mode = "login" | "register";

export default function AuthPage() {
  // Marker visibile: se non lo vedi sul sito live, Netlify non sta servendo la tua versione
  const BUILD_MARKER = "AUTH FIX BUILD: 2025-12-19-01";

  console.log(BUILD_MARKER);

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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetMsgs = () => {
    setStatus(null);
    setError(null);
  };

  const doLogin = async () => {
    resetMsgs();
    try {
      setLoading(true);
      setStatus("Invio login...");
      const id = identifier.trim();
      const pw = password;

      if (!id || !pw) {
        setError("Inserisci email/username e password.");
        return;
      }

      await login(id, pw);
      setStatus("Login OK. Reindirizzamento...");
      nav("/", { replace: true });
    } catch (e: any) {
      setError(String(e?.message || "Errore durante il login."));
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async () => {
    resetMsgs();
    try {
      setLoading(true);
      setStatus("Invio registrazione...");

      const em = email.trim();
      const un = username.trim();
      const dn = displayName.trim();
      const pw = password;

      if (!em || !un || !dn || !pw) {
        setError("Compila tutti i campi obbligatori.");
        return;
      }

      if (!termsAccepted) {
        setError("Devi accettare i Termini e la Privacy.");
        return;
      }

      await register({
        email: em,
        password: pw,
        username: un,
        displayName: dn,
        termsAccepted,
      });

      setStatus("Registrazione OK. Reindirizzamento...");
      nav("/", { replace: true });
    } catch (e: any) {
      setError(String(e?.message || "Errore durante la registrazione."));
    } finally {
      setLoading(false);
    }
  };

  // Forza l’azione anche se submit non scatta
  const onPrimaryClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;

    if (mode === "login") await doLogin();
    else await doRegister();
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "var(--tiko-bg-dark)",
    color: "var(--tiko-text)",
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
          width: "min(520px, 100%)",
          background: "var(--tiko-bg-card)",
          border: "1px solid #222",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 12, color: "yellow", marginBottom: 10, fontWeight: 900 }}>
          {BUILD_MARKER}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => {
              resetMsgs();
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
              resetMsgs();
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

        {/* FORM */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "login") void doLogin();
            else void doRegister();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {mode === "login" ? (
            <>
              <input
                placeholder="Email o username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                style={inputStyle}
                autoComplete="username"
              />
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete="current-password"
              />
            </>
          ) : (
            <>
              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="email"
              />

              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={inputStyle}
                autoComplete="username"
              />

              <input
                placeholder="Nome visualizzato"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputStyle}
                autoComplete="name"
              />

              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
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
            type="button"
            onClick={onPrimaryClick}
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

          {/* Stato/Errore sempre visibili */}
          {status && (
            <div style={{ marginTop: 6, color: "var(--tiko-text-dim)", fontWeight: 900, fontSize: 13 }}>
              {status}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 6, color: "#ff6b6b", fontWeight: 950, fontSize: 13 }}>
              ERRORE: {error}
            </div>
          )}
        </form>

        <div style={{ marginTop: 14, fontSize: 12, color: "var(--tiko-text-dim)" }}>
          Se la scritta gialla non cambia dopo il deploy, stai vedendo una versione in cache.
        </div>
      </div>
    </div>
  );
}
