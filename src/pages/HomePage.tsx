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

function useIsMobile(breakpointPx = 1100) {
  const compute = () => {
    const coarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
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

function isSoundEnabled(): boolean {
  const v = localStorage.getItem("clasp.soundEnabled");
  return v !== "false";
}

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile(1100);

  const baseUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ""), []);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // mobile views
  const view = params.get("view") || "";
  const cid = Number(params.get("cid") || 0);
  const from = (params.get("from") || "chats") as "chats" | "search";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageLike[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  // notifications
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + (b || 0), 0),
    [unreadCounts]
  );

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // polling fallback
  const convKeysRef = useRef<Record<number, string>>({});
  const pollInitedRef = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  };

  const notifyIncoming = async (msg: string) => {
    showToast(msg);
    if (!isSoundEnabled()) return;
    await playNotificationBeep();
  };

  useEffect(() => {
    const base = "Clasp";
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;
  }, [totalUnread]);

  // ✅ IMPORTANT: carica SEMPRE le conversazioni su mount e ogni 12s
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const list = await fetchConversations();
        if (!alive) return;

        setConversations(list);

        // init keys polling
        const keys: Record<number, string> = {};
        for (const c of list as any) keys[(c as any).id] = getConversationKey(c);
        convKeysRef.current = keys;
        pollInitedRef.current = true;

        // se non selezionata e desktop -> seleziona la prima
        if (!isMobile && !selectedConversation && list.length > 0) {
          setSelectedConversation(list[0]);
        }
      } catch (e) {
        console.error(e);
      }
    };

    load();

    const timer = window.setInterval(load, 12000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMessages(convId: number) {
    try {
      const msgs = await fetchMessages(convId);
      setMessages(msgs as any);
    } catch (e) {
      console.error(e);
    }
  }

  const selectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }));
  };

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

      // refresh conv list
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

  // mobile view default
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
  }, [isMobile, view, cid, conversations]);

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

  // MOBILE dedicated pages
  if (isMobile) {
    const effectiveView = view || "chats";

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
              onSend={handleSend}
              onSendWithReply={handleSendWithReply}
              onTyping={handleTyping}
              onDeleteConversation={handleDeleteConversation}
              onBack={() => navigate(from === "search" ? "/?view=search" : "/?view=chats")}
              onOpenChats={() => navigate("/?view=chats")}
            />
          </div>
          {GlobalToast}
        </div>
      );
    }

    if (effectiveView === "search") {
      // struttura ok, non cambiamo qui
      return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--tiko-bg-dark)" }}>
          <Sidebar />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, color: "var(--tiko-text-dim)" }}>
            La ricerca rimane nella struttura attuale (non modificata qui).
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

  // DESKTOP
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--tiko-bg-dark)" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
        <div style={{ width: "clamp(320px, 34vw, 420px)", borderRight: "1px solid #222", display: "flex", flexDirection: "column", minWidth: 0, background: "var(--tiko-bg-gray)" }}>
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

      {GlobalToast}
    </div>
  );
}
