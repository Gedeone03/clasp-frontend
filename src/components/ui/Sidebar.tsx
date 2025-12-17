// src/components/ui/Sidebar.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { fetchFriendRequestsReceived } from "../../api";
import { useI18n } from "../../LanguageContext";

function useIsMobile(breakpointPx: number = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isMobile;
}

function StatusDot({ state }: { state: string }) {
  const colors: Record<string, string> = {
    DISPONIBILE: "#4CAF50",
    OCCUPATO: "#F44336",
    ASSENTE: "#FF9800",
    OFFLINE: "#9E9E9E",
    INVISIBILE: "#BDBDBD",
    VISIBILE_A_TUTTI: "#2196F3",
  };
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: colors[state] || "#9E9E9E",
        display: "inline-block",
        marginRight: 6,
      }}
    />
  );
}

const SidebarContent: React.FC<{
  receivedCount: number;
  onNavigate?: () => void;
}> = ({ receivedCount, onNavigate }) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const menuItems = [
    { key: "navHome", path: "/" },
    { key: "navFriends", path: "/friends" },
    { key: "navProfile", path: "/profile" },
    { key: "navMood", path: "/mood" },
    { key: "navSettings", path: "/settings" },
  ];

  const tMood = (key?: string | null) => {
    if (!key) return "";
    const translated = t(`mood_${key}`);
    return translated === `mood_${key}` ? key : translated;
  };

  return (
    <div
      style={{
        width: 240,
        background: "var(--tiko-bg-dark)",
        borderRight: "1px solid #222",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <img src="/icons/clasp-icon-192.png" alt="CLASP" style={{ width: 32, height: 32, borderRadius: 8 }} />
        <h1 className="tiko-title" style={{ fontSize: 24, margin: 0 }}>
          {t("appName")}
        </h1>
      </div>

      <div
        style={{
          padding: 12,
          background: "var(--tiko-bg-card)",
          borderRadius: 12,
          boxShadow: "var(--tiko-glow)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt="Avatar"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid var(--tiko-purple)",
            }}
          />
        ) : (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "linear-gradient(140deg, var(--tiko-purple), var(--tiko-blue))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
              color: "white",
              boxShadow: "var(--tiko-glow)",
            }}
          >
            {(user.displayName || user.username)
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}

        <div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <StatusDot state={user.state} />
            <strong>{user.displayName}</strong>
          </div>
          <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>@{user.username}</div>
          {user.mood && (
            <div style={{ fontSize: 11, color: "var(--tiko-text-dim)", marginTop: 2 }}>
              Mood: {tMood(user.mood)}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {menuItems.map((item) => {
          const selected = location.pathname === item.path;
          const isFriends = item.path === "/friends";

          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                onNavigate?.();
              }}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                borderRadius: 10,
                background: selected ? "var(--tiko-purple)" : "var(--tiko-bg-card)",
                color: selected ? "#fff" : "var(--tiko-text)",
                fontWeight: selected ? 700 : 400,
                cursor: "pointer",
                border: "1px solid #333",
                position: "relative",
              }}
            >
              {t(item.key)}
              {isFriends && receivedCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: 10,
                    background: "var(--tiko-magenta)",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {receivedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile(900);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [receivedCount, setReceivedCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const reqs = await fetchFriendRequestsReceived();
        if (mounted) setReceivedCount(reqs.length);
      } catch {}
    };

    load();
    const tmr = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(tmr);
    };
  }, []);

  if (!user) return null;

  if (!isMobile) {
    return <SidebarContent receivedCount={receivedCount} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          left: "calc(env(safe-area-inset-left, 0px) + 10px)",
          zIndex: 9999,
          background: "var(--tiko-purple)",
          color: "#fff",
          border: "1px solid #333",
          borderRadius: 12,
          padding: "10px 12px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "var(--tiko-glow)",
        }}
      >
        Menu
      </button>

      {drawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            style={{
              width: 290,
              maxWidth: "85vw",
              height: "100%",
              background: "var(--tiko-bg-dark)",
              borderRight: "1px solid #222",
              boxShadow: "0 0 24px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", padding: 10, borderBottom: "1px solid #222" }}>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #444",
                  borderRadius: 10,
                  padding: "6px 10px",
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                Close
              </button>
            </div>

            <SidebarContent receivedCount={receivedCount} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
