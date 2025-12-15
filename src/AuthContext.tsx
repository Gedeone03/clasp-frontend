// src/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AuthResponse,
  User,
  login as apiLogin,
  register as apiRegister,
  fetchMe,
  setAuthToken,
  loadAuthTokenFromStorage,
} from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    username: string,
    city?: string,
    area?: string,
    termsAccepted?: boolean
  ) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuthTokenFromStorage();
    const init = async () => {
      try {
        const me = await fetchMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
    setAuthToken(data.token);
    setUser(data.user);
  };

  const login = async (emailOrUsername: string, password: string) => {
    setLoading(true);
    try {
      const data = await apiLogin({ emailOrUsername, password });
      handleAuthSuccess(data);
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    displayName: string,
    username: string,
    city?: string,
    area?: string,
    termsAccepted?: boolean
  ) => {
    setLoading(true);
    try {
      const data = await apiRegister({
        email,
        password,
        displayName,
        username,
        city,
        area,
        termsAccepted: termsAccepted ?? false,
      });
      handleAuthSuccess(data);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
