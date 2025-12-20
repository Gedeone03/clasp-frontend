import axios from "axios";
import { API_BASE_URL } from "./config";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

function normalizeToken(raw: string | null | undefined): string {
  let t = String(raw || "").trim();
  if (!t) return "";
  if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  // rimuove eventuali doppi apici (capita se viene salvato come JSON string)
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export function getAuthToken(): string {
  // compatibilità: in alcuni pezzi del progetto è "token", in altri "authToken"
  const t = localStorage.getItem("token") || localStorage.getItem("authToken") || localStorage.getItem("accessToken");
  return normalizeToken(t);
}

/**
 * Imposta token in memoria + in localStorage.
 * Salviamo sia "token" sia "authToken" per evitare 401 dovuti a mismatch.
 */
export function setAuthToken(token: string | null) {
  const clean = normalizeToken(token);
  if (clean) {
    api.defaults.headers.common["Authorization"] = `Bearer ${clean}`;
    localStorage.setItem("token", clean);
    localStorage.setItem("authToken", clean);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");
  }
}

/** Carica token dallo storage (utile all’avvio). */
export function loadAuthTokenFromStorage() {
  const clean = getAuthToken();
  if (clean) api.defaults.headers.common["Authorization"] = `Bearer ${clean}`;
}

// ✅ Interceptor: garantisce che TUTTE le richieste abbiano Authorization (se il token c’è)
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export interface User {
  id: number;
  email: string;
  username: string;
  displayName: string;
  // campi storici/variabili (non rompono anche se non esistono)
  purpose?: string | null;
  state?: string | null;
  statusText?: string | null;
  city?: string | null;
  area?: string | null;
  interests?: string | null;
  mood?: string | null;
  avatarUrl?: string | null;
  termsAccepted?: boolean | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ConversationParticipant {
  id: number;
  userId: number;
  conversationId: number;
  joinedAt?: string;
  user?: User;
}

export interface ConversationMessagePreview {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  conversationId: number;
}

export interface Conversation {
  id: number;
  createdAt?: string;
  updatedAt?: string;
  participants: ConversationParticipant[];
  messages?: ConversationMessagePreview[];
  lastMessage?: any; // alcuni backend inviano lastMessage
}

export interface Message {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  conversationId: number;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: number | null;
  sender?: User;
  replyTo?: any;
}

/** AUTH */
export async function register(data: {
  email: string;
  password: string;
  displayName: string;
  username: string;
  city?: string | null;
  area?: string | null;
  purpose?: string; // compat (non usato se backend non lo richiede)
  termsAccepted?: boolean;
}): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/auth/register", data);
  return res.data;
}

export async function login(data: { emailOrUsername: string; password: string }): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/auth/login", data);
  return res.data;
}

export async function fetchMe(): Promise<User> {
  const res = await api.get<User>("/me");
  return res.data;
}

export async function patchMe(data: Partial<User>): Promise<User> {
  const res = await api.patch<User>("/me", data);
  return res.data;
}

/** UPLOADS */
export async function uploadAvatar(file: File): Promise<{ avatarUrl: string; user?: User }> {
  const fd = new FormData();
  fd.append("avatar", file);
  const res = await api.post("/upload/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

export async function uploadChatImage(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await api.post("/upload/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

/** USERS SEARCH */
export async function searchUsers(params: {
  q?: string;
  city?: string;
  area?: string;
  mood?: string;
  state?: string;
  visibleOnly?: boolean;
}): Promise<User[]> {
  const res = await api.get<User[]>("/users/search", { params });
  return res.data;
}

/** FRIENDS */
export async function fetchFriends(): Promise<User[]> {
  const res = await api.get<User[]>("/friends");
  return res.data;
}

export async function fetchFriendRequestsReceived(): Promise<any[]> {
  const res = await api.get<any[]>("/friends/requests/received");
  return res.data;
}

export async function fetchFriendRequestsSent(): Promise<any[]> {
  const res = await api.get<any[]>("/friends/requests/sent");
  return res.data;
}

export async function sendFriendRequest(userId: number): Promise<void> {
  await api.post("/friends/requests", { userId });
}

export async function acceptFriendRequest(requestId: number): Promise<void> {
  await api.post(`/friends/requests/${requestId}/accept`);
}

export async function declineFriendRequest(requestId: number): Promise<void> {
  await api.post(`/friends/requests/${requestId}/decline`);
}

/** CONVERSATIONS + MESSAGES */
export async function fetchConversations(): Promise<Conversation[]> {
  const res = await api.get<Conversation[]>("/conversations");
  return res.data;
}

export async function createConversation(otherUserId: number): Promise<Conversation> {
  const res = await api.post<Conversation>("/conversations", { otherUserId });
  return res.data;
}

export async function deleteConversation(conversationId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}`);
}

export async function fetchMessages(conversationId: number): Promise<Message[]> {
  const res = await api.get<Message[]>(`/conversations/${conversationId}/messages`);
  return res.data;
}

export async function sendMessage(conversationId: number, content: string, replyToId?: number | null): Promise<Message> {
  const res = await api.post<Message>(`/conversations/${conversationId}/messages`, { content, replyToId: replyToId ?? null });
  return res.data;
}

export async function editMessage(messageId: number, content: string): Promise<Message> {
  const res = await api.patch<Message>(`/messages/${messageId}`, { content });
  return res.data;
}

export async function deleteMessage(messageId: number): Promise<Message> {
  const res = await api.delete<Message>(`/messages/${messageId}`);
  return res.data;
}
