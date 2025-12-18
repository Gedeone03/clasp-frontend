// src/pages/HomePage.tsx

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
  searchUsers,
  createConversation,
  deleteConversation,
  sendFriendRequest,
  fetchFriends,
  fetchFriendRequestsSent,
} from "../api";

import { useAuth } from "../AuthContext";
import { useChatSocket } from "../hooks/useChatSocket";
import { useI18n } from "../LanguageContext";
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

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile(900);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageLike[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  const [mobileScreen, setMobileScreen] = useState<"list" | "chat">("list");
  const [mobileTab, setMobileTab] = useState<"chats" | "search">("chats");
  const [mobileChatsDrawerOpen, setMobileChatsDrawerOpen] = useState(false);

  const [focusMode, setFocusMode] = useState(false);
  const [focusConvId, setFocusConvId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisibleOnly, setSearchVisibleOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [friendRequestMsg, setFriendRequestMsg] = useState<string | null>(null);
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<number>>(new Set());

  const [soundEnabled] = useState(true);
  const [soundLocked, setSoundLocked] = useState(false);

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchDebounceRef = useRef<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convIdStr = params.get("convId");
    const focusStr = params.get("focus");

    const convId = convIdStr ? Number(convIdStr) : null;
    const focus = focusStr === "1";

    if (convId && !Number.isNaN(convId)) {
      setFocusConvId(convId);
      setFocusMode(focus);
    } else {
      setFocusConvId(null);
      setFocusMode(false);
    }
  }, []);

  useEffect(() => {
    const onFirstGesture = async () => {
      const ok = await unlockAudio();
      setSoundLocked(!ok);
    };
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstGesture);
  }, []);

  const loadConversations = async () => {
    try {
      const list = await fetchConversations();
      setConversations(list);

      if (!isMobile && !focusMode && !selectedConversation && list.length > 0) {
        setSelectedConversation(list[0]);
        loadMessages(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (convId: number) => {
    try {
      const msgs = await fetchMessages(convId);
      setMessages(msgs as any);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRelationships = async () => {
    try {
      const [friendsList, sentReqs] = await Promise.all([fetchFriends(), fetchFriendRequestsSent()]);
      setFriendIds(new Set(friendsList.map((f) => f.id)));
      const receiverIds = sentReqs.map((r) => r.receiver?.id).filter((id): id is number => typeof id === "number");
      setSentRequestUserIds(new Set(receiverIds));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadConversations();
    loadRelationships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusConvId) return;
    const found = conversations.find((c) => c.id === focusConvId);
    if (found) setSelectedConversation(found);
  }, [conversations, focusConvId]);

  // Socket
  const socket = useChatSocket(user ? user.id : null, {
    onMessage: async ({ conversationId, message }) => {
      loadConversations();
      const convId = Number(conversationId);
      const fromOther = message?.senderId && user?.id ? message.senderId !== user.id : true;

      if (soundEnabled && fromOther && (document.visibilityState !== "visible" || selectedConversation?.id !== convId)) {
        const ok = await playNotificationBeep();
        setSoundLocked(!ok);
      }

      if (selectedConversation?.id === convId) {
        setMessages((prev) => upsertMessage(prev, message));
      }
    },
    onConversationNew: () => loadConversations(),
    onUserOnline: () => loadConversations(),
    onUserOffline: () => loadConversations(),
    onTyping: ({ conversationId, userId }) => {
      if (Number(conversationId) !== selectedConversation?.id) return;
      setTypingUserId(userId);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTypingUserId(null), 1500);
    },
  });

  useEffect(() => {
    if (!selectedConversation) return;
    socket.joinConversation(selectedConversation.id);
    loadMessages(selectedConversation.id);
    if (isMobile) setMobileScreen("chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

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
    const ok = window.confirm(t("homeDeleteChatConfirm"));
    if (!ok) return;
    try {
      await deleteConversation(selectedConversation.id);
      await loadConversations();
      setSelectedConversation(null);
      setMessages([]);
      if (isMobile) setMobileScreen("list");
    } catch (err) {
      console.error(err);
      alert(t("homeDeleteChatError"));
    }
  };

  // ✅ Robust search runner (used by submit and debounce)
  const runSearch = async () => {
    setSearchError(null);
    setFriendRequestMsg(null);
    setSearchResults([]);

    try {
      setSearchLoading(true);
      const res = await searchUsers(searchTerm, searchVisibleOnly);
      setSearchResults(res.filter((u) => u.id !== user?.id));
      if (res.length === 0) setSearchError(t("homeNoUserFound"));
    } catch (err) {
      console.error(err);
      setSearchError(t("homeSearchError"));
    } finally {
      setSearchLoading(false);
    }
  };

  // ✅ Debounce search on desktop too (fix: web search not starting)
  useEffect(() => {
    // don’t auto-search if empty
    const term = searchTerm.trim();
    if (term.length === 0) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      runSearch();
    }, 350);

    return () => clearTimeout(searchDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, searchVisibleOnly]);

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  const startChatWithUser = async (u: User) => {
    try {
      const conv = await createConversation(u.id);
      await loadConversations();
      setSelectedConversation(conv);
      if (isMobile) {
        setMobileTab("chats");
        setMobileScreen("chat");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating chat");
    }
  };

  const handleSendFriendRequest = async (u: User) => {
    try {
      setFriendRequestMsg(null);
      if (friendIds.has(u.id)) {
        setFriendRequestMsg(`${t("homeAlreadyFriend")} @${u.username}`);
        return;
      }
      if (sentRequestUserIds.has(u.id)) {
        setFriendRequestMsg(`${t("homeAlreadyRequested")} @${u.username}`);
        return;
      }
      await sendFriendRequest(u.id);
      setSentRequestUserIds((prev) => new Set([...prev, u.id]));
      setFriendRequestMsg(`${t("homeFriendRequestSentTo")} @${u.username}`);
    } catch (err: any) {
      console.error(err);
      setFriendRequestMsg(err?.response?.data?.error || t("homeSearchError"));
    }
  };

  if (!user) return <div>Not authenticated</div>;

  const conversationsForList = focusMode && focusConvId ? conversations.filter((c) => c.id === focusConvId) : conversations;

  const MobileChatsDrawer =
    !focusMode && mobileChatsDrawerOpen ? (
      <div style={{ position: "fixed", inset: 0, zIndex: 12000, background: "rgba(0,0,0,0.55)", display: "flex" }} onClick={() => setMobileChatsDrawerOpen(false)}>
        <div style={{ width: 320, maxWidth: "90vw", height: "100%", background: "var(--tiko-bg-dark)", borderRight: "1px solid #222", boxShadow: "0 0 24px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 12, borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--tiko-bg-gray)" }}>
            <strong>Chats</strong>
            <button type="button" onClick={() => setMobileChatsDrawerOpen(false)} style={{ border: "1px solid #444", background: "transparent", borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: "#fff" }}>
              Close
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ConversationList conversations={conversationsForList} selectedConversationId={selectedConversation?.id ?? null} onSelect={(conv) => { setSelectedConversation(conv); setMobileChatsDrawerOpen(false); }} />
          </div>
        </div>
      </div>
    ) : null;

  const MobileTopTabs = (
    <div style={{ display: "flex", gap: 8, padding: 10, borderBottom: "1px solid #222", background: "var(--tiko-bg-gray)" }}>
      <button type="button" onClick={() => setMobileTab("chats")} style={{ flex: 1, background: mobileTab === "chats" ? "var(--tiko-purple)" : "var(--tiko-bg-card)" }}>
        Chats
      </button>
      <button type="button" onClick={() => setMobileTab("search")} style={{ flex: 1, background: mobileTab === "search" ? "var(--tiko-purple)" : "var(--tiko-bg-card)" }}>
        Search
      </button>
    </div>
  );

  const SearchPanel = (
    <div style={{ padding: 12 }}>
      <form onSubmit={handleSearchUsers} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input placeholder={t("homeSearchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <label style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
          <input type="checkbox" checked={searchVisibleOnly} onChange={(e) => setSearchVisibleOnly(e.target.checked)} style={{ marginRight: 6 }} />
          {t("homeVisibleOnly")}
        </label>
        <button type="submit" disabled={searchLoading}>{t("homeSearchButton")}</button>
      </form>

      {searchError && <div style={{ color: "red", marginTop: 8 }}>{searchError}</div>}
      {friendRequestMsg && <div style={{ color: "var(--tiko-text-dim)", marginTop: 8 }}>{friendRequestMsg}</div>}

      {searchResults.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {searchResults.map((u) => {
            const isFriend = friendIds.has(u.id);
            const isPendingSent = sentRequestUserIds.has(u.id);

            return (
              <div key={u.id} style={{ padding: 10, borderRadius: 12, background: "var(--tiko-bg-card)", border: "1px solid #2a2a2a" }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{u.displayName}</strong>{" "}
                  <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button style={{ fontSize: 12 }} onClick={() => startChatWithUser(u)} type="button">
                    {t("homeStartChat")}
                  </button>

                  <button
                    style={{
                      fontSize: 12,
                      background: isFriend || isPendingSent ? "#444" : "var(--tiko-mint)",
                      color: isFriend || isPendingSent ? "#bbb" : "#000",
                      cursor: isFriend || isPendingSent ? "not-allowed" : "pointer",
                    }}
                    disabled={isFriend || isPendingSent}
                    onClick={() => handleSendFriendRequest(u)}
                    type="button"
                  >
                    {isFriend ? t("homeAlreadyFriendsButton") : isPendingSent ? t("homeRequestSentButton") : t("homeSendFriendRequest")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {soundEnabled && soundLocked && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--tiko-text-dim)" }}>
          Sound is blocked by the browser. Tap anywhere once to enable notifications.
        </div>
      )}
    </div>
  );

  const ChatsPanel = (
    <div style={{ flex: 1, minHeight: 0 }}>
      <ConversationList conversations={conversationsForList} selectedConversationId={selectedConversation?.id ?? null} onSelect={(conv) => setSelectedConversation(conv)} />
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ height: "100vh", background: "var(--tiko-bg-dark)" }}>
        <Sidebar />

        {mobileScreen === "list" ? (
          <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            {MobileTopTabs}
            <div style={{ flex: 1, overflowY: "auto" }}>{mobileTab === "search" ? SearchPanel : ChatsPanel}</div>
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
              onOpenChats={focusMode ? undefined : () => setMobileChatsDrawerOpen(true)}
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

  return (
    <div className="tiko-layout" style={{ height: "100vh", overflow: "hidden" }}>
      <Sidebar />

      <div style={{ flex: 1, display: "flex", minWidth: 0, height: "100%" }}>
        <div style={{ width: 340, borderRight: "1px solid #222", display: "flex", flexDirection: "column", background: "var(--tiko-bg-gray)", minWidth: 0, height: "100%" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #222" }}>
            <form onSubmit={handleSearchUsers} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input placeholder={t("homeSearchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <label style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                <input type="checkbox" checked={searchVisibleOnly} onChange={(e) => setSearchVisibleOnly(e.target.checked)} style={{ marginRight: 6 }} />
                {t("homeVisibleOnly")}
              </label>
              <button type="submit" disabled={searchLoading}>{t("homeSearchButton")}</button>
            </form>

            {searchError && <div style={{ color: "red", marginTop: 8 }}>{searchError}</div>}
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <ConversationList conversations={conversationsForList} selectedConversationId={selectedConversation?.id ?? null} onSelect={(conv) => setSelectedConversation(conv)} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
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
};

export default HomePage;
