import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../AuthContext";

function useIsMobile(breakpointPx = 1200) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isMobile;
}

const STATE_UI: Record<string, { label: string; color: string }> = {
  DISPONIBILE: { label: "Disponibile", color: "#2ecc71" },
  OCCUPATO: { label: "Occupato", color: "#ff3b30" },
  ASSENTE: { label: "Assente", color: "#f39c12" },
  OFFLINE: { label: "Offline", color: "#95a5a6" },
  INVISIBILE: { label: "Invisibile", color: "#9b59b6" },
  VISIBILE_A_TUTTI: { label: "Visibile a tutti", color: "#3ABEFF" },

  // compatibilità (se qualche record vecchio esiste ancora)
  ONLINE: { label: "Disponibile", color: "#2ecc71" },
  AWAY: { label: "Assente", color: "#f39c12" },
};

function stateLabel(state?: string | null) {
  if (!state) return "—";
  return STATE_UI[state]?.label ?? state;
}
function stateColor(state?: string | null) {
  if (!state) return "#666";
  return STATE_UI[state]?.color ?? "#666";
}

function initials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

function resolveUrlMaybeBackend(url?: string | null) {
  if (!url) return "";
  const t = url.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return `${API_BASE_URL.replace(/\/+$/, "")}${t}`;
  return t;
}

function Badge({ n }: { n: number }) {
  if (!n || n <= 0) return null;
  return (
    <span
      style={{
        marginLeft: 8,
        minWidth: 18,
        height: 18,
        padding: "0 6px",
        borderRadius: 999,
        background: "#ff3b30",
        color: "#fff",
        fontSize: 12,
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      title="Notifiche"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default function Sidebar() {
  const isMobile = useIsMobile(1200);
  const { user } = useAuth();
  const location = useLocation();

  const baseUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ""), []);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [pendingRequests, setPendingRequests] = useState(0);
  const prevPendingRef = useRef(0);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  const fetchPendingRequests = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      if (!token) {
        setPendingRequests(0);
        return;
      }

      const r = await fetch(`${baseUrl}/friends/requests/received`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (r.status === 401) {
        setPendingRequests(0);
        return;
      }
      if (!r.ok) return;

      const data = await r.json();
      const count = Array.isArray(data) ? data.length : 0;
      setPendingRequests(count);
    } catch {
      // silenzioso
    }
  };

  useEffect(() => {
    fetchPendingRequests();

    const onFocus = () => fetchPendingRequests();
    window.addEventListener("focus", onFocus);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchPendingRequests();
    }, 15000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = prevPendingRef.current;
    if (pendingRequests > prev) showToast("Nuova richiesta di amicizia");
    prevPendingRef.current = pendingRequests;
  }, [pendingRequests]);

  // chiudi drawer se cambi pagina
  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const avatarUrl = resolveUrlMaybeBackend((user as any)?.avatarUrl);

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    textDecoration: "none",
    color: "var(--tiko-text)",
    background: isActive ? "var(--tiko-bg-card)" : "transparent",
    border: "1px solid #222",
    marginBottom: 10,
    fontWeight: 800 as const,
  });

  const Nav = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <NavLink to="/" style={linkStyle}>
        <span>Home</span>
      </NavLink>

      <NavLink to="/friends" style={linkStyle}>
        <span>Amici</span>
        <Badge n={pendingRequests} />
      </NavLink>

      <NavLink to="/profile" style={linkStyle}>
        <span>Profilo</span>
      </NavLink>

      <NavLink to="/terms" style={linkStyle}>
        <span>Termini</span>
      </NavLink>

      <NavLink to="/privacy" style={linkStyle}>
        <span>Privacy</span>
      </NavLink>
    </div>
  );

  const HeaderBlock = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Logo Clasp (deve esistere in public/icons/) */}
      <img
        src="/icons/clasp-icon-192.png"
        alt="Clasp"
        width={34}
        height={34}
        style={{ borderRadius: 10, display: "block" }}
        onError={(e) => {
          // se manca il file, evita icona rotta
          (e.currentTarget as any).style.display = "none";
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>Clasp</div>
        <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>social chat</div>
      </div>
    </div>
  );

  const UserBlock = (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        background: "var(--tiko-bg-card)",
        border: "1px solid #222",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            width={44}
            height={44}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              objectFit: "cover",
              border: "1px solid #333",
              display: "block",
            }}
            onError={(e) => {
              // fallback se url non valida
              (e.currentTarget as any).style.display = "none";
            }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: "#1f1f26",
              border: "1px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 950,
            }}
          >
            {initials(user?.displayName)}
          </div>
        )}

        {/* pallino stato */}
        <div
          title={stateLabel((user as any)?.state)}
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: 14,
            height: 14,
            borderRadius: 999,
            background: stateColor((user as any)?.state),
            border: "2px solid var(--tiko-bg-card)",
          }}
        />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user?.displayName || "Utente"}
        </div>
        <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          @{user?.username || "—"}
        </div>

        <div style={{ marginTop: 6, fontSize: 12, color: "var(--tiko-text-dim)" }}>
          Stato: <strong style={{ color: "var(--tiko-text)" }}>{stateLabel((user as any)?.state)}</strong>
        </div>

        <div style={{ marginTop: 4, fontSize: 12, color: "var(--tiko-text-dim)" }}>
          Mood: <strong style={{ color: "var(--tiko-text)" }}>{(user as any)?.mood || "—"}</strong>
        </div>
      </div>
    </div>
  );

  // MOBILE: topbar + drawer (così non schiaccia la colonna chat)
  if (isMobile) {
    return (
      <>
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            borderBottom: "1px solid #222",
            background: "var(--tiko-bg-gray)",
          }}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            style={{
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              padding: "8px 10px",
              background: "#ff3b30",
              color: "#fff",
              fontWeight: 950,
              cursor: "pointer",
            }}
            aria-label="Apri menu"
            title="Menu"
          >
            ☰
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/icons/clasp-icon-192.png"
              alt="Clasp"
              width={26}
              height={26}
              style={{ borderRadius: 8, display: "block" }}
              onError={(e) => ((e.currentTarget as any).style.display = "none")}
            />
            <div style={{ fontWeight: 950, letterSpacing: 0.2 }}>Clasp</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {pendingRequests > 0 && (
              <div
                style={{
                  minWidth: 22,
                  height: 22,
                  padding: "0 7px",
                  borderRadius: 999,
                  background: "#ff3b30",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 950,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Richieste amicizia"
              >
                {pendingRequests > 99 ? "99+" : pendingRequests}
              </div>
            )}

            {/* Avatar piccolo in topbar */}
            <div style={{ width: 28, height: 28, borderRadius: 999, overflow: "hidden", border: "1px solid #333" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" width={28} height={28} style={{ width: 28, height: 28, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 28, height: 28, background: "#1f1f26", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950, fontSize: 12 }}>
                  {initials(user?.displayName)}
                </div>
              )}
            </div>
          </div>
        </div>

        {drawerOpen && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 20000, background: "rgba(0,0,0,0.55)", display: "flex" }}
            onClick={() => setDrawerOpen(false)}
          >
            <div
              style={{
                width: 340,
                maxWidth: "88vw",
                height: "100%",
                background: "var(--tiko-bg-dark)",
                borderRight: "1px solid #222",
                padding: 12,
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {HeaderBlock}
              {UserBlock}

              <div style={{ marginTop: 12, flex: 1, overflowY: "auto" }}>{Nav}</div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{
                  marginTop: 12,
                  border: "1px solid #444",
                  background: "transparent",
                  borderRadius: 12,
                  padding: "10px 12px",
                  cursor: "pointer",
                  color: "#fff",
                  fontWeight: 900,
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div
            style={{
              position: "fixed",
              left: 12,
              right: 12,
              bottom: 12,
              zIndex: 21000,
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.85)",
              border: "1px solid #333",
              color: "#fff",
              fontSize: 13,
              fontWeight: 950,
            }}
          >
            {toast}
          </div>
        )}
      </>
    );
  }

  // DESKTOP: sidebar classica (con logo + avatar in alto)
  return (
    <div
      style={{
        width: 260,
        padding: 12,
        borderRight: "1px solid #222",
        background: "var(--tiko-bg-dark)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {HeaderBlock}
      {UserBlock}

      <div style={{ marginTop: 12, flex: 1, overflowY: "auto" }}>{Nav}</div>

      {toast && (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(0,0,0,0.85)",
            border: "1px solid #333",
            color: "#fff",
            fontSize: 13,
            fontWeight: 950,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
