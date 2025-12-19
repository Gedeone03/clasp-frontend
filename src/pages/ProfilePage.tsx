import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../AuthContext";

function useIsMobile(breakpointPx: number = 900) {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.innerWidth < breakpointPx : false));
  useEffect(() => {
    const on = () => setM(window.innerWidth < breakpointPx);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [breakpointPx]);
  return m;
}

function resolveAvatar(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function ProfilePage() {
  const nav = useNavigate();
  const isMobile = useIsMobile(900);
  const { user, refreshMe } = useAuth();

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // campi editabili (se il tuo backend li supporta)
  const [displayName, setDisplayName] = useState("");
  const [statusText, setStatusText] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [mood, setMood] = useState("");
  const [state, setState] = useState("");

  const title = useMemo(() => "Profilo", []);

  useEffect(() => {
    setDisplayName(user?.displayName || "");
    setStatusText((user as any)?.statusText || "");
    setCity((user as any)?.city || "");
    setArea((user as any)?.area || "");
    setMood((user as any)?.mood || "");
    setState((user as any)?.state || "");
  }, [user]);

  const wrapStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, zIndex: 9999, background: "var(--tiko-bg-dark)", overflowY: "auto" }
    : { minHeight: "100%" };

  const cardStyle: React.CSSProperties = {
    background: "var(--tiko-bg-card)",
    border: "1px solid #222",
    borderRadius: 14,
    padding: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "var(--tiko-bg-dark)",
    color: "var(--tiko-text)",
  };

  async function saveProfile() {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken") || "";
      const t = token.toLowerCase().startsWith("bearer ") ? token.slice(7).trim() : token.trim();

      const res = await fetch(`${API_BASE_URL}/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify({
          displayName,
          statusText,
          city: city || null,
          area: area || null,
          mood: mood || null,
          state: state || null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);

      setMsg("Profilo aggiornato.");
      await refreshMe();
    } catch (e: any) {
      setErr(String(e?.message || "Errore salvataggio profilo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={wrapStyle}>
      <div style={{ padding: 14, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => nav("/", { replace: false })}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid #2a2a2a",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 950,
              }}
              aria-label="Indietro"
            >
              ←
            </button>
            <h2 style={{ margin: 0 }}>{title}</h2>
          </div>

          <button
            type="button"
            onClick={() => saveProfile()}
            disabled={saving}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              background: "var(--tiko-mint)",
              color: "#000",
              fontWeight: 950,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Salvo..." : "Salva"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 999,
                  overflow: "hidden",
                  border: "1px solid #2a2a2a",
                  background: "#111",
                  flex: "0 0 auto",
                }}
              >
                {resolveAvatar((user as any)?.avatarUrl) ? (
                  <img
                    src={resolveAvatar((user as any)?.avatarUrl)!}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 950, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.displayName || user?.username || "Utente"}
                </div>
                <div style={{ color: "var(--tiko-text-dim)", fontSize: 12 }}>
                  @{user?.username || ""}
                </div>
              </div>
            </div>

            {err && <div style={{ marginTop: 10, color: "#ff6b6b", fontWeight: 950 }}>Errore: {err}</div>}
            {msg && <div style={{ marginTop: 10, color: "var(--tiko-text-dim)", fontWeight: 900 }}>{msg}</div>}
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Dati profilo</div>

            <label style={{ display: "block", fontSize: 12, color: "var(--tiko-text-dim)", marginBottom: 6 }}>Nome visualizzato</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />

            <div style={{ height: 10 }} />

            <label style={{ display: "block", fontSize: 12, color: "var(--tiko-text-dim)", marginBottom: 6 }}>Status</label>
            <input value={statusText} onChange={(e) => setStatusText(e.target.value)} style={inputStyle} />

            <div style={{ height: 10 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--tiko-text-dim)", marginBottom: 6 }}>Città</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--tiko-text-dim)", marginBottom: 6 }}>Zona</label>
                <input value={area} onChange={(e) => setArea(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--tiko-text-dim)", marginBottom: 6 }}>Mood</label>
                <input value={mood} onChange={(e) => setMood(e.target.value)} style={inputStyle} placeholder="es. FELICE" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--tiko-text-dim)", marginBottom: 6 }}>Stato</label>
                <input value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} placeholder="es. DISPONIBILE" />
              </div>
            </div>

            <div style={{ marginTop: 10, color: "var(--tiko-text-dim)", fontSize: 12 }}>
              Nota: se nel tuo backend mood/state sono a scelta (select), puoi sostituire questi input con select.
              Qui li lascio “safe” per non romperti nulla.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
