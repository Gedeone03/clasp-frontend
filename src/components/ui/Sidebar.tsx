import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../AuthContext";

function useIsMobile(breakpointPx = 1100) {
  const compute = () => {
    const coarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const uaMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

    return coarse || uaMobile || window.innerWidth < breakpointPx;
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
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
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

// ✅ Fix avatar URL + mixed content
function resolveUrlMaybeBackend(url?: string | null) {
  if (!url) return "";
  let t = url.trim();
  if (!t) return "";

  // se è relativo, aggiungi base backend
  if (t.startsWith("/")) t = `${API_BASE_URL.replace(/\/+$/, "")}${t}`;

  // se siamo su https e arriva http, forza https (browser blocca spesso immagini http)
  if (typeof window !== "undefined" && window.location.protocol === "https:" && t.startsWith("http://")) {
    t = t.replace(/^http:\/\//i, "https://");
  }

  return t;
}

export default function Sidebar() {
  const isMobile = useIsMobile(1100);
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const avatarUrl = resolveUrlMaybeBackend((user as any)?.avatarUrl);

  const baseItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    textDecoration: "none",
    color: "var(--tiko-text)",
    border: "1px solid #222",
    marginBottom: 10,
    fontWeight: 800,
  };

  const activeBg = "var(--tiko-bg-card)";

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
            style={{ width: 44, height: 44, borderRadius: 999, objectFit: "cover", border: "1px solid #333", display: "block" }}
            onError={(e) => ((e.currentTarget as any).style.display = "none")}
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
      </div>
    </div>
  );

  const DesktopNav = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <NavLink to="/" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Home</span>
      </NavLink>

      <NavLink to="/friends" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Amici</span>
      </NavLink>

      <NavLink to="/profile" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Profilo</span>
      </NavLink>

      <NavLink to="/settings" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Impostazioni</span>
      </NavLink>

      <NavLink to="/terms" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Termini</span>
      </NavLink>

      <NavLink to="/privacy" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Privacy</span>
      </NavLink>

      {/* ✅ LOGOUT */}
      <button
        type="button"
        onClick={() => {
          logout();
          nav("/auth", { replace: true });
        }}
        style={{
          ...baseItemStyle,
          background: "transparent",
          cursor: "pointer",
          color: "#ff6b6b",
          borderColor: "#3a1f1f",
          justifyContent: "center",
        }}
      >
        Logout
      </button>
    </div>
  );

  const MobileNav = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <Link to="/?view=chats" style={baseItemStyle}>
        <span>Chat</span>
      </Link>

      <Link to="/?view=search" style={baseItemStyle}>
        <span>Cerca</span>
      </Link>

      <NavLink to="/friends" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Amici</span>
      </NavLink>

      <NavLink to="/profile" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Profilo</span>
      </NavLink>

      <NavLink to="/settings" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Impostazioni</span>
      </NavLink>

      <NavLink to="/terms" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Termini</span>
      </NavLink>

      <NavLink to="/privacy" style={({ isActive }) => ({ ...baseItemStyle, background: isActive ? activeBg : "transparent" })}>
        <span>Privacy</span>
      </NavLink>

      {/* ✅ LOGOUT mobile */}
      <button
        type="button"
        onClick={() => {
          logout();
          nav("/auth", { replace: true });
        }}
        style={{
          ...baseItemStyle,
          background: "transparent",
          cursor: "pointer",
          color: "#ff6b6b",
          borderColor: "#3a1f1f",
          justifyContent: "center",
        }}
      >
        Logout
      </button>
    </div>
  );

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
              <div style={{ flex: 1, overflowY: "auto" }}>{MobileNav}</div>

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
      </>
    );
  }

  return (
    <div style={{ width: 260, padding: 12, borderRight: "1px solid #222", background: "var(--tiko-bg-dark)", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
      {HeaderBlock}
      {UserBlock}
      <div style={{ flex: 1, overflowY: "auto" }}>{DesktopNav}</div>
    </div>
  );
}
