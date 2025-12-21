import React, { useEffect, useState } from "react";
import {
  fetchFriends,
  fetchFriendRequestsReceived,
  fetchFriendRequestsSent,
  acceptFriendRequest,
  declineFriendRequest,
} from "../api";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

export default function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    if (!user) return;
    setErr(null);
    try {
      const [f, inc, out] = await Promise.all([
        fetchFriends(),
        fetchFriendRequestsReceived(),
        fetchFriendRequestsSent(),
      ]);
      setFriends(Array.isArray(f) ? f : []);
      setIncoming(Array.isArray(inc) ? inc : []);
      setOutgoing(Array.isArray(out) ? out : []);
    } catch (e: any) {
      setErr(e?.message || "Errore caricamento amici");
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const card: React.CSSProperties = {
    background: "var(--tiko-bg-card)",
    border: "1px solid #222",
    borderRadius: 14,
    padding: 12,
  };

  const btn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 900,
    color: "var(--tiko-text)",
  };

  const btnPrimary: React.CSSProperties = {
    ...btn,
    background: "var(--tiko-mint)",
    color: "#000",
    borderColor: "var(--tiko-mint)",
  };

  const btnDanger: React.CSSProperties = {
    ...btn,
    borderColor: "#ff6b6b",
    color: "#ff6b6b",
  };

  const headerBtn: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "var(--tiko-bg-dark)",
    color: "var(--tiko-text)",
    fontWeight: 950,
    cursor: "pointer",
  };

  if (!user) return <div style={{ padding: 14 }}>Non loggato</div>;

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header con freccia indietro */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          style={headerBtn}
          onClick={() => {
            try {
              navigate(-1);
            } catch {
              navigate("/");
            }
          }}
          aria-label="Indietro"
          title="Indietro"
        >
          ←
        </button>
        <h2 style={{ margin: 0 }}>Amici</h2>
      </div>

      {err && (
        <div style={{ ...card, borderColor: "#ff6b6b", color: "#ff6b6b", fontWeight: 900 }}>
          {err}
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Richieste ricevute</div>
        {incoming.length === 0 ? (
          <div style={{ color: "var(--tiko-text-dim)" }}>Nessuna richiesta.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {incoming.map((r: any) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  border: "1px solid #232323",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontWeight: 950 }}>
                  {r.sender?.displayName || r.sender?.username || "Utente"}
                  {r.sender?.username ? <span style={{ color: "var(--tiko-text-dim)" }}> @{r.sender.username}</span> : null}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    style={btnPrimary}
                    onClick={async () => {
                      await acceptFriendRequest(r.id);
                      await loadAll();
                    }}
                  >
                    Accetta
                  </button>
                  <button
                    type="button"
                    style={btnDanger}
                    onClick={async () => {
                      await declineFriendRequest(r.id);
                      await loadAll();
                    }}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Richieste inviate</div>
        {outgoing.length === 0 ? (
          <div style={{ color: "var(--tiko-text-dim)" }}>Nessuna richiesta inviata.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {outgoing.map((r: any) => (
              <div key={r.id} style={{ padding: 10, border: "1px solid #232323", borderRadius: 12 }}>
                <div style={{ fontWeight: 950 }}>
                  {r.receiver?.displayName || r.receiver?.username || "Utente"}
                  {r.receiver?.username ? <span style={{ color: "var(--tiko-text-dim)" }}> @{r.receiver.username}</span> : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>In attesa…</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>I tuoi amici</div>
        {friends.length === 0 ? (
          <div style={{ color: "var(--tiko-text-dim)" }}>Nessun amico.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {friends.map((f: any) => (
              <div key={f.id} style={{ padding: 10, border: "1px solid #232323", borderRadius: 12 }}>
                <div style={{ fontWeight: 950 }}>
                  {f.displayName || f.username}
                  {f.username ? <span style={{ color: "var(--tiko-text-dim)" }}> @{f.username}</span> : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                  {[f.city, f.area].filter(Boolean).join(" • ")}
                  {f.mood ? ` • Mood: ${f.mood}` : ""}
                  {f.state ? ` • Stato: ${f.state}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
