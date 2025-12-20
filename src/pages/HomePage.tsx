import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

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
import { playNotificationBeep } from "../utils/notifySound";

type MessageLike = Message & {
  createdAt?: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: number | null;
  replyTo?: any | null;
  sender?: any | null;
};

function getAuthToken(): string {
  const raw =
    (localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken") ||
      "") + "";

  let t = raw.trim();
  t = t.replace(/^"(.*)"$/, "$1");
  if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  return t;
}

function isSoundEnabled(): boolean {
  // default: ON (se l’utente non ha mai toccato impostazioni)
  const v = localStorage.getItem("clasp.soundEnabled");
  return v !== "false";
}

function useIsMobile(breakpointPx = 1100) {
  const compute = () => {
    const coarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    const ua =
      typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const uaMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

    return coarse || uaMobile || window.innerWidth < breakpointPx;
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

/** identici al profilo */
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

function getConversationKey(conv: any): string {
  const last =
    conv?.lastMessage?.id ??
    conv?.lastMessageId ??
    conv?.lastMessage?.createdAt ??
    conv?.lastMessageAt ??
    conv?.updatedAt ??
    conv?.createdAt ??
    "";
  return last ? String(last) : "";
}

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile(1100);

  const baseUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ""), []);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // mobile views (pagine dedicate dentro /)
  const view = params.get("view") || ""; // chats | search | chat
  const cid = Number(params.get("cid") || 0);
  const from = (params.get("from") || "chats") as "chats" | "search";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageLike[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  // Search
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

  // Notifications (unread + toast)
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + (b || 0), 0),
    [unreadCounts]
  );

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // fallback polling
  const convKeysRef = useRef<Record<number, string>>({});
  const pollInitedRef = useRef(false);

  // audio locked warning (una volta)
  const audioWarnedRef = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  };

  const notifyIncoming = async (msg: string) => {
    showToast(msg);

    if (!isSoundEnabled()) return;

    const ok = await playNotificationBeep();
    if (!ok && !audioWarnedRef.current) {
      audioWarnedRef.current = true;
      showToast("Audio bloccato: vai su Impostazioni per attivare il suono.");
    }
  };

  useEffect(() => {
    const base = "Clasp";
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;
  }, [totalUnread]);

  async function loadConversationsInitial() {
    try {
      const list = await fetchConversations();
      setConversations(list);

      const nextKeys: Record<number, string> = {};
      for (const c of list as any) nextKeys[(c as any).id] = getConversationKey(c);
      convKeysRef.current = nextKeys;
      pollInitedRef.current = true;

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
    loadConversationsInitial();
    loadRelationships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }));
  };

  // realtime socket
  const socket = useChatSocket(user ? user.id : null, {
    onMessage: async ({ conversationId, message }) => {
      const convId = Number(conversationId);
      if (message?.id) convKeysRef.current[convId] = String(message.id);
      else if ((message as any)?.createdAt) convKeysRef.current[convId] = String((message as any).createdAt);

      const isMine = message?.senderId && user?.id ? message.senderId === user.id : false;

      if (selectedConversation?.id === convId) {
        setMessages((prev) => upsertMessage(prev, message));
        setUnreadCounts((prev) => ({ ...prev, [convId]: 0 }));
      } else {
        setUnreadCounts((prev) => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));
        if (!isMine) {
          const name = message?.sender?.displayName || "Qualcuno";
          await notifyIncoming(`Nuovo messaggio da ${name}`);
        }
      }

      try {
        const list = await fetchConversations();
        setConversations(list);
      } catch {}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  // Mobile: forziamo view default
  useEffect(() => {
    if (!isMobile) return;
    if (!view) {
      navigate("/?view=chats", { replace: true });
      return;
    }

    if (view === "chat") {
      if (!cid) {
        navigate("/?view=chats", { replace: true });
        return;
      }
      const found = conversations.find((c) => c.id === cid) || null;
      if (found && selectedConversation?.id !== cid) selectConversation(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, view, cid, conversations.length]);

  // polling fallback
  useEffect(() => {
    if (!user) return;

    let alive = true;

    const tick = async () => {
      try {
        const list = await fetchConversations();
        if (!alive) return;

        setConversations(list);

        if (!pollInitedRef.current) {
          const initKeys: Record<number, string> = {};
          for (const c of list as any) initKeys[(c as any).id] = getConversationKey(c);
          convKeysRef.current = initKeys;
          pollInitedRef.current = true;
          return;
        }

        const prevKeys = convKeysRef.current;
        const nextKeys: Record<number, string> = { ...prevKeys };

        for (const c of list as any) {
          const id = Number((c as any).id);
          const nextKey = getConversationKey(c);
          const prevKey = prevKeys[id];

          const currentlyOpen =
            selectedConversation?.id === id || (isMobile && view === "chat" && cid === id);

          if (prevKey && nextKey && nextKey !== prevKey && !currentlyOpen) {
            setUnreadCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
            await notifyIncoming("Nuovo messaggio ricevuto");
          }

          nextKeys[id] = nextKey;
        }

        convKeysRef.current = nextKeys;
      } catch {
        // silenzioso
      }
    };

    tick();
    const timer = window.setInterval(tick, 12000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [user?.id, selectedConversation?.id, isMobile, view, cid]);

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    const ok = window.confirm("Vuoi eliminare questa conversazione?");
    if (!ok) return;

    try {
      await deleteConversation(selectedConversation.id);
      const list = await fetchConversations();
      setConversations(list);
      setSelectedConversation(null);
      setMessages([]);

      if (isMobile) navigate("/?view=chats", { replace: true });
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

    const tokenNow = getAuthToken();
    if (!tokenNow) {
      setSearchLoading(false);
      setSearchError("Sessione non valida: fai logout/login.");
      return;
    }

    try {
      const p = new URLSearchParams();
      if (qTrim) p.set("q", qTrim);
      if (cityTrim) p.set("city", cityTrim);
      if (areaTrim) p.set("area", areaTrim);
      if (mood) p.set("mood", mood);
      if (stateFilter) p.set("state", stateFilter);
      if (visibleOnly) p.set("visibleOnly", "true");

      const r = await fetch(`${baseUrl}/users?${p.toString()}`, {
        headers: { Authorization: `Bearer ${tokenNow}` },
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

  const startChatWithUser = async (u: any) => {
    try {
      const conv = await createConversation(u.id);
      const list = await fetchConversations();
      setConversations(list);
      selectConversation(conv);

      if (isMobile) navigate(`/?view=chat&cid=${conv.id}&from=search`);
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

          <select
            style={inputStyle as any}
            value={stateFilter}
            onChange={(e) => {
              const v = e.target.value;
              setStateFilter(v);
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

        {searchError && <div style={{ color: "red", fontSize: 13 }}>{searchError}</div>}
        {friendRequestMsg && <div style={{ color: "var(--tiko-text-dim)", fontSize: 13 }}>{friendRequestMsg}</div>}

        {searchResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {searchResults.map((u: any) => {
              const isFriend = friendIds.has(u.id);
              const isPendingSent = sentRequestUserIds.has(u.id);

              return (
                <div key={u.id} style={{ padding: 10, borderRadius: 14, background: "var(--tiko-bg-card)", border: "1px solid #2a2a2a" }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{u.displayName}</strong> <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span>
                  </div>

                  {(u.city || u.area) && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                      {[u.city, u.area].filter(Boolean).join(" • ")}
                    </div>
                  )}

                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                    Mood: <strong style={{ color: "var(--tiko-text)" }}>{u.mood || "—"}</strong>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const GlobalToast = toast ? (
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
  ) : null;

  if (!user) return <div>Non autenticato</div>;

  // MOBILE: 3 “pagine dedicate” interne
  if (isMobile) {
    const effectiveView = view || "chats";

    if (effectiveView === "search") {
      return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--tiko-bg-dark)" }}>
          <Sidebar />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{SearchPanel}</div>
          {GlobalToast}
        </div>
      );
    }

    if (effectiveView === "chat") {
      return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--tiko-bg-dark)" }}>
          <Sidebar />
          <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
            <ChatWindow
              conversation={selectedConversation}
              messages={messages}
              currentUser={user}
              typingUserId={typingUserId}
              onSend={(content) => {
                if (!selectedConversation) return;
                socket.sendMessage(selectedConversation.id, content, null);
              }}
              onSendWithReply={(content, replyToId) => {
                if (!selectedConversation) return;
                socket.sendMessage(selectedConversation.id, content, replyToId ?? null);
              }}
              onTyping={() => {
                if (!selectedConversation) return;
                socket.sendTyping(selectedConversation.id);
              }}
              onDeleteConversation={handleDeleteConversation}
              onBack={() => navigate(from === "search" ? "/?view=search" : "/?view=chats")}
              onOpenChats={() => navigate("/?view=chats")}
            />
          </div>
          {GlobalToast}
        </div>
      );
    }

    // chats list
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--tiko-bg-dark)" }}>
        <Sidebar />
        <div style={{ flex: 1, minHeight: 0 }}>
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id ?? null}
            onSelect={(conv) => {
              selectConversation(conv);
              navigate(`/?view=chat&cid=${conv.id}&from=chats`);
            }}
            unreadCounts={unreadCounts}
          />
        </div>
        {GlobalToast}
      </div>
    );
  }

  // DESKTOP layout (colonna sinistra ricerca + lista chat)
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
            onSend={(content) => {
              if (!selectedConversation) return;
              socket.sendMessage(selectedConversation.id, content, null);
            }}
            onSendWithReply={(content, replyToId) => {
              if (!selectedConversation) return;
              socket.sendMessage(selectedConversation.id, content, replyToId ?? null);
            }}
            onTyping={() => {
              if (!selectedConversation) return;
              socket.sendTyping(selectedConversation.id);
            }}
            onDeleteConversation={handleDeleteConversation}
          />
        </div>
      </div>

      {GlobalToast}
    </div>
  );
}
