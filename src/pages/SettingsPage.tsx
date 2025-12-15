// src/pages/SettingsPage.tsx

import React from "react";
import Sidebar from "../components/ui/Sidebar";
import { useAuth } from "../AuthContext";
import { useI18n } from "../LanguageContext";

const APP_VERSION = "0.1.0";

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();

  if (!user) return <div>Not authenticated</div>;

  return (
    <div className="tiko-layout">
      <Sidebar />

      <div
        className="tiko-content"
        style={{
          padding: 24,
          overflowY: "auto",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* Contenitore centrale */}
        <div style={{ width: "100%", maxWidth: 820, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <h1 className="tiko-title" style={{ margin: 0 }}>
              {t("settingsTitle")}
            </h1>

            <button
              onClick={logout}
              style={{ background: "var(--tiko-magenta)" }}
            >
              {t("settingsLogout")}
            </button>
          </div>

          {/* Lingua */}
          <div className="tiko-card">
            <h2 style={{ marginBottom: 10 }}>{t("settingsLanguage")}</h2>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as any)}
                style={{ width: 260 }}
              >
                <option value="it">{t("settingsLanguageIt")}</option>
                <option value="en">{t("settingsLanguageEn")}</option>
              </select>

              <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                La scelta viene salvata automaticamente.
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="tiko-card">
            <h2 style={{ marginBottom: 10 }}>{t("settingsAccount")}</h2>

            <div style={{ fontSize: 14 }}>
              <div>
                <strong>{t("profileName")}:</strong> {user.displayName}
              </div>
              <div>
                <strong>{t("profileUsername")}:</strong> @{user.username}
              </div>
              <div>
                <strong>{t("profileEmail")}:</strong> {user.email}
              </div>
              <div>
                <strong>ID:</strong> {user.id}
              </div>
            </div>
          </div>

          {/* Info + Legal */}
          <div className="tiko-card">
            <h2 style={{ marginBottom: 10 }}>{t("settingsAbout")}</h2>

            <div style={{ fontSize: 14, color: "var(--tiko-text-dim)" }}>
              <div>
                <strong>{t("settingsVersion")}:</strong> {APP_VERSION}
              </div>

              <div style={{ marginTop: 10 }}>
                <a href="/privacy" style={{ color: "var(--tiko-blue)" }}>
                  {t("authPrivacy")}
                </a>{" "}
                •{" "}
                <a href="/terms" style={{ color: "var(--tiko-blue)" }}>
                  {t("authTerms")}
                </a>
              </div>

              <div style={{ marginTop: 10 }}>
                CLASP è una piattaforma di chat e amicizie in tempo reale. Questa è una versione in sviluppo (beta).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
