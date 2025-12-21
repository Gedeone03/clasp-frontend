import React, { useEffect, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import ConversationList from "../components/ui/ConversationList";
import ChatWindow from "../components/ui/ChatWindow";
import { useAuth } from "../AuthContext";
import { fetchConversations, fetchMessages, searchUsers, sendFriendRequest } from "../api";

function useIsMobile(breakpointPx: number = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isMobile;
}

type UserLite = {
  id: number;
  username?: string;
  displayName?: string;
  city?: string | null;
  area?: string | null;
  mood?: string | null;
  state?: string | null;
  avatarUrl?: string | null;
};

const STATE_OPTIONS = [
  { value: "", label: "Qualsiasi stato" },
  { value: "DISPONIBILE", label: "Disponibile" },
  { value: "OCCUPATO", label: "Occupato" },
  { value: "ASSENTE", label: "Assente" },
  { value: "OFFLINE", label: "Offline" },
  { value: "INVISIBILE", label: "Invisibile" },
  { value: "VISIBILE_A_TUTTI", label: "Visibile a tutti" },
];

const MOOD_OPTIONS = [
  { value: "", label: "Qualsiasi mood" },
  { value: "FELICE", label: "Felice" },
  { value: "TRISTE", label: "Triste" },
  { value: "RILASSATO", label: "Rilassato" },
  { value: "ANSIOSO", label: "Ansioso" },
  { value: "ENTUSIASTA", label: "Entusiasta" },
  { value: "ARRABBIATO", label: "Arrabbiato" },
  { value: "SOLO", label: "Solo" },
];

function stateLabel(v?: string | null) {
  const f = STATE_OPTIONS.find((o) => o.value === v);
  return f ? f.label : v || "";
}
function moodLabel(v?: string | null) {
  const f = MOOD_OPTIONS.find((o) => o.value === v);
  return f ? f.label : v || "";
}

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile(900);

  // ===== Chat =====
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  // ===== Mobile tabs =====
  const [mobileTab, setMobileTab] = useState<"chats" | "search" | "chat">("chats");

  // ===== Ricerca utenti (sopra lista chat) =====
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [mood, setMood] = useState("");
  const [state, setState] = useState("");
  const [visibleOnly, setVisibleOnly] = useState(false);

  const [results, setResults] = useState<UserLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  const [sentRequestIds, setSentRequestIds] = useState<Set<number>>(new Set());

  // ===== UI styles (NON cambiamo grafica/struttura) =====
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
    color: "var(--tiko-text)",
    cursor: "pointer",
    fontWeight: 900,
  };

  const btnPrimary: React.CSSProperties = {
    ...btn,
    background: "var(--tiko-mint)",
    color: "#000",
    borderColor: "var(--tiko-mint)",
  };

  // ===== Load conversations =====
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const list = await fetchConversations();
        setConversations(list);
        if (!selectedConversation && list.length > 0) setSelectedConversation(list[0]);
      } catch {
        // silent
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ===== Load messages when selecting a conversation =====
  useEffect(() => {
    if (!selectedConversation) return;
    (async () => {
      try {
        const list = await fetchMessages(selectedConversation.id);
        setMessages(list as any);
      } catch {
        // silent
      }
    })();
  }, [selectedConversation?.id]);

  // ✅ LIVE MESSAGES (ripristino): ricarica la chat aperta ogni 2 secondi
  // - Non cambia UI
  // - Evita richieste concorrenti
  // - Forza un refresh quando torni sulla tab/app
  useEffect(() => {
    if (!user) return;
    const convId = Number(selectedConversation?.id || 0);
    if (!convId) return;

    // su mobile, facciamolo solo quando sei davvero dentro la chat
    if (isMobile && mobileTab !== "chat") return;

    let alive = true;
    let inFlight = false;

    const tick = async () => {
      if (!alive) return;
      if (inFlight) return;
      inFlight = true;
      try {
        const list = await fetchMessages(convId);
        if (!alive) return;
        setMessages(list as any);
      } catch {
        // silent
      } finally {
        inFlight = false;
      }
    };

    // primo refresh subito, poi ogni 2 secondi
    tick();
    const t = window.setInterval(tick, 2000);

    // quando torni visibile (cambi tab o riapri app), refresh immediato
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id, selectedConversation?.id, isMobile, mobileTab]);

  // ===== Search =====
  async function doSearch() {
    if (!user) return;

    setSearchErr(null);
    setSearchInfo(null);
    setResults([]);
    setSearching(true);

    try {
      const hasAny = q.trim() || city.trim() || area.trim() || mood || state || visibleOnly;

      if (!hasAny) {
        setSearchInfo("Inserisci almeno un filtro (anche solo “Visibile a tutti”).");
        return;
      }

      const params = {
        q: q.trim() || undefined,
        city: city.trim() || undefined,
        area: area.trim() || undefined,
        mood: mood || undefined,
        state: state || undefined,
        visibleOnly: visibleOnly || undefined,
      };

      const list = await (searchUsers as any)(params);
      const filtered = (list || []).filter((u: any) => u?.id !== user.id);
      setResults(filtered);
      if (filtered.length === 0) setSearchInfo("Nessun utente trovato.");
    } catch (e: any) {
      setSearchErr(e?.message || "Errore ricerca utenti");
    } finally {
      setSearching(false);
    }
  }

  async function doSendFriendRequest(userId: number) {
    setSearchErr(null);
    setSearchInfo(null);
    try {
      await sendFriendRequest(userId);
      setSentRequestIds((prev) => new Set(prev).add(userId));
      setSearchInfo("Richiesta inviata.");
    } catch (e: any) {
      setSearchErr(e?.message || "Errore invio richiesta amicizia");
    }
  }

  function resetSearch() {
    setQ("");
    setCity("");
    setArea("");
    setMood("");
    setState("");
    setVisibleOnly(false);
    setResults([]);
    setSearchErr(null);
    setSearchInfo(null);
  }

  const SearchBlock = (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Ricerca utenti</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome o username" />
          <input style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Città" />
          <input style={input} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Zona / Area" />

          <select style={input as any} value={state} onChange={(e) => setState(e.target.value)}>
            {STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select style={input as any} value={mood} onChange={(e) => setMood(e.target.value)}>
            {MOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 10,
            color: "var(--tiko-text-dim)",
            fontSize: 13,
          }}
        >
          <input type="checkbox" checked={visibleOnly} onChange={(e) => setVisibleOnly(e.target.checked)} />
          Solo “Visibile a tutti”
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button type="button" style={btnPrimary} onClick={doSearch} disabled={searching}>
            {searching ? "Ricerca..." : "Cerca"}
          </button>
          <button type="button" style={btn} onClick={resetSearch}>
            Reset
          </button>
        </div>

        {searchErr && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #3a1f1f",
              background: "rgba(255,59,48,0.08)",
              color: "#ff6b6b",
              fontWeight: 900,
            }}
          >
            {searchErr}
          </div>
        )}

        {searchInfo && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              color: "var(--tiko-text)",
              fontWeight: 900,
            }}
          >
            {searchInfo}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Risultati</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((u: any) => {
              const requested = sentRequestIds.has(Number(u.id));
              return (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #232323",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.displayName || u.username || "Utente"}{" "}
                      {u.username ? <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                      {[u.city, u.area].filter(Boolean).join(" • ")}
                      {u.mood ? ` • Mood: ${moodLabel(u.mood)}` : ""}
                      {u.state ? ` • Stato: ${stateLabel(u.state)}` : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    style={requested ? btn : btnPrimary}
                    disabled={requested}
                    onClick={() => doSendFriendRequest(Number(u.id))}
                    title={requested ? "Richiesta già inviata" : "Invia richiesta amicizia"}
                  >
                    {requested ? "Inviata" : "Aggiungi"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (!user) return <div style={{ padding: 14 }}>Non loggato</div>;

  // ===== MOBILE: tab Chat/Cerca (non cambia grafica: è già così) =====
  if (isMobile) {
    return (
      <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--tiko-bg-dark)" }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #222", background: "var(--tiko-bg-card)", display: "flex", gap: 10 }}>
            <button
              type="button"
              style={{ ...btn, flex: 1, background: mobileTab === "chats" ? "rgba(122,41,255,0.18)" : "transparent" }}
              onClick={() => setMobileTab("chats")}
            >
              Chat
            </button>
            <button
              type="button"
              style={{ ...btn, flex: 1, background: mobileTab === "search" ? "rgba(58,190,255,0.12)" : "transparent" }}
              onClick={() => setMobileTab("search")}
            >
              Cerca
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {mobileTab === "search" ? (
              SearchBlock
            ) : mobileTab === "chat" ? (
              <ChatWindow
                conversationId={selectedConversation?.id}
                conversation={selectedConversation}
                currentUser={user}
                messages={messages}
                onBack={() => setMobileTab("chats")}
              />
            ) : (
              <ConversationList
                conversations={conversations}
                selectedConversationId={selectedConversation?.id ?? null}
                onSelect={(c) => {
                  setSelectedConversation(c);
                  setMobileTab("chat");
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== DESKTOP: struttura invariata (colonna sinistra unica + chat a destra) =====
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--tiko-bg-dark)" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
        {/* COLONNA SINISTRA UNICA: Ricerca sopra + Chat list sotto */}
        <div
          style={{
            width: "clamp(360px, 34vw, 520px)",
            borderRight: "1px solid #222",
            minWidth: 0,
            background: "var(--tiko-bg-gray)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* Ricerca sopra */}
          <div style={{ borderBottom: "1px solid #222", background: "var(--tiko-bg-dark)", overflowY: "auto" }}>
            {SearchBlock}
          </div>

          {/* Chat list sotto */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation?.id ?? null}
              onSelect={(c) => setSelectedConversation(c)}
            />
          </div>
        </div>

        {/* COLONNA DESTRA: Chat */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <ChatWindow
            conversationId={selectedConversation?.id}
            conversation={selectedConversation}
            currentUser={user}
            messages={messages}
          />
        </div>
      </div>
    </div>
  );
}
