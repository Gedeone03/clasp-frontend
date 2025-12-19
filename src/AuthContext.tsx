import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./config";

type User = {
  id: number;
  email?: string;
  username: string;
  displayName: string;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  statusText?: string | null;
  mood?: string | null;
  interests?: any;
  avatarUrl?: string | null;
};

type RegisterInput = {
  email: string;
  password: string;
  username: string;
  displayName: string;
  termsAccepted: boolean;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeToken(raw: any): string | null {
  if (!raw) return null;
  let t = String(raw).trim();
  t = t.replace(/^"+|"+$/g, "").trim();
  if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  return t.length ? t : null;
}

function getStoredToken(): string | null {
  try {
    const t = localStorage.getItem("token") || localStorage.getItem("authToken") || "";
    return normalizeToken(t);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null) {
  try {
    if (!token) {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      return;
    }
    const clean = normalizeToken(token);
    if (!clean) return;
    localStorage.setItem("token", clean);
    localStorage.setItem("authToken", clean);
  } catch {
    // ignore
  }
}

async function httpJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      `Errore HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

async function apiMe(): Promise<User> {
  return await httpJson<User>("/me", { method: "GET" });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const me = await apiMe();
      setUser(me);
    } catch (e: any) {
      // token non valido -> pulisci
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("token") || msg.includes("401")) {
        setStoredToken(null);
      }
      setUser(null);
      throw e;
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refreshMe();
      } catch {
        // ignore
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(identifier: string, password: string) {
    const id = identifier.trim();
    if (!id || !password) throw new Error("Inserisci email/username e password.");

    // compatibile con backend
    const payload = {
      emailOrUsername: id,
      email: id,
      username: id,
      identifier: id,
      password,
    };

    const data: any = await httpJson<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const token = normalizeToken(data?.token || data?.accessToken || data?.jwt);
    if (!token) throw new Error("Login non riuscito: token non ricevuto.");

    setStoredToken(token);

    // user immediato se presente, altrimenti /me
    if (data?.user?.id) {
      setUser(data.user);
    } else {
      await refreshMe();
    }
  }

  async function register(input: RegisterInput) {
    const payload = {
      email: input.email,
      password: input.password,
      username: input.username,
      displayName: input.displayName,
      termsAccepted: input.termsAccepted,
      acceptTerms: input.termsAccepted,
    };

    const data: any = await httpJson<any>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const token = normalizeToken(data?.token || data?.accessToken || data?.jwt);
    if (!token) throw new Error("Registrazione non riuscita: token non ricevuto.");

    setStoredToken(token);

    if (data?.user?.id) setUser(data.user);
    else await refreshMe();
  }

  function logout() {
    setStoredToken(null);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refreshMe }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
