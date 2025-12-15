// src/hooks/useChatSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { Message } from '../api';

interface SocketEvents {
  onMessage?: (data: { conversationId: number; message: Message }) => void;
  onConversationNew?: (conversationId: number) => void;
  onUserOnline?: (userId: number) => void;
  onUserOffline?: (data: { userId: number; lastSeen: string }) => void;
  onTyping?: (data: { conversationId: number; userId: number }) => void;
}

export function useChatSocket(
  userId: number | null,
  events: SocketEvents
) {
  const socketRef = useRef<Socket | null>(null);

  // Connessione socket
  useEffect(() => {
    if (!userId) return;

    const socket = io(API_BASE_URL, {
      auth: { userId },
      transports: ['websocket']
    });

    socketRef.current = socket;

    // Registrazione eventi
    socket.on('message:new', (e) => events.onMessage?.(e));
    socket.on('conversation:new', (e) => events.onConversationNew?.(e.conversationId));
    socket.on('user:online', (e) => events.onUserOnline?.(e.userId));
    socket.on('user:offline', (e) => events.onUserOffline?.(e));
    socket.on('user:typing', (e) => events.onTyping?.(e));

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  // API realtime
  return {
    joinConversation(conversationId: number) {
      socketRef.current?.emit('conversation:join', { conversationId });
    },

    sendMessage(conversationId: number, content: string) {
      socketRef.current?.emit('message:send', { conversationId, content });
    },

    sendTyping(conversationId: number) {
      socketRef.current?.emit('typing', { conversationId });
    }
  };
}
