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

function useIsMobile(breakpointPx = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
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

const MOOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Qualsiasi mood" },
  { value: "FELICE", label: "Felice" },
  { value: "TRISTE", label: "Triste" },
  { value: "RILASSATO", label: "Rilassato" },
  { value: "ANSIOSO", label: "Ansioso" },
  { value: "ENTUSIASTA", label: "Entusiasta" },
  { value: "ARRABBIATO", label: "Arrabbiato" },
  { value: "SOLO", label: "Solo" },
];

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile(900);

  const baseUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ""), []);
  const token = useMemo(() => localStorage.getItem("token") || "", []);

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageLike[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  // Mobile navigation (ripristina comportamento “come prima”)
  const [mobileScreen, setMobileScreen] = useState<"list" | "chat">("list");
  const [mobileTab, setMobileTab] = useState<"chats" | "search">("chats");
  const [mobileChatsDrawerOpen, setMobileChatsDrawerOpen] = useState(false);

  // Search filters (IT + Mood ripristinato)
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [mood, setMood] = useState("");

  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Friends state for buttons
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<number>>(new Set());
  const [friendRequestMsg, setFriendRequestMsg] = useState<string | null>(null);

  // 🔔 Notifications: unread + toast + title + sound (manteniamo tutto)
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

      // su desktop auto-seleziona (ripristina UX)
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

      // aggiorna lista chat (ultima msg)
      loadConversations();

      const isMine = message?.senderId && user?.id ? message.senderId === user.id : false;

      // se la chat è aperta, append e segna letta
      if (selectedConversation?.id === convId) {
        setMessages((prev) => upsertMessage(prev, message));
        setUnreadCounts((prev) => ({ ...prev, [convId]: 0 }));
      } else {
        // increment unread + toast
        setUnreadCounts((prev) => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));
        const name = message?.sender?.displayName || "Qualcuno";
        showToast(`Nuovo messaggio da ${name}`);
      }

      // suono solo per incoming non miei
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

    // evita query “vuota totale” (ma consenti visibileOnly/mood/città/zona)
    const hasAnyFilter = !!qTrim || !!cityTrim || !!areaTrim || visibleOnly || !!mood;
    if (!hasAnyFilter) {
      setSearchLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (qTrim) params.set("q", qTrim);
      if (cityTrim) params.set("city", cityTrim);
      if (areaTrim) params.set("area", areaTrim);
      if (visibleOnly) params.set("visibleOnly", "true");
      if (mood) params.set("mood", mood);

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

      const users: User[] = await r.json();
      const filtered = users.filter((u) => u.id !== user?.id);
      setSearchResults(filtered);
      if (filtered.length === 0) setSearchError("Nessun utente trovato");
    } catch (e: any) {
      console.error(e);
      setSearchError(e?.message || "Errore ricerca");
    } finally {
      setSearchLoading(false);
    }
  }

  const startChatWithUser = async (u: User) => {
    try {
      const conv = await createConversation(u.id);
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

  const handleSendFriendRequest = async (u: User) => {
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
        <div style={{ fontWeight: 900, marginBottom: 2 }}>Ricerca persone</div>

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

          {/* ✅ MOOD ripristinato */}
          <select style={inputStyle as any} value={mood} onChange={(e) => setMood(e.target.value)}>
            {MOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--tiko-text-dim)", padding: "4px 2px" }}>
            <input type="checkbox" checked={visibleOnly} onChange={(e) => setVisibleOnly(e.target.checked)} />
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
                fontWeight: 900,
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
                setVisibleOnly(false);
                setMood("");
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
            {searchResults.map((u) => {
              const isFriend = friendIds.has(u.id);
              const isPendingSent = sentRequestUserIds.has(u.id);

              return (
                <div
                  key={u.id}
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    background: "var(--tiko-bg-card)",
                    border: "1px solid #2a2a2a",
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <strong>{u.displayName}</strong> <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span>
                  </div>

                  {(u.city || u.area) && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                      {[u.city, u.area].filter(Boolean).join(" • ")}
                    </div>
                  )}

                  {(u as any)?.mood && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                      Mood: <strong style={{ color: "var(--tiko-text)" }}>{(u as any).mood}</strong>
                    </div>
                  )}

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
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ Toast messaggi (notifiche mantenute) */}
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
            fontWeight: 900,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );

  // Drawer chat list (mobile)
  const MobileChatsDrawer =
    mobileChatsDrawerOpen ? (
      <div
        style={{ position: "fixed", inset: 0, zIndex: 12000, background: "rgba(0,0,0,0.55)", display: "flex" }}
        onClick={() => setMobileChatsDrawerOpen(false)}
      >
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

  // ✅ MOBILE: layout in flex column (fix barra scrittura + colonna destra)
  if (isMobile) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--tiko-bg-dark)" }}>
        <Sidebar />

        {mobileScreen === "list" ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 8, padding: 10, borderBottom: "1px solid #222", background: "var(--tiko-bg-gray)" }}>
              <button
                type="button"
                onClick={() => setMobileTab("chats")}
                style={{ flex: 1, background: mobileTab === "chats" ? "var(--tiko-purple)" : "var(--tiko-bg-card)" }}
              >
                Chat {totalUnread > 0 ? `(${totalUnread})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("search")}
                style={{ flex: 1, background: mobileTab === "search" ? "var(--tiko-purple)" : "var(--tiko-bg-card)" }}
              >
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
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
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

  // ✅ WEB: layout stabile, chat sempre visibile, barra scrittura OK
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--tiko-bg-dark)" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
        <div style={{ width: 380, borderRight: "1px solid #222", display: "flex", flexDirection: "column", minWidth: 0, background: "var(--tiko-bg-gray)" }}>
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
