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

function useIsMobile(breakpointPx: number = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isMobile;
}

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile(900);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  // Mobile views
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [mobileListTab, setMobileListTab] = useState<"chats" | "search">("chats");

  // Search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisibleOnly, setSearchVisibleOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [friendRequestMsg, setFriendRequestMsg] = useState<string | null>(null);

  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<number>>(new Set());

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadConversations = async () => {
    try {
      const list = await fetchConversations();
      setConversations(list);

      // Desktop: seleziona la prima se non c'è nulla
      if (!isMobile && !selectedConversation && list.length > 0) {
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
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRelationships = async () => {
    try {
      const [friendsList, sentReqs] = await Promise.all([
        fetchFriends(),
        fetchFriendRequestsSent(),
      ]);
      setFriendIds(new Set(friendsList.map((f) => f.id)));

      const receiverIds = sentReqs
        .map((r) => r.receiver?.id)
        .filter((id): id is number => typeof id === "number");

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

  // Socket
  const socket = useChatSocket(user ? user.id : null, {
    onMessage: ({ conversationId, message }) => {
      if (selectedConversation?.id === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
      loadConversations();
    },
    onConversationNew: () => loadConversations(),
    onUserOnline: () => loadConversations(),
    onUserOffline: () => loadConversations(),
    onTyping: ({ conversationId, userId }) => {
      if (conversationId !== selectedConversation?.id) return;
      setTypingUserId(userId);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTypingUserId(null), 1500);
    },
  });

  useEffect(() => {
    if (selectedConversation) {
      socket.joinConversation(selectedConversation.id);
      loadMessages(selectedConversation.id);

      if (isMobile) setMobileView("chat");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

  const handleSend = (content: string) => {
    if (!selectedConversation) return;
    socket.sendMessage(selectedConversation.id, content);
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
      if (isMobile) setMobileView("list");
    } catch (err) {
      console.error(err);
      alert(t("homeDeleteChatError"));
    }
  };

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const startChatWithUser = async (u: User) => {
    try {
      await createConversation(u.id);
      await loadConversations();
      // su mobile l’utente poi apre la chat dalla lista chat
      setMobileListTab("chats");
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

  // ---------------------------
  // Left panel for desktop
  // ---------------------------
  const desktopLeft = (
    <div
      style={{
        width: 340,
        borderRight: "1px solid #222",
        display: "flex",
        flexDirection: "column",
        background: "var(--tiko-bg-gray)",
        minWidth: 0,
        height: "100%",
      }}
    >
      {/* Search */}
      <div style={{ padding: 12, borderBottom: "1px solid #222" }}>
        <form onSubmit={handleSearchUsers} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder={t("homeSearchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <label style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
            <input
              type="checkbox"
              checked={searchVisibleOnly}
              onChange={(e) => setSearchVisibleOnly(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            {t("homeVisibleOnly")}
          </label>

          <button disabled={searchLoading}>{t("homeSearchButton")}</button>
        </form>

        {searchError && <div style={{ color: "red", marginTop: 8 }}>{searchError}</div>}
        {friendRequestMsg && <div style={{ color: "var(--tiko-text-dim)", marginTop: 8 }}>{friendRequestMsg}</div>}

        {searchResults.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {searchResults.map((u) => {
              const isFriend = friendIds.has(u.id);
              const isPendingSent = sentRequestUserIds.has(u.id);

              return (
                <div
                  key={u.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    background: "var(--tiko-bg-card)",
                    border: "1px solid #2a2a2a",
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <strong>{u.displayName}</strong>{" "}
                    <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span>
                  </div>

                  {u.mood && <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 2 }}>Mood: {u.mood}</div>}
                  {u.interests?.length ? <div style={{ fontSize: 12, marginTop: 2 }}>Interests: {u.interests.join(", ")}</div> : null}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button style={{ fontSize: 12 }} onClick={() => startChatWithUser(u)}>
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
                    >
                      {isFriend ? t("homeAlreadyFriendsButton") : isPendingSent ? t("homeRequestSentButton") : t("homeSendFriendRequest")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversation?.id ?? null}
          onSelect={(conv) => setSelectedConversation(conv)}
        />
      </div>
    </div>
  );

  // ---------------------------
  // Mobile list view (tabs)
  // ---------------------------
  const mobileList = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--tiko-bg-gray)" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: 10, borderBottom: "1px solid #222" }}>
        <button
          type="button"
          onClick={() => setMobileListTab("chats")}
          style={{
            flex: 1,
            background: mobileListTab === "chats" ? "var(--tiko-purple)" : "var(--tiko-bg-card)",
          }}
        >
          Chats
        </button>
        <button
          type="button"
          onClick={() => setMobileListTab("search")}
          style={{
            flex: 1,
            background: mobileListTab === "search" ? "var(--tiko-purple)" : "var(--tiko-bg-card)",
          }}
        >
          Search
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {mobileListTab === "chats" ? (
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id ?? null}
            onSelect={(conv) => setSelectedConversation(conv)}
          />
        ) : (
          <div style={{ padding: 12 }}>
            <form onSubmit={handleSearchUsers} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                placeholder={t("homeSearchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <label style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                <input
                  type="checkbox"
                  checked={searchVisibleOnly}
                  onChange={(e) => setSearchVisibleOnly(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                {t("homeVisibleOnly")}
              </label>

              <button disabled={searchLoading}>{t("homeSearchButton")}</button>
            </form>

            {searchError && <div style={{ color: "red", marginTop: 8 }}>{searchError}</div>}
            {friendRequestMsg && <div style={{ color: "var(--tiko-text-dim)", marginTop: 8 }}>{friendRequestMsg}</div>}

            {searchResults.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {searchResults.map((u) => {
                  const isFriend = friendIds.has(u.id);
                  const isPendingSent = sentRequestUserIds.has(u.id);

                  return (
                    <div
                      key={u.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        background: "var(--tiko-bg-card)",
                        border: "1px solid #2a2a2a",
                      }}
                    >
                      <div style={{ fontSize: 13 }}>
                        <strong>{u.displayName}</strong>{" "}
                        <span style={{ color: "var(--tiko-text-dim)" }}>@{u.username}</span>
                      </div>

                      {u.mood && <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 2 }}>Mood: {u.mood}</div>}
                      {u.interests?.length ? <div style={{ fontSize: 12, marginTop: 2 }}>Interests: {u.interests.join(", ")}</div> : null}

                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button style={{ fontSize: 12 }} onClick={() => startChatWithUser(u)}>
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
                        >
                          {isFriend ? t("homeAlreadyFriendsButton") : isPendingSent ? t("homeRequestSentButton") : t("homeSendFriendRequest")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const chatPane = (
    <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
      <ChatWindow
        conversation={selectedConversation}
        messages={messages}
        currentUser={user}
        typingUserId={typingUserId}
        onSend={handleSend}
        onTyping={handleTyping}
        onDeleteConversation={handleDeleteConversation}
        onBack={isMobile ? () => setMobileView("list") : undefined}
      />
    </div>
  );

  return (
    <div className="tiko-layout" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Desktop sidebar only */}
      {!isMobile && <Sidebar />}

      {isMobile ? (
        <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
          {mobileView === "list" ? mobileList : chatPane}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", minWidth: 0, height: "100%" }}>
          {desktopLeft}
          {chatPane}
        </div>
      )}
    </div>
  );
};

export default HomePage;
