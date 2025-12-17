// src/hooks/useChatSocket.ts

import { useEffect, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "../config";

type Events = {
  onMessage?: (payload: any) => void;
  onConversationNew?: (payload: any) => void;
  onUserOnline?: (payload: any) => void;
  onUserOffline?: (payload: any) => void;
  onTyping?: (payload: any) => void;
};

function normalizeBaseUrl(url: string) {
  // evita doppio slash e problemi di trailing slash
  return url.replace(/\/+$/, "");
}

export function useChatSocket(userId: number | null, events: Events) {
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef<Events>(events);

  // aggiorna sempre i callback senza ricreare socket
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const baseUrl = useMemo(() => normalizeBaseUrl(API_BASE_URL), []);

  useEffect(() => {
    // se non c'è utente loggato, chiudi socket
    if (!userId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // crea socket una sola volta
    const socket = io(baseUrl, {
      transports: ["websocket", "polling"], // IMPORTANTISSIMO per mobile (fallback)
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: { userId },
    });

    socketRef.current = socket;

    // listeners principali
    socket.on("connect", () => {
      // console.log("socket connected", socket.id);
    });

    socket.on("connect_error", (err: any) => {
      console.warn("socket connect_error:", err?.message || err);
    });

    socket.on("disconnect", (reason) => {
      console.warn("socket disconnected:", reason);
    });

    socket.on("message:new", (payload) => {
      eventsRef.current.onMessage?.(payload);
    });

    socket.on("conversation:new", (payload) => {
      eventsRef.current.onConversationNew?.(payload);
    });

    socket.on("user:online", (payload) => {
      eventsRef.current.onUserOnline?.(payload);
    });

    socket.on("user:offline", (payload) => {
      eventsRef.current.onUserOffline?.(payload);
    });

    socket.on("user:typing", (payload) => {
      eventsRef.current.onTyping?.(payload);
    });

    // ✅ Fix mobile/PWA: quando l'app torna visibile, forza reconnect
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
    };

    // ✅ Fix mobile rete ballerina: se cambia rete, prova a reconnect
    const handleOnline = () => {
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
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

  // API usata da HomePage
  const api = useMemo(() => {
    return {
      joinConversation: (conversationId: number) => {
        if (!socketRef.current) return;
        socketRef.current.emit("conversation:join", { conversationId });
      },
      sendMessage: (conversationId: number, content: string) => {
        if (!socketRef.current) return;
        socketRef.current.emit("message:send", { conversationId, content });
      },
      sendTyping: (conversationId: number) => {
        if (!socketRef.current) return;
        socketRef.current.emit("typing", { conversationId });
      },
      get connected() {
        return !!socketRef.current?.connected;
      },
    };
  }, []);

  return api;
}
