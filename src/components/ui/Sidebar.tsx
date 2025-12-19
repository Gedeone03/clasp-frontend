import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../AuthContext";

function useIsMobile(breakpointPx = 1100) {
  const compute = () => {
    const coarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    return coarse || window.innerWidth < breakpointPx;
  };

  const [isMobile, setIsMobile] = useState(compute);

  useEffect(() => {
    const onResize = () => setIsMobile(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isMobile;
}

function ClaspLogo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
      aria-label="Clasp"
      role="img"
    >
      <circle cx="256" cy="256" r="240" fill="#121218" />
      <path
        d="
          M 344 172
          Q 304 132 244 132
          Q 150 132 150 256
          Q 150 380 244 380
          Q 304 380 344 340
          A 26 26 0 0 0 342 300
          Q 326 284 308 300
          Q 284 324 244 324
          Q 192 324 192 256
          Q 192 188 244 188
          Q 284 188 308 212
          Q 326 228 342 212
          A 26 26 0 0 0 344 172
        "
        fill="#7A29FF"
      />
      <circle cx="344" cy="214" r="26" fill="#3ABEFF" />
    </svg>
  );
}

const STATE_UI: Record<string, { label: string; color: string }> = {
  DISPONIBILE: { label: "Disponibile", color: "#2ecc71" },
  OCCUPATO: { label: "Occupato", color: "#ff3b30" },
  ASSENTE: { label: "Assente", color: "#f39c12" },
  OFFLINE: { label: "Offline", color: "#95a5a6" },
  INVISIBILE: { label: "Invisibile", color: "#9b59b6" },
  VISIBILE_A_TUTTI: { label: "Visibile a tutti", color: "#3ABEFF" },

  // compatibilità eventuale vecchia enum
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
  const isMobile = useIsMobile(1100);
  const { user } = useAuth();
  const location = useLocation();

  const baseUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ""), []);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // friend requests badge + toast
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

  // chiudi drawer quando cambi pagina
  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname + location.search]);

  const avatarUrl = resolveUrlMaybeBackend((user as any)?.avatarUrl);

  const homeTo = isMobile ? "/?view=chats" : "/";
  const chatTo = "/?view=chats";
  const searchTo = "/?view=search";

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

  const HeaderBlock = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 12, overflow: "hidden" }}>
        <ClaspLogo size={34} />
      </div>
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

  const Nav = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      {/* Su mobile “Home” punta direttamente alle chat */}
      <NavLink to={homeTo} style={linkStyle}>
        <span>Home</span>
      </NavLink>

      {/* ✅ Viste dedicate mobile (URL dedicati) */}
      <NavLink to={chatTo} style={linkStyle}>
        <span>Chat</span>
      </NavLink>

      <NavLink to={searchTo} style={linkStyle}>
        <span>Cerca persone</span>
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

  // MOBILE: topbar + drawer
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
            <div style={{ width: 26, height: 26, borderRadius: 10, overflow: "hidden" }}>
              <ClaspLogo size={26} />
            </div>
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
          <div style={{ position: "fixed", inset: 0, zIndex: 20000, background: "rgba(0,0,0,0.55)", display: "flex" }} onClick={() => setDrawerOpen(false)}>
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
              <div style={{ flex: 1, overflowY: "auto" }}>{Nav}</div>

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

  // DESKTOP
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
      <div style={{ flex: 1, overflowY: "auto" }}>{Nav}</div>

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
