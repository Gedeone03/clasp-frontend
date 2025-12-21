import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import ConversationList from "../components/ui/ConversationList";
import ChatWindow from "../components/ui/ChatWindow";

import { Conversation, fetchConversations, fetchMessages } from "../api";
import { useAuth } from "../AuthContext";
import { playNotificationBeep } from "../utils/notifySound";

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

export default function HomePage() {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const keysRef = useRef<Record<number, string>>({});
  const firstPollRef = useRef(true);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + (b || 0), 0),
    [unreadCounts]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const base = "Clasp";
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;
  }, [totalUnread]);

  // load initial conversations
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchConversations();
        setConversations(list);

        // init keys
        const init: Record<number, string> = {};
        for (const c of list as any) init[c.id] = convKey(c);
        keysRef.current = init;

        if (!selectedConversation && list.length > 0) {
          setSelectedConversation(list[0]);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load messages when select changes
  useEffect(() => {
    if (!selectedConversation) return;
    (async () => {
      try {
        const list = await fetchMessages(selectedConversation.id);
        setMessages(list as any);
        setUnreadCounts((prev) => ({ ...prev, [selectedConversation.id]: 0 }));
      } catch {}
    })();
  }, [selectedConversation?.id]);

  // GLOBAL POLLING for notifications (chat closed)
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

        // prima esecuzione: non sparare notifiche retroattive
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
            // unread increment
            setUnreadCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));

            // toast
            showToast("Nuovo messaggio ricevuto");

            // sound (only if enabled)
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

  if (!user) return <div style={{ padding: 14 }}>Non loggato</div>;

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
          <div style={{ flex: 1, minHeight: 0 }}>
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation?.id ?? null}
              onSelect={(c) => setSelectedConversation(c)}
              unreadCounts={unreadCounts}
            />
          </div>
        </div>

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
