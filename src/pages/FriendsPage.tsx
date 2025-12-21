import React, { useEffect, useState } from "react";
import { fetchFriends, fetchFriendRequestsReceived, acceptFriendRequest, declineFriendRequest } from "../api";
import { useAuth } from "../AuthContext";

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const [f, r] = await Promise.all([
          fetchFriends(),
          fetchFriendRequestsReceived(),
        ]);
        setFriends(f);
        setRequests(r);
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Errore caricamento amici");
      }
    })();
  }, [user?.id]);

  return (
    <div style={{ padding: 14 }}>
      <h2>Amici</h2>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #3a1f1f",
            background: "rgba(255,59,48,0.08)",
            color: "#ff6b6b",
            fontWeight: 850,
          }}
        >
          {error}
        </div>
      )}

      {requests.length > 0 && (
        <>
          <h3>Richieste di amicizia</h3>
          {requests.map((r: any) => (
            <div key={r.id} style={{ marginBottom: 8 }}>
              <strong>{r.sender?.displayName || r.sender?.username}</strong>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => acceptFriendRequest(r.id)}>Accetta</button>
                <button onClick={() => declineFriendRequest(r.id)}>Rifiuta</button>
              </div>
            </div>
          ))}
        </>
      )}

      <h3>I tuoi amici</h3>
      {friends.length === 0 && <div>Nessun amico</div>}
      {friends.map((f: any) => (
        <div key={f.id} style={{ marginBottom: 6 }}>
          {f.displayName || f.username}
        </div>
      ))}
    </div>
  );
}
