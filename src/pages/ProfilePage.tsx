// src/pages/ProfilePage.tsx

import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import { useAuth } from "../AuthContext";
import { updateMe, uploadAvatar, User } from "../api";
import { useI18n } from "../LanguageContext";

const VALID_STATES = [
  "DISPONIBILE",
  "OCCUPATO",
  "ASSENTE",
  "OFFLINE",
  "INVISIBILE",
  "VISIBILE_A_TUTTI",
];

const VALID_INTERESTS = [
  "LAVORO",
  "AMICIZIA",
  "CHATTARE",
  "DATING",
  "INCONTRI",
];

// Solo chiavi mood (le label le prendiamo da i18n)
const VALID_MOOD_KEYS = [
  "FELICE",
  "TRISTE",
  "STRESSATO",
  "ANNOIATO",
  "RILASSATO",
  "VOGLIA_DI_PARLARE",
  "CERCO_COMPAGNIA",
  "VOGLIA_DI_RIDERE",
  "CURIOSO",
  "MOTIVATO",
];

function StatusDot({ state }: { state: string }) {
  const colors: Record<string, string> = {
    DISPONIBILE: "#4CAF50",
    OCCUPATO: "#F44336",
    ASSENTE: "#FF9800",
    OFFLINE: "#9E9E9E",
    INVISIBILE: "#BDBDBD",
    VISIBILE_A_TUTTI: "#2196F3",
  };

  const color = colors[state] || "#9E9E9E";

  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        marginRight: 8,
        border: "2px solid #111",
        boxShadow: `0 0 10px ${color}`,
      }}
    />
  );
}

const ProfilePage: React.FC = () => {
  const { user, setUser, logout } = useAuth();
  const { t } = useI18n();

  const [profileState, setProfileState] = useState("OFFLINE");
  const [statusText, setStatusText] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mood, setMood] = useState<string | undefined>(undefined);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper: traduce mood dalla chiave (es. FELICE -> t(mood_FELICE))
  const tMood = (key?: string | null) => {
    if (!key) return "";
    const label = t(`mood_${key}`);
    return label === `mood_${key}` ? key : label;
  };

  useEffect(() => {
    if (!user) return;
    setProfileState(user.state);
    setStatusText(user.statusText || "");
    setCity(user.city || "");
    setArea(user.area || "");
    setInterests(user.interests || []);
    setAvatarUrl(user.avatarUrl || null);
    setMood(user.mood || undefined);
  }, [user]);

  if (!user) return <div>Not authenticated</div>;

  const toggleInterest = (interest: string) => {
    setSaved(false);
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const updated: User = await updateMe({
        state: profileState,
        statusText: statusText || undefined,
        city: city || undefined,
        area: area || undefined,
        interests,
        avatarUrl: avatarUrl || undefined,
        mood: mood || undefined,
      });
      setUser(updated);
      setSaved(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleClickChangeAvatar = () => fileInputRef.current?.click();

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      setSaved(false);
    } catch {
      setError("Avatar upload error");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  return (
    <div className="tiko-layout">
      <Sidebar />

      <div className="tiko-content" style={{ padding: 24, overflowY: "auto" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <h1 className="tiko-title">{t("profileTitle")}</h1>
          <button onClick={logout} style={{ background: "var(--tiko-magenta)" }}>
            {t("profileLogout")}
          </button>
        </div>

        {/* Card avatar + info */}
        <div
          className="tiko-card"
          style={{
            marginBottom: 20,
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  objectFit: "cover",
                  boxShadow: "var(--tiko-glow)",
                  border: "2px solid var(--tiko-purple)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(140deg, var(--tiko-purple), var(--tiko-blue))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 26,
                  color: "white",
                  textShadow: "var(--tiko-glow)",
                }}
              >
                {(user.displayName || user.username)
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}

            <button
              type="button"
              onClick={handleClickChangeAvatar}
              style={{
                position: "absolute",
                bottom: -4,
                right: -4,
                background: "var(--tiko-purple)",
                borderRadius: "50%",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
              title={t("profileChangePhoto")}
            >
              📷
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarFileChange}
            />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 4 }}>
              <strong>{t("profileName")}:</strong> {user.displayName}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>{t("profileUsername")}:</strong> @{user.username}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>{t("profileEmail")}:</strong> {user.email}
            </div>
            {user.mood && (
              <div style={{ marginTop: 6, fontSize: 13, color: "var(--tiko-text-dim)" }}>
                <strong>{t("profileCurrentMood")}:</strong> {tMood(user.mood)}
              </div>
            )}
          </div>
        </div>

        {/* Card settings */}
        <div className="tiko-card">
          <h2 style={{ marginBottom: 12 }}>{t("profileSectionTitle")}</h2>

          <form
            onSubmit={handleSave}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {/* Stato (presenza) */}
            <div>
              <label>
                <strong>{t("profileStatus")}</strong>
              </label>
              <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                {/* FIX: usa profileState e glow visibile */}
                <StatusDot state={profileState} />
                <select
                  style={{ flex: 1 }}
                  value={profileState}
                  onChange={(e) => setProfileState(e.target.value)}
                >
                  {VALID_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status text */}
            <div>
              <label>
                <strong>{t("profileStatusText")}</strong>
              </label>
              <input
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder={t("profileStatusTextPh")}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>

            {/* Mood */}
            <div>
              <label>
                <strong>{t("profileMood")}</strong>
              </label>
              <select
                style={{ width: "100%", marginTop: 4 }}
                value={mood || ""}
                onChange={(e) => setMood(e.target.value === "" ? undefined : e.target.value)}
              >
                <option value="">{t("profileMoodNone")}</option>
                {VALID_MOOD_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {tMood(key)}
                  </option>
                ))}
              </select>
            </div>

            {/* City/Area */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label>
                  <strong>{t("profileCity")}</strong>
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("profileCityPh")}
                  style={{ width: "100%", marginTop: 4 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>
                  <strong>{t("profileArea")}</strong>
                </label>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder={t("profileAreaPh")}
                  style={{ width: "100%", marginTop: 4 }}
                />
              </div>
            </div>

            {/* Interests */}
            <div>
              <label>
                <strong>{t("profileInterests")}</strong>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {VALID_INTERESTS.map((interest) => (
                  <label
                    key={interest}
                    style={{
                      border: "1px solid #444",
                      borderRadius: 20,
                      padding: "6px 10px",
                      fontSize: 13,
                      background: interests.includes(interest)
                        ? "var(--tiko-purple)"
                        : "transparent",
                      color: interests.includes(interest)
                        ? "#fff"
                        : "var(--tiko-text-dim)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={interests.includes(interest)}
                      onChange={() => toggleInterest(interest)}
                      style={{ marginRight: 6 }}
                    />
                    {interest}
                  </label>
                ))}
              </div>
            </div>

            {uploadingAvatar && (
              <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                {t("profileUploadingAvatar")}
              </div>
            )}

            {error && <div style={{ color: "red" }}>{error}</div>}

            {saved && !error && (
              <div style={{ color: "var(--tiko-mint)" }}>
                {t("profileSavedOk")}
              </div>
            )}

            <button type="submit" disabled={saving} style={{ width: 180 }}>
              {saving ? t("profileSaving") : t("profileSave")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
