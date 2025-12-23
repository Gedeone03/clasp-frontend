import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { API_BASE_URL } from "../config";

type UserLite = {
  id: number;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  state?: string | null;
  mood?: string | null;
  city?: string | null;
  area?: string | null;
};

function getToken(): string {
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    ""
  );
}

async function apiGet(path: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<UserLite[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const card: React.CSSProperties = {
    background: "var(--tiko-bg-card)",
    border: "1px solid #222",
    borderRadius: 14,
    padding: 12,
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const data = await apiGet("/friends");
        const arr = Array.isArray(data) ? data : Array.isArray(data?.friends) ? data.friends : [];
        setFriends(arr);
      } catch (e: any) {
        setErr(e?.message || "Errore caricamento amici");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  function openChatWithFriend(friendId: number) {
    // Apriamo Home già filtrata su quell’amico.
    // HomePage seleziona la conversazione (se esiste) e su mobile apre direttamente la pagina chat.
    navigate(`/?uid=${friendId}`);
  }

  if (!user) return <div style={{ padding: 14 }}>Non loggato</div>;

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 18 }}>Amici</div>

      {err && (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #3a1f1f", background: "rgba(255,59,48,0.08)", color: "#ff6b6b", fontWeight: 900 }}>
          {err}
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>{loading ? "Caricamento..." : "Lista amici"}</div>

        {friends.length === 0 && !loading ? (
          <div style={{ color: "var(--tiko-text-dim)" }}>Nessun amico trovato.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {friends.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => openChatWithFriend(Number(f.id))}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid #232323",
                  background: "transparent",
                  color: "var(--tiko-text)",
                }}
                title="Apri chat"
              >
                <div style={{ fontWeight: 950 }}>
                  {f.displayName || f.username || "Utente"}{" "}
                  {f.username ? <span style={{ color: "var(--tiko-text-dim)" }}>@{f.username}</span> : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                  {[f.city, f.area].filter(Boolean).join(" • ")}
                  {f.state ? ` • Stato: ${f.state}` : ""}
                  {f.mood ? ` • Mood: ${f.mood}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
