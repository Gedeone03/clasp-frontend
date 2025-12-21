import React, { useEffect, useMemo, useState } from "react";
import {
  fetchFriends,
  fetchFriendRequestsReceived,
  fetchFriendRequestsSent,
  acceptFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
  searchUsers,
} from "../api";
import { useAuth } from "../AuthContext";

type UserLite = {
  id: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  state?: string | null;
  mood?: string | null;
  city?: string | null;
  area?: string | null;
};

export default function FriendsPage() {
  const { user } = useAuth();

  // Data
  const [friends, setFriends] = useState<UserLite[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);

  // Search
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [mood, setMood] = useState("");
  const [state, setState] = useState("");
  const [visibleOnly, setVisibleOnly] = useState(false);

  const [results, setResults] = useState<UserLite[]>([]);
  const [searching, setSearching] = useState(false);

  // UI
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const myId = user?.id;

  const STATE_OPTIONS = useMemo(
    () => [
      { value: "", label: "Qualsiasi stato" },
      { value: "DISPONIBILE", label: "Disponibile" },
      { value: "OCCUPATO", label: "Occupato" },
      { value: "ASSENTE", label: "Assente" },
      { value: "OFFLINE", label: "Offline" },
      { value: "INVISIBILE", label: "Invisibile" },
      { value: "VISIBILE_A_TUTTI", label: "Visibile a tutti" },
    ],
    []
  );

  const MOOD_OPTIONS = useMemo(
    () => [
      { value: "", label: "Qualsiasi mood" },
      { value: "FELICE", label: "Felice" },
      { value: "TRISTE", label: "Triste" },
      { value: "RILASSATO", label: "Rilassato" },
      { value: "ANSIOSO", label: "Ansioso" },
      { value: "ENTUSIASTA", label: "Entusiasta" },
      { value: "ARRABBIATO", label: "Arrabbiato" },
      { value: "SOLO", label: "Solo" },
    ],
    []
  );

  async function loadAll() {
    if (!myId) return;
    setErr(null);
    setInfo(null);
    setLoading(true);

    try {
      const [f, inc, out] = await Promise.all([
        fetchFriends(),
        fetchFriendRequestsReceived(),
        fetchFriendRequestsSent(),
      ]);

      setFriends(Array.isArray(f) ? (f as any) : []);
      setIncoming(Array.isArray(inc) ? inc : []);
      setOutgoing(Array.isArray(out) ? out : []);
    } catch (e: any) {
      setErr(String(e?.message || "Errore caricamento amici"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  async function doSearch() {
    if (!myId) return;

    setErr(null);
    setInfo(null);
    setSearching(true);
    setResults([]);

    try {
      // se non metti nessun filtro, evitiamo ricerca “vuota”
      const hasAny =
        q.trim() || city.trim() || area.trim() || mood || state || visibleOnly;
      if (!hasAny) {
        setInfo("Inserisci almeno un filtro per cercare utenti.");
        return;
      }

      const list = await searchUsers({
        q: q.trim() || undefined,
        city: city.trim() || undefined,
        area: area.trim() || undefined,
        mood: mood || undefined,
        state: state || undefined,
        visibleOnly: visibleOnly || undefined,
      });

      const filtered = (list || []).filter((u: any) => u?.id !== myId);
      setResults(filtered);

      if (filtered.length === 0) setInfo("Nessun utente trovato.");
    } catch (e: any) {
      setErr(String(e?.message || "Errore ricerca utenti"));
    } finally {
      setSearching(false);
    }
  }

  async function doSendRequest(userId: number) {
    setErr(null);
    setInfo(null);
    try {
      await sendFriendRequest(userId);
      setInfo("Richiesta inviata.");
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.message || "Errore invio richiesta"));
    }
  }

  async function doAccept(reqId: number) {
    setErr(null);
    setInfo(null);
    try {
      await acceptFriendRequest(reqId);
      setInfo("Richiesta accettata.");
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.message || "Errore accettazione richiesta"));
    }
  }

  async function doDecline(reqId: number) {
    setErr(null);
    setInfo(null);
    try {
      await declineFriendRequest(reqId);
      setInfo("Richiesta rifiutata.");
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.message || "Errore rifiuto richiesta"));
    }
  }

  const card: React.CSSProperties = {
    background: "var(--tiko-bg-card)",
    border: "1px solid #222",
    borderRadius: 14,
    padding: 12,
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "var(--tiko-bg-dark)",
    color: "var(--tiko-text)",
    outline: "none",
  };

  const btn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 900,
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

  if (!user) return <div style={{ padding: 14 }}>Non loggato</div>;

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Amici</h2>

      {loading && <div style={{ color: "var(--tiko-text-dim)" }}>Caricamento...</div>}

      {err && (
        <div style={{ ...card, borderColor: "#ff6b6b", color: "#ff6b6b", fontWeight: 900 }}>
          {err}
        </div>
      )}

      {info && (
        <div style={{ ...card, borderColor: "#2a2a2a", color: "var(--tiko-text)", fontWeight: 900 }}>
          {info}
        </div>
      )}

      {/* RICERCA UTENTI - COME PRIMA (con tutti i parametri) */}
      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Ricerca utenti</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome o username" />
          <input style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Città" />
          <input style={input} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Zona / Area" />

          <select style={input as any} value={state} onChange={(e) => setState(e.target.value)}>
            {STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select style={input as any} value={mood} onChange={(e) => setMood(e.target.value)}>
            {MOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, color: "var(--tiko-text-dim)", fontSize: 13 }}>
          <input type="checkbox" checked={visibleOnly} onChange={(e) => setVisibleOnly(e.target.checked)} />
          Solo “Visibile a tutti”
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button type="button" style={btnPrimary} onClick={doSearch} disabled={searching}>
            {searching ? "Ricerca..." : "Cerca"}
          </button>

          <button
            type="button"
            style={btn}
            onClick={() => {
              setQ("");
              setCity("");
              setArea("");
              setMood("");
              setState("");
              setVisibleOnly(false);
              setResults([]);
              setErr(null);
              setInfo(null);
            }}
          >
            Reset
          </button>
        </div>

        {results.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((u: any) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 10, borderRadius: 12, border: "1px solid #232323" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.displayName} <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                    {[u.city, u.area].filter(Boolean).join(" • ")}
                    {u.mood ? ` • Mood: ${u.mood}` : ""}
                    {u.state ? ` • Stato: ${u.state}` : ""}
                  </div>
                </div>

                <button type="button" style={btnPrimary} onClick={() => doSendRequest(u.id)}>
                  Aggiungi
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Richieste ricevute */}
      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Richieste ricevute</div>
        {incoming.length === 0 ? (
          <div style={{ color: "var(--tiko-text-dim)" }}>Nessuna richiesta.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {incoming.map((r: any) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 10, border: "1px solid #232323", borderRadius: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950 }}>
                    {r.sender?.displayName || r.sender?.username || "Utente"}
                    {r.sender?.username ? <span style={{ color: "var(--tiko-text-dim)" }}> @{r.sender.username}</span> : null}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={btnPrimary} onClick={() => doAccept(r.id)}>Accetta</button>
                  <button type="button" style={btnDanger} onClick={() => doDecline(r.id)}>Rifiuta</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Richieste inviate */}
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

      {/* Lista amici */}
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
