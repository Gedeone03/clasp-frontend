import React, { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { API_BASE_URL } from "../../config";

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
        fontWeight: 800,
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
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const [pendingRequests, setPendingRequests] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const prevPendingRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
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
      // silenzioso: non bloccare UI
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

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: "block",
    padding: "10px 12px",
    borderRadius: 12,
    textDecoration: "none",
    color: "var(--tiko-text)",
    background: isActive ? "var(--tiko-bg-card)" : "transparent",
    border: "1px solid #222",
    marginBottom: 10,
    fontWeight: 800 as const,
  });

  return (
    <div
      style={{
        width: 220,
        padding: 12,
        borderRight: "1px solid #222",
        background: "var(--tiko-bg-dark)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Clasp</div>

      <NavLink to="/" style={linkStyle}>
        Home
      </NavLink>

      <NavLink to="/friends" style={linkStyle}>
        Amici
        <Badge n={pendingRequests} />
      </NavLink>

      <NavLink to="/profile" style={linkStyle}>
        Profilo
      </NavLink>

      <NavLink to="/terms" style={linkStyle}>
        Termini
      </NavLink>

      <NavLink to="/privacy" style={linkStyle}>
        Privacy
      </NavLink>

      {/* Toast globale (richieste amicizia) */}
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
            fontWeight: 800,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
