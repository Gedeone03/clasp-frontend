import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/ui/Sidebar";
import { API_BASE_URL } from "../config";
import { useAuth } from "../AuthContext";

type StateKey = "DISPONIBILE" | "OCCUPATO" | "ASSENTE" | "OFFLINE" | "INVISIBILE" | "VISIBILE_A_TUTTI" | "";
type MoodKey = "FELICE" | "TRISTE" | "RILASSATO" | "ANSIOSO" | "ENTUSIASTA" | "ARRABBIATO" | "SOLO" | "";

function normalizeToken(raw: string | null | undefined): string {
  let t = String(raw || "").trim();
  if (!t) return "";
  if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1).trim();
  return t;
}

function getToken(): string {
  return normalizeToken(
    localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken") ||
      ""
  );
}

function baseUrl(): string {
  return (API_BASE_URL || "").replace(/\/+$/, "");
}

function resolveUrl(url?: string | null) {
  if (!url) return "";
  let t = String(url).trim();
  if (!t) return "";
  if (t.startsWith("/")) t = `${baseUrl()}${t}`;
  if (typeof window !== "undefined" && window.location.protocol === "https:" && t.startsWith("http://")) {
    t = t.replace(/^http:\/\//i, "https://");
  }
  return t;
}

function useIsMobile(bp = 900) {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.innerWidth < bp : false));
  useEffect(() => {
    const onR = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [bp]);
  return m;
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = getToken();
  const headers: any = { ...(init?.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res;
}

export default function ProfilePage(props: any) {
  const nav = useNavigate();
  const isMobile = useIsMobile(900);

  const auth = useAuth() as any;
  const user = auth.user as any;

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [statusText, setStatusText] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [state, setState] = useState<StateKey>("");
  const [mood, setMood] = useState<MoodKey>("");

  const avatarUrl = useMemo(() => resolveUrl(user?.avatarUrl), [user?.avatarUrl]);

  const STATE_OPTIONS: { value: StateKey; label: string }[] = [
    { value: "", label: "—" },
    { value: "DISPONIBILE", label: "Disponibile" },
    { value: "OCCUPATO", label: "Occupato" },
    { value: "ASSENTE", label: "Assente" },
    { value: "OFFLINE", label: "Offline" },
    { value: "INVISIBILE", label: "Invisibile" },
    { value: "VISIBILE_A_TUTTI", label: "Visibile a tutti" },
  ];

  const MOOD_OPTIONS: { value: MoodKey; label: string }[] = [
    { value: "", label: "—" },
    { value: "FELICE", label: "Felice" },
    { value: "TRISTE", label: "Triste" },
    { value: "RILASSATO", label: "Rilassato" },
    { value: "ANSIOSO", label: "Ansioso" },
    { value: "ENTUSIASTA", label: "Entusiasta" },
    { value: "ARRABBIATO", label: "Arrabbiato" },
    { value: "SOLO", label: "Solo" },
  ];

  function applyUserToForm(u: any) {
    setDisplayName(u?.displayName || "");
    setStatusText(u?.statusText || "");
    setCity(u?.city || "");
    setArea(u?.area || "");
    setState((u?.state as StateKey) || "");
    setMood((u?.mood as MoodKey) || "");
  }

  function updateAuthUser(nextUser: any) {
    try { auth.setUser?.(nextUser); } catch {}
    try { auth.updateUser?.(nextUser); } catch {}
    try { localStorage.setItem("user", JSON.stringify(nextUser)); } catch {}
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setMsg("Non autenticato. Effettua il login.");
      return;
    }

    let alive = true;
    (async () => {
      try {
        const res = await apiFetch("/me");
        const me = await res.json();
        if (!alive) return;
        updateAuthUser(me);
        applyUserToForm(me);
      } catch (e: any) {
        if (!alive) return;
        setMsg("Errore caricamento profilo: " + (e?.message || "errore"));
      }
    })();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    setMsg(null);
    setBusy(true);
    try {
      const body: any = {
        displayName: displayName.trim(),
        statusText: statusText.trim() || null,
        city: city.trim() || null,
        area: area.trim() || null,
        state: state || "OFFLINE",
        mood: mood || null,
      };

      const res = await apiFetch("/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const updated = await res.json();
      updateAuthUser(updated);
      applyUserToForm(updated);
      setMsg("Salvato.");
    } catch (e: any) {
      setMsg("Errore salvataggio: " + (e?.message || "errore"));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadAvatar(file: File) {
    setMsg(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);

      const token = getToken();
      const res = await fetch(`${baseUrl()}/upload/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => ({}));
      const nextUser = data?.user ? data.user : { ...(user || {}), avatarUrl: data?.avatarUrl || user?.avatarUrl };
      updateAuthUser(nextUser);
      applyUserToForm(nextUser);
      setMsg("Avatar aggiornato.");
    } catch (e: any) {
      setMsg("Errore upload avatar: " + (e?.message || "errore"));
    } finally {
      setBusy(false);
    }
  }

  const card: React.CSSProperties = {
    maxWidth: 820,
    margin: "0 auto",
    background: "var(--tiko-bg-card)",
    border: "1px solid #222",
    borderRadius: 18,
    padding: 14,
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

  const row: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };

  const btn: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "#7A29FF",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  };

  // ✅ MOBILE = pagina dedicata fullscreen (overlay)
  const pageWrap: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, zIndex: 999, background: "var(--tiko-bg-dark)", display: "flex", flexDirection: "column" }
    : { height: "100vh", display: "flex", overflow: "hidden", background: "var(--tiko-bg-dark)" };

  return (
    <div style={pageWrap}>
      {!isMobile && <Sidebar />}

      {isMobile && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--tiko-bg-card)" }}>
          <button
            type="button"
            onClick={() => {
              if (typeof props?.onBack === "function") props.onBack();
              else nav(-1);
            }}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #2a2a2a", background: "var(--tiko-bg-dark)", color: "var(--tiko-text)", fontWeight: 950 }}
          >
            ← Indietro
          </button>
          <div style={{ fontWeight: 950 }}>Profilo</div>
          <div style={{ width: 90 }} />
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        <div style={card}>
          <h2 style={{ margin: "0 0 10px 0" }}>Profilo</h2>

          {msg && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid #2a2a2a", background: "rgba(58,190,255,0.08)", color: "var(--tiko-text)", fontWeight: 850 }}>
              {msg}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ width: 74, height: 74, borderRadius: 999, border: "1px solid #333", overflow: "hidden", background: "#1f1f26" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950 }}>—</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontWeight: 900, color: "var(--tiko-text-dim)" }}>
                @{user?.username || "—"} • {user?.email || ""}
              </div>

              <label style={{ fontSize: 13, color: "var(--tiko-text-dim)", fontWeight: 900 }}>
                Carica immagine profilo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadAvatar(f);
                    e.currentTarget.value = "";
                  }}
                  style={{ display: "block", marginTop: 6 }}
                />
              </label>
            </div>
          </div>

          <div style={row}>
            <div style={{ flex: "1 1 320px" }}>
              <label style={{ fontSize: 12, color: "var(--tiko-text-dim)", fontWeight: 900 }}>Nome visualizzato</label>
              <input style={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 320px" }}>
              <label style={{ fontSize: 12, color: "var(--tiko-text-dim)", fontWeight: 900 }}>Testo stato</label>
              <input style={input} value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="Es. In pausa, al lavoro..." />
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div style={row}>
            <div style={{ flex: "1 1 220px" }}>
              <label style={{ fontSize: 12, color: "var(--tiko-text-dim)", fontWeight: 900 }}>Stato</label>
              <select style={input as any} value={state} onChange={(e) => setState(e.target.value as StateKey)}>
                {STATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <label style={{ fontSize: 12, color: "var(--tiko-text-dim)", fontWeight: 900 }}>Mood</label>
              <select style={input as any} value={mood} onChange={(e) => setMood(e.target.value as MoodKey)}>
                {MOOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <label style={{ fontSize: 12, color: "var(--tiko-text-dim)", fontWeight: 900 }}>Città</label>
              <input style={input} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <label style={{ fontSize: 12, color: "var(--tiko-text-dim)", fontWeight: 900 }}>Zona</label>
              <input style={input} value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={onSave} style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
              {busy ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
