// src/main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./AuthContext";
import { LanguageProvider } from "./LanguageContext";

import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import FriendsPage from "./pages/FriendsPage";
import ProfilePage from "./pages/ProfilePage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import SettingsPage from "./pages/SettingsPage";
import MoodConnectPage from "./pages/MoodConnectPage";

import "./index.css";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ color: "var(--tiko-blue)" }}>Loading…</h2>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      <Route path="/auth" element={<AuthPage />} />

      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <FriendsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mood"
        element={
          <ProtectedRoute>
            <MoodConnectPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);
// PWA: register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.error("SW registration failed", err));
  });
}
