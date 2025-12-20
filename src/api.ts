import axios, { AxiosInstance } from "axios";
import { API_BASE_URL } from "./config";

/** ===== TOKEN HELPERS ===== */
function normalizeToken(raw: unknown): string {
  let t = String(raw ?? "").trim();
  if (!t) return "";
  if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export function getAuthToken(): string {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    "";
  return normalizeToken(raw);
}

function applyTokenEverywhere(token: string) {
  const clean = normalizeToken(token);

  // axios globale
  if (clean) axios.defaults.headers.common["Authorization"] = `Bearer ${clean}`;
  else delete axios.defaults.headers.common["Authorization"];

  // istanza api
  if (clean) api.defaults.headers.common["Authorization"] = `Bearer ${clean}`;
  else delete api.defaults.headers.common["Authorization"];
}

export function setAuthToken(token: string | null) {
  const clean = normalizeToken(token);
  if (clean) {
    localStorage.setItem("token", clean);
    localStorage.setItem("authToken", clean);
  } else {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");
  }
  applyTokenEverywhere(clean);
}

export function loadAuthTokenFromStorage() {
  applyTokenEverywhere(getAuthToken());
}

/** ===== AXIOS INSTANCE ===== */
export const api: AxiosInstance = axios.create({
  baseURL: (API_BASE_URL || "").replace(/\/+$/, ""),
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

loadAuthTokenFromStorage();
export default api;

/** ===== TYPES ===== */
export interface User {
  id: number;
  email: string;
  username: string;
  displayName: string;
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

export interface Conversation {
  id: number;
  participants: ConversationParticipant[];
  lastMessage?: Message | null;
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
}

/** ===== AUTH ===== */
export async function register(data: {
  email: string;
  password: string;
  displayName: string;
  username: string;
  city?: string | null;
  area?: string | null;
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

/** ===== UPLOAD HELPERS ===== */
async function uploadMultipart(
  path: string,
  field: string,
  file: File
): Promise<string> {
  const fd = new FormData();
  fd.append(field, file);

  const res = await api.post(path, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const data: any = res.data || {};
  const url = data.url || data.fileUrl || data.path || data.avatarUrl;
  if (!url) throw new Error("Risposta upload non valida (manca url).");
  return String(url);
}

/**
 * ✅ FIX NETLIFY:
 * ChatWindow importa uploadImage/uploadAudio -> devono esistere qui.
 */
export async function uploadImage(file: File): Promise<{ url: string }> {
  const url = await uploadMultipart("/upload/image", "image", file);
  return { url };
}

export async function uploadAudio(file: File): Promise<{ url: string }> {
  // prova endpoint dedicato, se non c'è fallback su /upload/file e poi /upload/image
  try {
    const url = await uploadMultipart("/upload/audio", "audio", file);
    return { url };
  } catch {
    try {
      const url = await uploadMultipart("/upload/file", "file", file);
      return { url };
    } catch {
      const url = await uploadMultipart("/upload/image", "image", file);
      return { url };
    }
  }
}

// compat: usata in alcune parti del progetto
export async function uploadAvatar(file: File): Promise<{ ok?: boolean; avatarUrl: string; user?: User }> {
  const fd = new FormData();
  fd.append("avatar", file);
  const res = await api.post("/upload/avatar", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/** ===== USERS SEARCH ===== */
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

/** ===== FRIENDS ===== */
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

/** ===== CONVERSATIONS + MESSAGES ===== */
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
  const res = await api.post<Message>(`/conversations/${conversationId}/messages`, {
    content,
    replyToId: replyToId ?? null,
  });
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
