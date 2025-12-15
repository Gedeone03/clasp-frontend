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

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisibleOnly, setSearchVisibleOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [friendRequestMsg, setFriendRequestMsg] = useState<string | null>(null);

  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<number>>(
    new Set()
  );

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadConversations = async () => {
    try {
      const list = await fetchConversations();
      setConversations(list);

      if (!selectedConversation && list.length > 0) {
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
  }, []);

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

      typingTimeout.current = setTimeout(() => {
        setTypingUserId(null);
      }, 1500);
    },
  });

  useEffect(() => {
    if (selectedConversation) {
      socket.joinConversation(selectedConversation.id);
      loadMessages(selectedConversation.id);
    }
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

    const conferma = window.confirm(t("homeDeleteChatConfirm"));
    if (!conferma) return;

    try {
      await deleteConversation(selectedConversation.id);
      await loadConversations();
      setSelectedConversation(null);
      setMessages([]);
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
      // non forziamo selection: user vede la chat in lista
    } catch (e) {
      console.error(e);
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
      const msg = err?.response?.data?.error || t("homeSearchError");
      setFriendRequestMsg(msg);
    }
  };

  if (!user) return <div>Not authenticated</div>;

  return (
    <div className="tiko-layout">
      <Sidebar />

      <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
        <div
          style={{
            width: 320,
            borderRight: "1px solid #222",
            display: "flex",
            flexDirection: "column",
            background: "var(--tiko-bg-gray)",
          }}
        >
          <div style={{ padding: 12, borderBottom: "1px solid #222" }}>
            <form
              onSubmit={handleSearchUsers}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <input
                placeholder={t("homeSearchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={searchVisibleOnly}
                  onChange={(e) => setSearchVisibleOnly(e.target.checked)}
                />
                {t("homeVisibleOnly")}
              </label>

              <button disabled={searchLoading}>{t("homeSearchButton")}</button>
            </form>

            {searchError && (
              <div style={{ color: "red", marginTop: 6 }}>{searchError}</div>
            )}

            {friendRequestMsg && (
              <div style={{ color: "var(--tiko-text-dim)", marginTop: 6 }}>
                {friendRequestMsg}
              </div>
            )}

            {searchResults.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {searchResults.map((u) => {
                  const isFriend = friendIds.has(u.id);
                  const isPendingSent = sentRequestUserIds.has(u.id);

                  return (
                    <div
                      key={u.id}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        background: "var(--tiko-bg-card)",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ fontSize: 13, marginBottom: 2 }}>
                        <strong>{u.displayName}</strong>{" "}
                        <span style={{ color: "var(--tiko-text-dim)" }}>
                          @{u.username}
                        </span>
                      </div>

                      {u.mood && (
                        <div style={{ fontSize: 11, color: "var(--tiko-text-dim)" }}>
                          Mood: {u.mood}
                        </div>
                      )}

                      {u.interests.length > 0 && (
                        <div style={{ fontSize: 11 }}>
                          Interests: {u.interests.join(", ")}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
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
                          {isFriend
                            ? t("homeAlreadyFriendsButton")
                            : isPendingSent
                            ? t("homeRequestSentButton")
                            : t("homeSendFriendRequest")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id ?? null}
            onSelect={(conv) => setSelectedConversation(conv)}
          />
        </div>

        <ChatWindow
          conversation={selectedConversation}
          messages={messages}
          currentUser={user}
          typingUserId={typingUserId}
          onSend={handleSend}
          onTyping={handleTyping}
          onDeleteConversation={handleDeleteConversation}
        />
      </div>
    </div>
  );
};

export default HomePage;
