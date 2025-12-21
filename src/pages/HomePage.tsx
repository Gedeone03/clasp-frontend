import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import ConversationList from "../components/ui/ConversationList";
import ChatWindow from "../components/ui/ChatWindow";
import { useAuth } from "../AuthContext";
import {
  fetchConversations,
  fetchMessages,
  searchUsers,
  sendFriendRequest,
} from "../api";
import { playNotificationBeep } from "../utils/notifySound";

function useIsMobile(breakpointPx: number = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isMobile;
}

function isSoundEnabled(): boolean {
  const v = localStorage.getItem("clasp.soundEnabled");
  return v !== "false"; // default ON
}

function convKey(conv: any): string {
  const last =
    conv?.lastMessage?.id ??
    conv?.lastMessage?.createdAt ??
    conv?.messages?.[0]?.id ??
    conv?.messages?.[0]?.createdAt ??
    conv?.updatedAt ??
    conv?.createdAt ??
    "";
  return last ? String(last) : "";
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

  // ===== Chats =====
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  // ===== Unread + toast =====
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const keysRef = useRef<Record<number, string>>({});
  const firstPollRef = useRef(true);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + (b || 0), 0),
    [unreadCounts]
  );

  useEffect(() => {
    const base = "Clasp";
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;
  }, [totalUnread]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  };

  // ===== Mobile tabs =====
  const [mobileTab, setMobileTab] = useState<"chats" | "search" | "chat">("chats");

  // ===== Search (IN HOME) =====
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

  // ===== UI styles =====
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

  // ===== Load conversations (initial) =====
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const list = await fetchConversations();
        setConversations(list);

        const init: Record<number, string> = {};
        for (const c of list as any) init[c.id] = convKey(c);
        keysRef.current = init;

        if (!selectedConversation && list.length > 0) setSelectedConversation(list[0]);
      } catch {
        // silent
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ===== Load messages on selection =====
  useEffect(() => {
    if (!selectedConversation) return;
    (async () => {
      try {
        const list = await fetchMessages(selectedConversation.id);
        setMessages(list as any);
        setUnreadCounts((p) => ({ ...p, [selectedConversation.id]: 0 }));
      } catch {
        // silent
      }
    })();
  }, [selectedConversation?.id]);

  // ===== Poll conversations (notify on closed chats) =====
  useEffect(() => {
    if (!user) return;

    let alive = true;

    const tick = async () => {
      try {
        const list = await fetchConversations();
        if (!alive) return;

        setConversations(list);

        const prevKeys = keysRef.current;
        const nextKeys: Record<number, string> = { ...prevKeys };

        if (firstPollRef.current) {
          for (const c of list as any) nextKeys[c.id] = convKey(c);
          keysRef.current = nextKeys;
          firstPollRef.current = false;
          return;
        }

        for (const c of list as any) {
          const id = Number(c.id);
          const nk = convKey(c);
          const pk = prevKeys[id];

          const chatOpen = selectedConversation?.id === id;

          if (pk && nk && nk !== pk && !chatOpen) {
            setUnreadCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
            showToast("Nuovo messaggio ricevuto");

            if (isSoundEnabled()) {
              try {
                await playNotificationBeep();
              } catch {}
            }
          }

          nextKeys[id] = nk;
        }

        keysRef.current = nextKeys;
      } catch {
        // silent
      }
    };

    tick();
    const timer = window.setInterval(tick, 10000);

    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id, selectedConversation?.id]);

  // ===== “Live feel” in open chat: poll messages every 2s (ONLY when open) =====
  useEffect(() => {
    if (!user) return;
    if (!selectedConversation?.id) return;

    // su mobile, poll 2s solo quando sei davvero nella view chat
    if (isMobile && mobileTab !== "chat") return;

    let alive = true;
    const convId = Number(selectedConversation.id);

    const tick = async () => {
      try {
        const list = await fetchMessages(convId);
        if (!alive) return;
        setMessages(list as any);
        setUnreadCounts((p) => ({ ...p, [convId]: 0 }));
      } catch {
        // silent
      }
    };

    tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [user?.id, selectedConversation?.id, isMobile, mobileTab]);

  // ===== Search handlers =====
  async function doSearch() {
    if (!user) return;
    setSearchErr(null);
    setSearchInfo(null);
    setResults([]);
    setSearching(true);

    try {
      const hasAny =
        q.trim() ||
        city.trim() ||
        area.trim() ||
        mood ||
        state ||
        visibleOnly;

      // consente ricerca “visibile a tutti” anche senza nome
      if (!hasAny) {
        setSearchInfo("Inserisci almeno un filtro (anche solo “Visibile a tutti”).");
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

  const SearchPanel = (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
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
          <button type="button" style={btn} onClick={resetSearch}>Reset</button>
        </div>

        {searchErr && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid #3a1f1f", background: "rgba(255,59,48,0.08)", color: "#ff6b6b", fontWeight: 900 }}>
            {searchErr}
          </div>
        )}
        {searchInfo && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid #2a2a2a", color: "var(--tiko-text)", fontWeight: 900 }}>
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

  // ===== MOBILE: tabs Chat / Cerca, la ricerca è in Home anche su mobile =====
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
              SearchPanel
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
                unreadCounts={unreadCounts}
                onSelect={(c) => {
                  setSelectedConversation(c);
                  setMobileTab("chat");
                }}
              />
            )}
          </div>
        </div>

        {toast && (
          <div
            style={{
              position: "fixed",
              top: 14,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20000,
              padding: "10px 14px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.88)",
              border: "1px solid #333",
              color: "#fff",
              fontSize: 13,
              fontWeight: 950,
            }}
          >
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ===== DESKTOP: 3 colonne (Chat list + Ricerca in Home + Chat window) =====
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--tiko-bg-dark)" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
        {/* Colonna chat */}
        <div style={{ width: "clamp(300px, 28vw, 380px)", borderRight: "1px solid #222", minWidth: 0, background: "var(--tiko-bg-gray)" }}>
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id ?? null}
            unreadCounts={unreadCounts}
            onSelect={(c) => setSelectedConversation(c)}
          />
        </div>

        {/* Colonna ricerca (IN HOME) */}
        <div style={{ width: "clamp(340px, 32vw, 460px)", borderRight: "1px solid #222", minWidth: 0, background: "var(--tiko-bg-dark)", overflowY: "auto" }}>
          {SearchPanel}
        </div>

        {/* Colonna chat */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <ChatWindow
            conversationId={selectedConversation?.id}
            conversation={selectedConversation}
            currentUser={user}
            messages={messages}
          />
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20000,
            padding: "10px 14px",
            borderRadius: 14,
            background: "rgba(0,0,0,0.88)",
            border: "1px solid #333",
            color: "#fff",
            fontSize: 13,
            fontWeight: 950,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
