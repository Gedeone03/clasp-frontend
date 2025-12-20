import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

type Mode = "login" | "register";

export default function AuthPage() {
  const nav = useNavigate();
  const auth = useAuth() as any;

  const [mode, setMode] = useState<Mode>("login");

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (mode === "login" ? "Accedi" : "Crea account"), [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;

    try {
      setBusy(true);

      if (mode === "login") {
        if (!emailOrUsername.trim() || !password) {
          setError("Compila tutti i campi.");
          return;
        }

        // login(emailOrUsername, password)
        await auth.login(emailOrUsername.trim(), password);
        nav("/", { replace: true });
        return;
      }

      // register
      if (!email.trim() || !username.trim() || !displayName.trim() || !password) {
        setError("Compila tutti i campi obbligatori.");
        return;
      }

      if (!termsAccepted) {
        setError("Devi accettare i Termini e le Condizioni d'uso.");
        return;
      }

      await auth.register({
        email: email.trim(),
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        city: city.trim() || null,
        area: area.trim() || null,
        termsAccepted: true,
      });

      nav("/", { replace: true });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Errore durante la richiesta.";
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  }

  const card: React.CSSProperties = {
    width: "min(520px, 92vw)",
    background: "var(--tiko-bg-card)",
    border: "1px solid #222",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "var(--tiko-bg-dark)",
    color: "var(--tiko-text)",
    outline: "none",
    fontSize: 14,
  };

  const btn: React.CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "#7A29FF",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: active ? "var(--tiko-bg-dark)" : "transparent",
    color: "var(--tiko-text)",
    fontWeight: 950,
    cursor: "pointer",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--tiko-bg-dark)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={card}>
        {/* ✅ RIMOSSO: banner giallo "AUTH FIX BUILD..." */}

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button type="button" style={tabBtn(mode === "login")} onClick={() => setMode("login")}>
            Login
          </button>
          <button type="button" style={tabBtn(mode === "register")} onClick={() => setMode("register")}>
            Registrazione
          </button>
        </div>

        <h2 style={{ margin: "0 0 10px 0", color: "var(--tiko-text)" }}>{title}</h2>

        {error && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid #3a1f1f", background: "rgba(255,59,48,0.08)", color: "#ff6b6b", fontWeight: 850 }}>
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "login" ? (
            <>
              <input
                style={input}
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="Email oppure Username"
                autoComplete="username"
              />

              <input
                style={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
              />
            </>
          ) : (
            <>
              <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" />
              <input style={input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" />
              <input style={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome visualizzato" />

              <div style={{ display: "flex", gap: 10 }}>
                <input style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Città (opzionale)" />
                <input style={input} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Zona (opzionale)" />
              </div>

              <input style={input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="new-password" />

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--tiko-text-dim)" }}>
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                <span>
                  Accetto i{" "}
                  <Link to="/terms" style={{ color: "#3ABEFF", fontWeight: 900 }}>
                    Termini e Condizioni
                  </Link>{" "}
                  e l’{" "}
                  <Link to="/privacy" style={{ color: "#3ABEFF", fontWeight: 900 }}>
                    Informativa Privacy
                  </Link>
                  .
                </span>
              </label>
            </>
          )}

          <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
            {busy ? "Attendere..." : mode === "login" ? "Accedi" : "Registrati"}
          </button>
        </form>

        <div style={{ marginTop: 12, fontSize: 12, color: "var(--tiko-text-dim)" }}>
          Se dopo il login non succede nulla, di solito è perché il backend non risponde o il token non viene salvato correttamente.
        </div>
      </div>
    </div>
  );
}
