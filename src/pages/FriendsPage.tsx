import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

type FriendRequest = {
  id: number;
  senderId: number;
  receiverId: number;
  sender?: UserLite | null;
  receiver?: UserLite | null;
  createdAt?: string;
};

function useIsMobile(breakpointPx: number = 900) {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.innerWidth < breakpointPx : false));
  useEffect(() => {
    const on = () => setM(window.innerWidth < breakpointPx);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [breakpointPx]);
  return m;
}

function normalizeToken(raw: any): string | null {
  if (!raw) return null;
  let t = String(raw).trim();
  t = t.replace(/^"+|"+$/g, "").trim();
  if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  return t.length ? t : null;
}

function getToken(): string | null {
  try {
    return normalizeToken(localStorage.getItem("token") || localStorage.getItem("authToken") || "");
  } catch {
    return null;
  }
}

async function authedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as any),
  };
  if (!headers["Content-Type"] && init.body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status} su ${path}`;
    throw new Error(msg);
  }

  return data as T;
}

async function tryMany<T>(paths: string[], init: RequestInit = {}): Promise<{ data: T; usedPath: string }> {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const data = await authedJson<T>(p, init);
      return { data, usedPath: p };
    } catch (e: any) {
      lastErr = e;
      // se non è 404, spesso non ha senso provare altro
      const msg = String(e?.message || "");
      if (!msg.includes("404") && !msg.toLowerCase().includes("not found")) {
        // continua comunque, ma in generale questo è già un segnale forte
      }
    }
  }
  throw lastErr || new Error("Impossibile caricare dati amici.");
}

function resolveAvatar(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function FriendsPage() {
  const nav = useNavigate();
  const isMobile = useIsMobile(900);

  const [friends, setFriends] = useState<UserLite[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const headerTitle = useMemo(() => "Amici", []);

  async function loadAll() {
    setErr(null);
    setLoading(true);
    try {
      // FRIENDS
      const friendsRes = await tryMany<any>([
        "/friends",
        "/friends/list",
        "/users/friends",
        "/friendships",
      ]);

      const fArr: UserLite[] = Array.isArray(friendsRes.data)
        ? friendsRes.data
        : friendsRes.data?.friends || friendsRes.data?.items || friendsRes.data?.data || [];

      setFriends(Array.isArray(fArr) ? fArr : []);

      // REQUESTS
      const reqRes = await tryMany<any>([
        "/friend-requests",
        "/friendRequests",
        "/friends/requests",
      ]);

      const data = reqRes.data;

      const inArr: FriendRequest[] =
        data?.incoming || data?.received || data?.in || data?.requestsReceived || [];
      const outArr: FriendRequest[] =
        data?.outgoing || data?.sent || data?.out || data?.requestsSent || [];

      // alcuni backend ritornano { requests: [...] } senza separazione:
      const allReqs: FriendRequest[] = data?.requests || data?.items || data?.data || [];

      if (Array.isArray(inArr) || Array.isArray(outArr)) {
        setIncoming(Array.isArray(inArr) ? inArr : []);
        setOutgoing(Array.isArray(outArr) ? outArr : []);
      } else if (Array.isArray(allReqs)) {
        // fallback: separa per receiverId/senderId rispetto al mio id se presente nei token (non lo abbiamo qui)
        setIncoming(allReqs);
        setOutgoing([]);
      } else {
        setIncoming([]);
        setOutgoing([]);
      }
    } catch (e: any) {
      setErr(String(e?.message || "Errore caricamento amici."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function acceptRequest(reqId: number) {
    setErr(null);
    try {
      await tryMany<any>(
        [
          `/friend-requests/${reqId}/accept`,
          "/friend-requests/accept",
          "/friends/requests/accept",
        ],
        {
          method: "POST",
          body: JSON.stringify({ requestId: reqId, id: reqId }),
        }
      );
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.message || "Impossibile accettare la richiesta."));
    }
  }

  async function declineRequest(reqId: number) {
    setErr(null);
    try {
      await tryMany<any>(
        [
          `/friend-requests/${reqId}/decline`,
          `/friend-requests/${reqId}/reject`,
          "/friend-requests/decline",
          "/friend-requests/reject",
        ],
        {
          method: "POST",
          body: JSON.stringify({ requestId: reqId, id: reqId }),
        }
      );
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.message || "Impossibile rifiutare la richiesta."));
    }
  }

  async function openChatWithUser(otherUserId: number) {
    // tenta di creare/ottenere una conversazione diretta e aprirla in HomePage tramite ?cid=
    try {
      const res = await tryMany<any>(
        ["/conversations/direct", "/conversations/with", "/conversations/open-direct"],
        { method: "POST", body: JSON.stringify({ otherUserId, userId: otherUserId }) }
      );

      const convId =
        res.data?.conversation?.id ||
        res.data?.id ||
        res.data?.conversationId ||
        null;

      if (convId) {
        nav(`/?cid=${Number(convId)}`, { replace: false });
        return;
      }
    } catch {
      // ignore, fallback sotto
    }

    // fallback: torna a home e lascia che l’utente apra la chat dalla lista
    nav("/", { replace: false });
  }

  const wrapStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--tiko-bg-dark)",
        overflowY: "auto",
      }
    : {
        minHeight: "100%",
        background: "transparent",
      };

  const cardStyle: React.CSSProperties = {
    background: "var(--tiko-bg-card)",
    border: "1px solid #222",
    borderRadius: 14,
    padding: 12,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 8px",
    borderRadius: 12,
    border: "1px solid #232323",
    background: "rgba(255,255,255,0.02)",
  };

  const pillBtn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 900,
  };

  return (
    <div style={wrapStyle}>
      <div style={{ padding: 14, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => nav("/", { replace: false })}
              style={{ ...pillBtn, fontWeight: 950 }}
              aria-label="Indietro"
              title="Indietro"
            >
              ←
            </button>
            <h2 style={{ margin: 0 }}>{headerTitle}</h2>
          </div>

          <button type="button" onClick={() => loadAll()} style={pillBtn}>
            Ricarica
          </button>
        </div>

        {loading && (
          <div style={{ color: "var(--tiko-text-dim)", fontWeight: 900, padding: 8 }}>
            Caricamento...
          </div>
        )}

        {err && (
          <div style={{ ...cardStyle, borderColor: "#ff6b6b", marginBottom: 12 }}>
            <div style={{ fontWeight: 950, color: "#ff6b6b" }}>Errore caricamento amici</div>
            <div style={{ color: "var(--tiko-text-dim)", marginTop: 6, whiteSpace: "pre-wrap" }}>{err}</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {/* RICHIESTE IN ARRIVO */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Richieste in arrivo</div>
            {incoming.length === 0 ? (
              <div style={{ color: "var(--tiko-text-dim)" }}>Nessuna richiesta.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {incoming.map((r) => {
                  const u = r.sender || null;
                  return (
                    <div key={r.id} style={rowStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 999,
                            overflow: "hidden",
                            border: "1px solid #2a2a2a",
                            background: "#111",
                            flex: "0 0 auto",
                          }}
                        >
                          {resolveAvatar(u?.avatarUrl) ? (
                            <img
                              src={resolveAvatar(u?.avatarUrl)!}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : null}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {u?.displayName || u?.username || `Utente ${r.senderId}`}
                          </div>
                          <div style={{ color: "var(--tiko-text-dim)", fontSize: 12 }}>
                            {u?.city || u?.area ? `${u?.city || ""} ${u?.area ? `(${u.area})` : ""}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                        <button type="button" onClick={() => acceptRequest(r.id)} style={{ ...pillBtn, background: "var(--tiko-mint)", color: "#000" }}>
                          Accetta
                        </button>
                        <button type="button" onClick={() => declineRequest(r.id)} style={{ ...pillBtn, borderColor: "#ff6b6b", color: "#ff6b6b" }}>
                          Rifiuta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AMICI */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>I tuoi amici</div>
            {friends.length === 0 ? (
              <div style={{ color: "var(--tiko-text-dim)" }}>Nessun amico ancora.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {friends.map((f) => (
                  <div key={f.id} style={rowStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 999,
                          overflow: "hidden",
                          border: "1px solid #2a2a2a",
                          background: "#111",
                          flex: "0 0 auto",
                        }}
                      >
                        {resolveAvatar(f.avatarUrl) ? (
                          <img src={resolveAvatar(f.avatarUrl)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : null}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {f.displayName || f.username || `Utente ${f.id}`}
                        </div>
                        <div style={{ color: "var(--tiko-text-dim)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {f.mood ? `Mood: ${f.mood}` : ""}
                          {(f.city || f.area) ? ` • ${f.city || ""}${f.area ? ` (${f.area})` : ""}` : ""}
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={() => openChatWithUser(f.id)} style={{ ...pillBtn, background: "var(--tiko-purple)" }}>
                      Chat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RICHIESTE INVIATE */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Richieste inviate</div>
            {outgoing.length === 0 ? (
              <div style={{ color: "var(--tiko-text-dim)" }}>Nessuna richiesta inviata.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {outgoing.map((r) => {
                  const u = r.receiver || null;
                  return (
                    <div key={r.id} style={rowStyle}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {u?.displayName || u?.username || `Utente ${r.receiverId}`}
                        </div>
                        <div style={{ color: "var(--tiko-text-dim)", fontSize: 12 }}>In attesa…</div>
                      </div>
                      <button type="button" onClick={() => declineRequest(r.id)} style={{ ...pillBtn, borderColor: "#ff6b6b", color: "#ff6b6b" }}>
                        Annulla
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* INFO endpoint */}
          <div style={{ color: "var(--tiko-text-dim)", fontSize: 12, padding: "0 2px" }}>
            Debug rapido: questa pagina chiama <code>{API_BASE_URL}</code>. Se “Errore caricamento amici” persiste, ora vedrai il messaggio reale (401/404/500) nel riquadro rosso.
          </div>
        </div>
      </div>
    </div>
  );
}
