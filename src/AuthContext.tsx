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
  // register accetta sia stile vecchio (parametri) sia stile nuovo (oggetto)
  register: (...args: any[]) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    // ✅ importantissimo: ricarica token dallo storage al boot
    loadAuthTokenFromStorage();

    const init = async () => {
      try {
        await refreshMe();
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const register = async (...args: any[]) => {
    setLoading(true);
    try {
      // stile nuovo: register({ ... })
      if (args.length === 1 && typeof args[0] === "object") {
        const data = await apiRegister(args[0]);
        handleAuthSuccess(data);
        return;
      }

      // stile vecchio: register(email, password, displayName, username, purpose?, city?, area?)
      const [email, password, displayName, username, purpose, city, area] = args;
      const data = await apiRegister({
        email,
        password,
        displayName,
        username,
        // purpose non più obbligatorio: lo passiamo solo se c’è
        ...(purpose ? { purpose } : {}),
        ...(city ? { city } : {}),
        ...(area ? { area } : {}),
        // se la UI lo richiede, di default mettiamo true
        termsAccepted: true,
      } as any);

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
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshMe, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
