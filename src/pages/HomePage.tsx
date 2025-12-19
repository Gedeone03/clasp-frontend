import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import ConversationList from "../components/ui/ConversationList";
import ChatWindow from "../components/ui/ChatWindow";

import {
  Conversation,
  Message,
  User,
  fetchConversations,
  fetchMessages,
  createConversation,
  deleteConversation,
  sendFriendRequest,
  fetchFriends,
  fetchFriendRequestsSent,
} from "../api";

import { useAuth } from "../AuthContext";
import { useChatSocket } from "../hooks/useChatSocket";
import { API_BASE_URL } from "../config";
import { playNotificationBeep, unlockAudio } from "../utils/notifySound";

type MessageLike = Message & {
  createdAt?: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: number | null;
  replyTo?: any | null;
  sender?: any | null;
};

function useIsMobile(breakpointPx = 1100) {
  const compute = () => {
    const coarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    return coarse || window.innerWidth < breakpointPx;
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

function toTimeMs(v: any): number {
  if (!v) return 0;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

function upsertMessage(list: MessageLike[], msg: MessageLike): MessageLike[] {
  const idx = list.findIndex((m) => m.id === msg.id);
  let next: MessageLike[];
  if (idx >= 0) {
    next = [...list];
    next[idx] = { ...next[idx], ...msg };
  } else {
    next = [...list, msg];
  }
  next.sort((a, b) => toTimeMs((a as any).createdAt) - toTimeMs((b as any).createdAt));
  return next;
}

/**
 * ✅ QUI: stati e mood “ufficiali” (come Profilo)
 */
const STATE_OPTIONS = [
  { value: "", label: "Qualsiasi stato" },
  { value: "DISPONIBILE", label: "Disponibile" },
  { value: "OCCUPATO", label: "Occupato" },
  { value: "ASSENTE", label: "Assente" },
  { value: "OFFLINE", label: "Offline" },
  { value: "INVISIBILE", label: "Invisibile" },
  { value: "VISIBILE_A_TUTTI", label: "Visibile a tutti" },
] as const;

const MOOD_OPTIONS = [
  { value: "", label: "Qualsiasi mood" },
  { value: "FELICE", label: "Felice" },
  { value: "TRISTE", label: "Triste" },
  { value: "RILASSATO", label: "Rilassato" },
  { value: "ANSIOSO", label: "Ansioso" },
  { value: "ENTUSIASTA", label: "Entusiasta" },
  { value: "ARRABBIATO", label: "Arrabbiato" },
  { value: "SOLO", label: "Solo" },
] as const;

const STATE_COLOR: Record<string, string> = {
  DISPONIBILE: "#2ecc71",
  OCCUPATO: "#ff3b30",
  ASSENTE: "#f39c12",
  OFFLINE: "#95a5a6",
  INVISIBILE: "#9b59b6",
  VISIBILE_A_TUTTI: "#3ABEFF",

  // compatibilità
  ONLINE: "#2ecc71",
  AWAY: "#f39c12",
};

function stateColor(state?: string | null) {
  if (!state) return "#666";
  return STATE_COLOR[state] ?? "#666";
}

function resolveAvatar(url?: string | null) {
  if (!url) return "";
  const t = url.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return `${API_BASE_URL.replace(/\/+$/, "")}${t}`;
  return t;
}

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile(1100);

  const baseUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ""), []);
  const token = useMemo(() => localStorage.getItem("token") || "", []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageLike[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  const [mobileScreen, setMobileScreen] = useState<"list" | "chat">("list");
  const [mobileTab, setMobileTab] = useState<"chats" | "search">("chats");
  const [mobileChatsDrawerOpen, setMobileChatsDrawerOpen] = useState(false);

  // Filtri ricerca
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");

  const [stateFilter, setStateFilter] = useState("");
  const [mood, setMood] = useState("");

  const [visibleOnly, setVisibleOnly] = useState(false);

  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Friends
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<number>>(new Set());
  const [friendRequestMsg, setFriendRequestMsg] = useState<string | null>(null);

  // Notifiche
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + (b || 0), 0),
    [unreadCounts]
  );

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [soundLocked, setSoundLocked] = useState(false);
  const lastBeepRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    const base = "Clasp";
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;
  }, [totalUnread]);

  useEffect(() => {
    unlockAudio().then((ok) => setSoundLocked(!ok));
  }, []);

  async function loadConversations() {
    try {
      const list = await fetchConversations();
      setConversations(list);

      if (!isMobile && !selectedConversation && list.length > 0) {
        selectConversation(list[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadMessages(convId: number) {
    try {
      const msgs = await fetchMessages(convId);
      setMessages(msgs as any);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadRelationships() {
    try {
      const [friends, sent] = await Promise.all([fetchFriends(), fetchFriendRequestsSent()]);
      setFriendIds(new Set(friends.map((f) => f.id)));

      const receiverIds = sent
        .map((r) => r.receiver?.id)
        .filter((id): id is number => typeof id === "number");
      setSentRequestUserIds(new Set(receiverIds));
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadConversations();
    loadRelationships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }));
  };

  const socket = useChatSocket(user ? user.id : null, {
    onMessage: async ({ conversationId, message }) => {
      const convId = Number(conversationId);
      loadConversations();

      const isMine = message?.senderId && user?.id ? message.senderId === user.id : false;

      if (selectedConversation?.id === convId) {
        setMessages((prev) => upsertMessage(prev, message));
        setUnreadCounts((prev) => ({ ...prev, [convId]: 0 }));
      } else {
        setUnreadCounts((prev) => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));
        const name = message?.sender?.displayName || "Qualcuno";
        showToast(`Nuovo messaggio da ${name}`);
      }

      if (!isMine) {
        const now = Date.now();
        if (now - lastBeepRef.current > 900) {
          lastBeepRef.current = now;
          const ok = await playNotificationBeep();
          setSoundLocked(!ok);
        }
      }
    },

    onTyping: ({ conversationId, userId }) => {
      if (Number(conversationId) !== selectedConversation?.id) return;
      setTypingUserId(userId);
      setTimeout(() => setTypingUserId(null), 1500);
    },
  });

  useEffect(() => {
    if (!selectedConversation) return;
    socket.joinConversation(selectedConversation.id);
    loadMessages(selectedConversation.id);

    if (isMobile) setMobileScreen("chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  const handleSend = (content: string) => {
    if (!selectedConversation) return;
    socket.sendMessage(selectedConversation.id, content, null);
  };

  const handleSendWithReply = (content: string, replyToId: number | null) => {
    if (!selectedConversation) return;
    socket.sendMessage(selectedConversation.id, content, replyToId ?? null);
  };

  const handleTyping = () => {
    if (!selectedConversation) return;
    socket.sendTyping(selectedConversation.id);
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    const ok = window.confirm("Vuoi eliminare questa conversazione?");
    if (!ok) return;

    try {
      await deleteConversation(selectedConversation.id);
      await loadConversations();
      setSelectedConversation(null);
      setMessages([]);
      if (isMobile) setMobileScreen("list");
    } catch (e) {
      console.error(e);
      alert("Errore eliminazione conversazione");
    }
  };

  async function runSearch() {
    setSearchLoading(true);
    setSearchError(null);
    setFriendRequestMsg(null);
    setSearchResults([]);

    const qTrim = q.trim();
    const cityTrim = city.trim();
    const areaTrim = area.trim();

    const hasAnyFilter = !!qTrim || !!cityTrim || !!areaTrim || !!stateFilter || !!mood || visibleOnly;
    if (!hasAnyFilter) {
      setSearchLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (qTrim) params.set("q", qTrim);
      if (cityTrim) params.set("city", cityTrim);
      if (areaTrim) params.set("area", areaTrim);

      // Mood/State li passiamo (se backend li supporta)
      if (mood) params.set("mood", mood);
      if (stateFilter) params.set("state", stateFilter);

      // visibile a tutti
      if (visibleOnly) params.set("visibleOnly", "true");

      const r = await fetch(`${baseUrl}/users?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!r.ok) {
        let msg = "Errore ricerca";
        try {
          const data = await r.json();
          if (data?.error) msg = data.error;
        } catch {}
        throw new Error(msg);
      }

      let users: any[] = await r.json();
      users = users.filter((u) => u.id !== user?.id);

      // filtro lato client (sicuro anche se backend non filtra)
      if (visibleOnly) users = users.filter((u) => u.state === "VISIBILE_A_TUTTI");
      if (stateFilter && stateFilter !== "VISIBILE_A_TUTTI") users = users.filter((u) => u.state === stateFilter);
      if (mood) users = users.filter((u) => u.mood === mood);

      setSearchResults(users);
      if (users.length === 0) setSearchError("Nessun utente trovato");
    } catch (e: any) {
      console.error(e);
      setSearchError(e?.message || "Errore ricerca");
    } finally {
      setSearchLoading(false);
    }
  }

  const startChatWithUser = async (u: User) => {
    try {
      const conv = await createConversation((u as any).id);
      await loadConversations();
      selectConversation(conv);

      if (isMobile) {
        setMobileTab("chats");
        setMobileScreen("chat");
      }
    } catch (e) {
      console.error(e);
      alert("Errore creazione chat");
    }
  };

  const handleSendFriendRequest = async (u: any) => {
    try {
      setFriendRequestMsg(null);

      if (friendIds.has(u.id)) {
        setFriendRequestMsg(`Sei già amico di @${u.username}`);
        return;
      }
      if (sentRequestUserIds.has(u.id)) {
        setFriendRequestMsg(`Hai già inviato una richiesta a @${u.username}`);
        return;
      }

      await sendFriendRequest(u.id);
      setSentRequestUserIds((prev) => new Set([...prev, u.id]));
      setFriendRequestMsg(`Richiesta inviata a @${u.username}`);
    } catch (e: any) {
      console.error(e);
      setFriendRequestMsg(e?.response?.data?.error || "Errore richiesta amicizia");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "var(--tiko-bg-card)",
    color: "var(--tiko-text)",
    outline: "none",
  };

  const SearchPanel = (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 950, marginBottom: 2 }}>Ricerca persone</div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input style={inputStyle} placeholder="Nome o username" value={q} onChange={(e) => setQ(e.target.value)} />
          <input style={inputStyle} placeholder="Città" value={city} onChange={(e) => setCity(e.target.value)} />
          <input style={inputStyle} placeholder="Zona / Area" value={area} onChange={(e) => setArea(e.target.value)} />

          {/* Stato: identico al Profilo */}
          <select
            style={inputStyle as any}
            value={stateFilter}
            onChange={(e) => {
              const v = e.target.value;
              setStateFilter(v);

              // se seleziona visibile a tutti, attiva anche checkbox
              if (v === "VISIBILE_A_TUTTI") setVisibleOnly(true);
              else if (visibleOnly) setVisibleOnly(false);
            }}
          >
            {STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Mood: identico al Profilo */}
          <select style={inputStyle as any} value={mood} onChange={(e) => setMood(e.target.value)}>
            {MOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--tiko-text-dim)", padding: "4px 2px" }}>
            <input
              type="checkbox"
              checked={visibleOnly}
              onChange={(e) => {
                const v = e.target.checked;
                setVisibleOnly(v);
                if (v) setStateFilter("VISIBILE_A_TUTTI");
                else if (stateFilter === "VISIBILE_A_TUTTI") setStateFilter("");
              }}
            />
            Solo utenti “Visibile a tutti”
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={runSearch}
              disabled={searchLoading}
              style={{
                flex: 1,
                borderRadius: 12,
                padding: "10px 12px",
                border: "1px solid #2a2a2a",
                background: "var(--tiko-purple)",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              {searchLoading ? "Ricerca..." : "Cerca"}
            </button>

            <button
              type="button"
              onClick={() => {
                setQ("");
                setCity("");
                setArea("");
                setStateFilter("");
                setMood("");
                setVisibleOnly(false);
                setSearchResults([]);
                setSearchError(null);
                setFriendRequestMsg(null);
              }}
              style={{
                borderRadius: 12,
                padding: "10px 12px",
                border: "1px solid #2a2a2a",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </form>

        {soundLocked && (
          <button
            type="button"
            onClick={async () => {
              const ok = await unlockAudio();
              setSoundLocked(!ok);
              if (ok) await playNotificationBeep();
            }}
            style={{
              borderRadius: 12,
              padding: "10px 12px",
              border: "1px solid #2a2a2a",
              background: "transparent",
              fontSize: 12,
              color: "var(--tiko-text-dim)",
              cursor: "pointer",
            }}
          >
            Attiva suono notifiche
          </button>
        )}

        {searchError && <div style={{ color: "red", fontSize: 13 }}>{searchError}</div>}
        {friendRequestMsg && <div style={{ color: "var(--tiko-text-dim)", fontSize: 13 }}>{friendRequestMsg}</div>}

        {searchResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {searchResults.map((u: any) => {
              const isFriend = friendIds.has(u.id);
              const isPendingSent = sentRequestUserIds.has(u.id);

              const avatar = resolveAvatar(u.avatarUrl);
              const st = u.state || "";
              const md = u.mood || "";

              return (
                <div
                  key={u.id}
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    background: "var(--tiko-bg-card)",
                    border: "1px solid #2a2a2a",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                    {avatar ? (
                      <img src={avatar} alt="avatar" width={40} height={40} style={{ width: 40, height: 40, borderRadius: 999, objectFit: "cover", border: "1px solid #333" }} />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          background: "#1f1f26",
                          border: "1px solid #333",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 950,
                        }}
                      >
                        {(u.displayName || u.username || "U").slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    <div
                      title={st}
                      style={{
                        position: "absolute",
                        right: -1,
                        bottom: -1,
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: stateColor(st),
                        border: "2px solid var(--tiko-bg-card)",
                      }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>
                      <strong>{u.displayName}</strong> <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span>
                    </div>

                    {(u.city || u.area) && (
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                        {[u.city, u.area].filter(Boolean).join(" • ")}
                      </div>
                    )}

                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                      Mood: <strong style={{ color: "var(--tiko-text)" }}>{md || "—"}</strong>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => startChatWithUser(u)} style={{ fontSize: 12, cursor: "pointer" }}>
                        Apri chat
                      </button>

                      <button
                        type="button"
                        disabled={isFriend || isPendingSent}
                        onClick={() => handleSendFriendRequest(u)}
                        style={{
                          fontSize: 12,
                          background: isFriend || isPendingSent ? "#444" : "var(--tiko-mint)",
                          color: isFriend || isPendingSent ? "#bbb" : "#000",
                          cursor: isFriend || isPendingSent ? "not-allowed" : "pointer",
                        }}
                      >
                        {isFriend ? "Già amici" : isPendingSent ? "Richiesta inviata" : "Aggiungi amico"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            background: "rgba(0,0,0,0.85)",
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

  const MobileChatsDrawer =
    mobileChatsDrawerOpen ? (
      <div style={{ position: "fixed", inset: 0, zIndex: 12000, background: "rgba(0,0,0,0.55)", display: "flex" }} onClick={() => setMobileChatsDrawerOpen(false)}>
        <div
          style={{
            width: 320,
            maxWidth: "90vw",
            height: "100%",
            background: "var(--tiko-bg-dark)",
            borderRight: "1px solid #222",
            boxShadow: "0 0 24px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: 12, borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--tiko-bg-gray)" }}>
            <strong>Chat</strong>
            <button type="button" onClick={() => setMobileChatsDrawerOpen(false)} style={{ border: "1px solid #444", background: "transparent", borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: "#fff" }}>
              Chiudi
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation?.id ?? null}
              onSelect={(conv) => {
                selectConversation(conv);
                setMobileChatsDrawerOpen(false);
              }}
              unreadCounts={unreadCounts}
            />
          </div>
        </div>
      </div>
    ) : null;

  if (!user) return <div>Non autenticato</div>;

  if (isMobile) {
    // MOBILE = niente colonne: così non si schiaccia mai la chat
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--tiko-bg-dark)" }}>
        <Sidebar />

        {mobileScreen === "list" ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 8, padding: 10, borderBottom: "1px solid #222", background: "var(--tiko-bg-gray)" }}>
              <button type="button" onClick={() => setMobileTab("chats")} style={{ flex: 1, background: mobileTab === "chats" ? "var(--tiko-purple)" : "var(--tiko-bg-card)" }}>
                Chat {totalUnread > 0 ? `(${totalUnread})` : ""}
              </button>
              <button type="button" onClick={() => setMobileTab("search")} style={{ flex: 1, background: mobileTab === "search" ? "var(--tiko-purple)" : "var(--tiko-bg-card)" }}>
                Cerca
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              {mobileTab === "search" ? (
                SearchPanel
              ) : (
                <ConversationList
                  conversations={conversations}
                  selectedConversationId={selectedConversation?.id ?? null}
                  onSelect={(conv) => selectConversation(conv)}
                  unreadCounts={unreadCounts}
                />
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}>
            {MobileChatsDrawer}
            <ChatWindow
              conversation={selectedConversation}
              messages={messages}
              currentUser={user}
              typingUserId={typingUserId}
              onSend={handleSend}
              onSendWithReply={handleSendWithReply}
              onTyping={handleTyping}
              onDeleteConversation={handleDeleteConversation}
              onOpenChats={() => setMobileChatsDrawerOpen(true)}
              onBack={() => {
                setMobileTab("chats");
                setMobileScreen("list");
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // WEB
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--tiko-bg-dark)" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
        <div
          style={{
            width: "clamp(320px, 34vw, 420px)",
            borderRight: "1px solid #222",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            background: "var(--tiko-bg-gray)",
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{SearchPanel}</div>

          <div style={{ height: 1, background: "#222" }} />

          <div style={{ flex: 1, minHeight: 0 }}>
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation?.id ?? null}
              onSelect={(conv) => selectConversation(conv)}
              unreadCounts={unreadCounts}
            />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            currentUser={user}
            typingUserId={typingUserId}
            onSend={handleSend}
            onSendWithReply={handleSendWithReply}
            onTyping={handleTyping}
            onDeleteConversation={handleDeleteConversation}
          />
        </div>
      </div>
    </div>
  );
}
