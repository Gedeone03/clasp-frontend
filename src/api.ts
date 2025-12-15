// src/api.ts
import axios from "axios";
import { API_BASE_URL } from "./config";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// -------------------------------------------------------------
// Tipi principali
// -------------------------------------------------------------
export interface User {
  id: number;
  email: string;
  username: string;
  displayName: string;
  state: string;
  statusText: string | null;
  city: string | null;
  area: string | null;
  interests: string[];
  lastSeen?: string | null;
  termsAccepted?: boolean;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ConversationParticipant {
  id: number;
  userId: number;
  conversationId: number;
  joinedAt: string;
  user: User | null;
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
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  messages: ConversationMessagePreview[];
}

export interface Message {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  conversationId: number;
  sender: User | null;
}

export interface FriendRequest {
  id: number;
  sender?: User;
  receiver?: User;
}

// -------------------------------------------------------------
// AUTH
// -------------------------------------------------------------
export async function register(data: {
  email: string;
  password: string;
  displayName: string;
  username: string;
  city?: string;
  area?: string;
  termsAccepted: boolean;
}): Promise<AuthResponse> {
  const r = await api.post<AuthResponse>("/auth/register", data);
  return r.data;
}

export async function login(data: {
  emailOrUsername: string;
  password: string;
}): Promise<AuthResponse> {
  const r = await api.post<AuthResponse>("/auth/login", data);
  return r.data;
}

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("authToken", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("authToken");
  }
}

export function loadAuthTokenFromStorage() {
  const token = localStorage.getItem("authToken");
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
}

export async function fetchMe(): Promise<User> {
  const r = await api.get<User>("/me");
  return r.data;
}

export async function updateMe(data: {
  displayName?: string;
  statusText?: string;
  state?: string;
  city?: string;
  area?: string;
  interests?: string[];
  avatarUrl?: string;
}): Promise<User> {
  const r = await api.put<User>("/me", data);
  return r.data;
}

// -------------------------------------------------------------
// USERS
// -------------------------------------------------------------
export async function searchUsers(
  q: string,
  visibleOnly: boolean = false,
  mood?: string
): Promise<User[]> {
  const params: any = {
    q,
    visibleOnly: visibleOnly ? "true" : "false",
  };

  if (mood) {
    params.mood = mood;
  }

  const r = await api.get<User[]>("/users", { params });
  return r.data;
}


// -------------------------------------------------------------
// FRIENDS
// -------------------------------------------------------------
export async function sendFriendRequest(userId: number): Promise<void> {
  await api.post(`/friends/request/${userId}`);
}

export async function acceptFriendRequest(requestId: number): Promise<void> {
  await api.post(`/friends/accept/${requestId}`);
}

export async function declineFriendRequest(requestId: number): Promise<void> {
  await api.post(`/friends/decline/${requestId}`);
}

export async function fetchFriends(): Promise<User[]> {
  const r = await api.get<User[]>("/friends");
  return r.data;
}

export async function fetchFriendRequestsReceived(): Promise<FriendRequest[]> {
  const r = await api.get<FriendRequest[]>("/friends/requests/received");
  return r.data;
}

export async function fetchFriendRequestsSent(): Promise<FriendRequest[]> {
  const r = await api.get<FriendRequest[]>("/friends/requests/sent");
  return r.data;
}

// -------------------------------------------------------------
// CHAT
// -------------------------------------------------------------
export async function fetchConversations(): Promise<Conversation[]> {
  const r = await api.get<Conversation[]>("/conversations");
  return r.data;
}

export async function createConversation(
  otherUserId: number
): Promise<Conversation> {
  const r = await api.post<Conversation>("/conversations", { otherUserId });
  return r.data;
}

export async function fetchMessages(
  conversationId: number
): Promise<Message[]> {
  const r = await api.get<Message[]>(`/conversations/${conversationId}/messages`);
  return r.data;
}

export async function sendMessageHttp(
  conversationId: number,
  content: string
): Promise<Message> {
  const r = await api.post<Message>(
    `/conversations/${conversationId}/messages`,
    { content }
  );
  return r.data;
}

// ELIMINA CONVERSAZIONE
export async function deleteConversation(
  conversationId: number
): Promise<void> {
  await api.delete(`/conversations/${conversationId}`);
}

// -------------------------------------------------------------
// UPLOAD IMMAGINI
// -------------------------------------------------------------
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const r = await api.post<{ url: string }>("/upload/image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return r.data.url;
}

// -------------------------------------------------------------
// UPLOAD AUDIO
// -------------------------------------------------------------
export async function uploadAudio(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("audio", file);

  const r = await api.post<{ url: string }>("/upload/audio", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return r.data.url;
}
// -------------------------------------------------------------
// UPLOAD AVATAR
// -------------------------------------------------------------
export async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("avatar", file);

  const r = await api.post<{ url: string }>("/upload/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return r.data.url;
}
