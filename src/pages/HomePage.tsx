import React, { useEffect, useRef, useState } from "react";
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

function useIsMobile(breakpointPx: number = 900) {
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

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile(900);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageLike[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  // Mobile navigation
  const [mobileScreen, setMobileScreen] = useState<"list" | "chat">("list");
  const [mobileTab, setMobileTab] = useState<"chats" | "search">("chats");
  const [mobileChatsDrawerOpen, setMobileChatsDrawerOpen] = useState(false);

  // Search filters
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [visibleOnly, setVisibleOnly] = useState(false);

  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Friends state for buttons
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<number>>(new Set());
  const [friendRequestMsg, setFriendRequestMsg] = useState<string | null>(null);

  // Sound
  const [soundLocked, setSoundLocked] = useState(false);
  const lastBeepRef = useRef<number>(0);

  const baseUrl = API_BASE_URL.replace(/\/+$/, "");

  useEffect(() => {
    // unlock audio (best effort)
    unlockAudio().then((ok) => setSoundLocked(!ok));
  }, []);

  async function loadConversations() {
    try {
      const list = await fetchConversations();
      setConversations(list);

      if (!isMobile && !selectedConversation && list.length > 0) {
        setSelectedConversation(list[0]);
        await loadMessages(list[0].id);
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

  const socket = useChatSocket(user ? user.id : null, {
    onMessage: async ({ conversationId, message }) => {
      loadConversations();

      // beep on messages from other users
      if (message?.senderId && user?.id && message.senderId !== user.id) {
        const now = Date.now();
        if (now - lastBeepRef.current > 1000) {
          lastBeepRef.current = now;
          const ok = await playNotificationBeep();
          setSoundLocked(!ok);
        }
      }

      const convId = Number(conversationId);
      if (selectedConversation?.id === convId) {
        setMessages((prev) => upsertMessage(prev, message));
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

    // Se non c'è alcun filtro, non cerchiamo (evita lista infinita)
    // MA: se visibleOnly è attivo, deve funzionare anche senza nome.
    const hasAnyFilter = !!qTrim || !!cityTrim || !!areaTrim || visibleOnly;
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

      const token = localStorage.getItem("token") || "";

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
      setSelectedConversation(conv);

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
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Ricerca persone</div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input
            style={inputStyle}
            placeholder="Nome o username"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <input
            style={inputStyle}
            placeholder="Città"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <input
            style={inputStyle}
            placeholder="Zona / Area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />

          {/* ✅ Checkbox su riga separata, niente sovrapposizioni */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "var(--tiko-text-dim)",
              padding: "6px 2px",
            }}
          >
            <input
              type="checkbox"
              checked={visibleOnly}
              onChange={(e) => setVisibleOnly(e.target.checked)}
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
                fontWeight: 800,
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
                setSearchResults([]);
                setSearchError(null);
                setFriendRequestMsg(null);
              }}
              style={{
                borderRadius: 12,
                padding: "10px 12px",
                border: "1px solid #2a2a2a",
                background: "transparent",
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
                    <strong>{u.displayName}</strong>{" "}
                    <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span>
                  </div>

                  {(u.city || u.area) && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                      {[u.city, u.area].filter(Boolean).join(" • ")}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => startChatWithUser(u)} style={{ fontSize: 12 }}>
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
    </div>
  );

  const ChatsPanel = (
    <div style={{ flex: 1, minHeight: 0 }}>
      <ConversationList
        conversations={conversations}
        selectedConversationId={selectedConversation?.id ?? null}
        onSelect={(conv) => setSelectedConversation(conv)}
      />
    </div>
  );

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
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid #222",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--tiko-bg-gray)",
            }}
          >
            <strong>Chat</strong>
            <button
              type="button"
              onClick={() => setMobileChatsDrawerOpen(false)}
              style={{
                border: "1px solid #444",
                background: "transparent",
                borderRadius: 10,
                padding: "6px 10px",
                cursor: "pointer",
                color: "#fff",
              }}
            >
              Chiudi
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation?.id ?? null}
              onSelect={(conv) => {
                setSelectedConversation(conv);
                setMobileChatsDrawerOpen(false);
              }}
            />
          </div>
        </div>
      </div>
    ) : null;

  if (!user) return <div>Non autenticato</div>;

  // ------------------- MOBILE -------------------
  if (isMobile) {
    return (
      <div style={{ height: "100vh", background: "var(--tiko-bg-dark)" }}>
        <Sidebar />

        {mobileScreen === "list" ? (
          <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: 10,
                borderBottom: "1px solid #222",
                background: "var(--tiko-bg-gray)",
              }}
            >
              <button
                type="button"
                onClick={() => setMobileTab("chats")}
                style={{ flex: 1, background: mobileTab === "chats" ? "var(--tiko-purple)" : "var(--tiko-bg-card)" }}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("search")}
                style={{ flex: 1, background: mobileTab === "search" ? "var(--tiko-purple)" : "var(--tiko-bg-card)" }}
              >
                Cerca
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {mobileTab === "search" ? SearchPanel : ChatsPanel}
            </div>
          </div>
        ) : (
          <div style={{ height: "100vh", position: "relative" }}>
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

  // ------------------- WEB -------------------
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden" }}>
      <Sidebar />

      <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
        <div
          style={{
            width: 360,
            borderRight: "1px solid #222",
            display: "flex",
            flexDirection: "column",
            background: "var(--tiko-bg-gray)",
            minWidth: 0,
          }}
        >
          {/* ✅ SearchPanel su WEB: include Città/Zona e layout corretto */}
          <div style={{ borderBottom: "1px solid #222" }}>{SearchPanel}</div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation?.id ?? null}
              onSelect={(conv) => setSelectedConversation(conv)}
            />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
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
