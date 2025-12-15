// src/pages/AuthPage.tsx

import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../LanguageContext";

const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [mode, setMode] = useState<"login" | "register">("login");

  // LOGIN
  const [loginEmailOrUsername, setLoginEmailOrUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // REGISTER
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regArea, setRegArea] = useState("");
  const [regTerms, setRegTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        if (!loginEmailOrUsername || !loginPassword) {
          setError(t("authRequiredLogin"));
          return;
        }

        await login(loginEmailOrUsername, loginPassword);
      } else {
        if (!regEmail || !regPassword || !regDisplayName || !regUsername) {
          setError(t("authRequiredRegister"));
          return;
        }

        if (!regTerms) {
          setError(t("authMustAcceptTerms"));
          return;
        }

        await register(
          regEmail,
          regPassword,
          regDisplayName,
          regUsername,
          regCity || undefined,
          regArea || undefined,
          true
        );
      }

      navigate("/");
    } catch (err: any) {
      console.error("AUTH ERROR:", err?.response || err);
      setError(err?.response?.data?.error || "Request error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "40px auto",
        padding: 20,
        borderRadius: 16,
        background: "var(--tiko-bg-card)",
        boxShadow: "var(--tiko-glow)",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: 20,
        }}
        className="tiko-title"
      >
        {t("appName")}
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setMode("login")}
          style={{
            flex: 1,
            background:
              mode === "login" ? "var(--tiko-purple)" : "var(--tiko-bg-gray)",
          }}
        >
          {t("authLoginTab")}
        </button>

        <button
          type="button"
          onClick={() => setMode("register")}
          style={{
            flex: 1,
            background:
              mode === "register"
                ? "var(--tiko-purple)"
                : "var(--tiko-bg-gray)",
          }}
        >
          {t("authRegisterTab")}
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mode === "login" ? (
          <>
            <input
              type="text"
              placeholder={t("authEmailOrUsername")}
              value={loginEmailOrUsername}
              onChange={(e) => setLoginEmailOrUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder={t("authPassword")}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </>
        ) : (
          <>
            <input
              type="email"
              placeholder={t("authEmail")}
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder={t("authPassword")}
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
            />
            <input
              type="text"
              placeholder={t("authDisplayName")}
              value={regDisplayName}
              onChange={(e) => setRegDisplayName(e.target.value)}
            />
            <input
              type="text"
              placeholder={t("authUsername")}
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
            />
            <input
              type="text"
              placeholder={t("authCityOptional")}
              value={regCity}
              onChange={(e) => setRegCity(e.target.value)}
            />
            <input
              type="text"
              placeholder={t("authAreaOptional")}
              value={regArea}
              onChange={(e) => setRegArea(e.target.value)}
            />

            <label style={{ fontSize: 13, marginTop: 4 }}>
              <input
                type="checkbox"
                checked={regTerms}
                onChange={(e) => setRegTerms(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              {t("authAcceptTermsPrefix")}{" "}
              <a href="/terms" target="_blank" style={{ color: "var(--tiko-blue)" }}>
                {t("authTerms")}
              </a>{" "}
              {t("authAnd")}{" "}
              <a href="/privacy" target="_blank" style={{ color: "var(--tiko-blue)" }}>
                {t("authPrivacy")}
              </a>
            </label>
          </>
        )}

        {error && <div style={{ color: "red" }}>{error}</div>}

        <button type="submit" disabled={submitting} style={{ marginTop: 8 }}>
          {submitting
            ? t("authWait")
            : mode === "login"
            ? t("authEnter")
            : t("authCreateAccount")}
        </button>
      </form>
    </div>
  );
};

export default AuthPage;
