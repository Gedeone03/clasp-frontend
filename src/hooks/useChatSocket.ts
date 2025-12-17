import { useEffect, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "../config";

type Events = {
  onMessage?: (payload: any) => void; // useremo anche per update/delete (upsert)
  onConversationNew?: (payload: any) => void;
  onUserOnline?: (payload: any) => void;
  onUserOffline?: (payload: any) => void;
  onTyping?: (payload: any) => void;
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function useChatSocket(userId: number | null, events: Events) {
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef<Events>(events);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const baseUrl = useMemo(() => normalizeBaseUrl(API_BASE_URL), []);

  useEffect(() => {
    if (!userId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(baseUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: { userId },
    });

    socketRef.current = socket;

    socket.on("message:new", (payload) => eventsRef.current.onMessage?.(payload));
    socket.on("message:update", (payload) => eventsRef.current.onMessage?.(payload));
    socket.on("message:delete", (payload) => eventsRef.current.onMessage?.(payload));

    socket.on("conversation:new", (payload) => eventsRef.current.onConversationNew?.(payload));
    socket.on("user:online", (payload) => eventsRef.current.onUserOnline?.(payload));
    socket.on("user:offline", (payload) => eventsRef.current.onUserOffline?.(payload));
    socket.on("user:typing", (payload) => eventsRef.current.onTyping?.(payload));

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };
    const handleOnline = () => {
      if (socketRef.current && !socketRef.current.connected) socketRef.current.connect();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);

      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, baseUrl]);

  const api = useMemo(() => {
    return {
      joinConversation: (conversationId: number) => socketRef.current?.emit("conversation:join", { conversationId }),
      sendMessage: (conversationId: number, content: string, replyToId?: number | null) =>
        socketRef.current?.emit("message:send", { conversationId, content, replyToId: replyToId ?? null }),
      sendTyping: (conversationId: number) => socketRef.current?.emit("typing", { conversationId }),
    };
  }, []);

  return api;
}
