import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../AuthContext";

function useIsMobile(breakpointPx = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isMobile;
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
  const isMobile = useIsMobile(900);
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
    if (pendingRequests > prev) {
      showToast("Nuova richiesta di amicizia");
    }
    prevPendingRef.current = pendingRequests;
  }, [pendingRequests]);

  // chiudi drawer quando cambi pagina
  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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

      {/* mini box info utente (ripristina “sezione mood” visiva nel menu) */}
      <div
        style={{
          marginTop: 6,
          padding: 12,
          borderRadius: 14,
          background: "var(--tiko-bg-card)",
          border: "1px solid #222",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>
          {user?.displayName || "Utente"}
        </div>
        <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
          Stato: <strong style={{ color: "var(--tiko-text)" }}>{user?.state || "—"}</strong>
        </div>
        <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 4 }}>
          Mood: <strong style={{ color: "var(--tiko-text)" }}>{(user as any)?.mood || "—"}</strong>
        </div>
        <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 8 }}>
          Modifica stato/mood dal Profilo
        </div>
      </div>
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
              background: "#ff3b30", // rosso evidenza
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
            aria-label="Apri menu"
            title="Menu"
          >
            ☰
          </button>

          <div style={{ fontWeight: 950, letterSpacing: 0.2 }}>Clasp</div>

          <div style={{ width: 44, display: "flex", justifyContent: "flex-end" }}>
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
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Richieste amicizia"
              >
                {pendingRequests > 99 ? "99+" : pendingRequests}
              </div>
            )}
          </div>
        </div>

        {drawerOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 20000,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
            }}
            onClick={() => setDrawerOpen(false)}
          >
            <div
              style={{
                width: 320,
                maxWidth: "85vw",
                height: "100%",
                background: "var(--tiko-bg-dark)",
                borderRight: "1px solid #222",
                padding: 12,
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Clasp</div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    border: "1px solid #444",
                    background: "transparent",
                    borderRadius: 12,
                    padding: "8px 10px",
                    cursor: "pointer",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  Chiudi
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto" }}>{Nav}</div>
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
              fontWeight: 900,
            }}
          >
            {toast}
          </div>
        )}
      </>
    );
  }

  // DESKTOP: sidebar a sinistra
  return (
    <div
      style={{
        width: 240,
        padding: 12,
        borderRight: "1px solid #222",
        background: "var(--tiko-bg-dark)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 6 }}>Clasp</div>

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
            fontWeight: 900,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
