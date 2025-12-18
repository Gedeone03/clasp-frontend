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
import { useI18n } from "../LanguageContext";
import { playNotificationBeep, unlockAudio } from "../utils/notifySound";
import { API_BASE_URL } from "../config";

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

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile();

  /* ---------------- CHAT STATE ---------------- */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageLike[]>([]);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  /* ---------------- MOBILE UI ---------------- */
  const [mobileScreen, setMobileScreen] = useState<"list" | "chat">("list");
  const [mobileTab, setMobileTab] = useState<"chats" | "search">("chats");
  const [mobileChatsDrawerOpen, setMobileChatsDrawerOpen] = useState(false);

  /* ---------------- SEARCH STATE ---------------- */
  const [searchName, setSearchName] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchArea, setSearchArea] = useState("");
  const [visibleOnly, setVisibleOnly] = useState(false);

  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  /* ---------------- FRIENDS ---------------- */
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<number>>(new Set());
  const [friendRequestMsg, setFriendRequestMsg] = useState<string | null>(null);

  /* ---------------- SOUND ---------------- */
  const [soundLocked, setSoundLocked] = useState(false);
  const lastBeepRef = useRef(0);

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    unlockAudio().then((ok) => setSoundLocked(!ok));
  }, []);

  useEffect(() => {
    loadConversations();
    loadRelationships();
  }, []);

  /* ---------------- LOADERS ---------------- */
  async function loadConversations() {
    const list = await fetchConversations();
    setConversations(list);
    if (!isMobile && !selectedConversation && list.length > 0) {
      setSelectedConversation(list[0]);
      loadMessages(list[0].id);
    }
  }

  async function loadMessages(convId: number) {
    const msgs = await fetchMessages(convId);
    setMessages(msgs as any);
  }

  async function loadRelationships() {
    const [friends, sent] = await Promise.all([
      fetchFriends(),
      fetchFriendRequestsSent(),
    ]);
    setFriendIds(new Set(friends.map((f) => f.id)));
    setSentRequestUserIds(new Set(sent.map((r) => r.receiver?.id).filter(Boolean)));
  }

  /* ---------------- SOCKET ---------------- */
  const socket = useChatSocket(user?.id ?? null, {
    onMessage: async ({ conversationId, message }) => {
      loadConversations();

      if (message.senderId !== user?.id) {
        const now = Date.now();
        if (now - lastBeepRef.current > 1000) {
          lastBeepRef.current = now;
          const ok = await playNotificationBeep();
          setSoundLocked(!ok);
        }
      }

      if (selectedConversation?.id === Number(conversationId)) {
        setMessages((prev) => [...prev, message]);
      }
    },
    onTyping: ({ conversationId, userId }) => {
      if (Number(conversationId) === selectedConversation?.id) {
        setTypingUserId(userId);
        setTimeout(() => setTypingUserId(null), 1500);
      }
    },
  });

  useEffect(() => {
    if (!selectedConversation) return;
    socket.joinConversation(selectedConversation.id);
    loadMessages(selectedConversation.id);
    if (isMobile) setMobileScreen("chat");
  }, [selectedConversation]);

  /* ---------------- SEARCH ---------------- */
  async function runSearch() {
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const params = new URLSearchParams();
      if (searchName) params.append("q", searchName);
      if (searchCity) params.append("city", searchCity);
      if (searchArea) params.append("area", searchArea);
      if (visibleOnly) params.append("visibleOnly", "true");

      const res = await fetch(`${API_BASE_URL}/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (!res.ok) throw new Error("Search failed");

      const users = await res.json();
      setSearchResults(users.filter((u: User) => u.id !== user?.id));
      if (users.length === 0) setSearchError("No users found");
    } catch {
      setSearchError("Search error");
    } finally {
      setSearchLoading(false);
    }
  }

  /* ---------------- UI BLOCKS ---------------- */

  const SearchPanel = (
    <div style={{ padding: 12 }}>
      <input placeholder="Name" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
      <input placeholder="City" value={searchCity} onChange={(e) => setSearchCity(e.target.value)} />
      <input placeholder="Area" value={searchArea} onChange={(e) => setSearchArea(e.target.value)} />

      <label>
        <input type="checkbox" checked={visibleOnly} onChange={(e) => setVisibleOnly(e.target.checked)} />
        Visible to everyone
      </label>

      <button onClick={runSearch} disabled={searchLoading}>
        {searchLoading ? "Searching..." : "Search"}
      </button>

      {searchError && <div style={{ color: "red" }}>{searchError}</div>}

      {searchResults.map((u) => (
        <div key={u.id}>
          <strong>{u.displayName}</strong> @{u.username}
        </div>
      ))}
    </div>
  );

  const ChatsPanel = (
    <ConversationList
      conversations={conversations}
      selectedConversationId={selectedConversation?.id ?? null}
      onSelect={(c) => setSelectedConversation(c)}
    />
  );

  if (isMobile) {
    return (
      <>
        <Sidebar />
        {mobileScreen === "list" ? (
          <>
            <button onClick={() => setMobileTab("chats")}>Chats</button>
            <button onClick={() => setMobileTab("search")}>Search</button>
            {mobileTab === "search" ? SearchPanel : ChatsPanel}
          </>
        ) : (
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            currentUser={user!}
            typingUserId={typingUserId}
            onSend={(c) => socket.sendMessage(selectedConversation!.id, c, null)}
            onTyping={() => socket.sendTyping(selectedConversation!.id)}
            onDeleteConversation={async () => {
              await deleteConversation(selectedConversation!.id);
              setSelectedConversation(null);
              setMobileScreen("list");
            }}
            onOpenChats={() => setMobileChatsDrawerOpen(true)}
            onBack={() => setMobileScreen("list")}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar />
      <div style={{ width: 320 }}>{SearchPanel}</div>
      <div style={{ flex: 1 }}>
        <ChatWindow
          conversation={selectedConversation}
          messages={messages}
          currentUser={user!}
          typingUserId={typingUserId}
          onSend={(c) => socket.sendMessage(selectedConversation!.id, c, null)}
          onTyping={() => socket.sendTyping(selectedConversation!.id)}
          onDeleteConversation={async () => {
            await deleteConversation(selectedConversation!.id);
            setSelectedConversation(null);
          }}
        />
      </div>
    </div>
  );
}
