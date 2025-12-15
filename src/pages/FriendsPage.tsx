// src/pages/FriendsPage.tsx

import React, { useEffect, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import {
  fetchFriends,
  fetchFriendRequestsReceived,
  fetchFriendRequestsSent,
  acceptFriendRequest,
  declineFriendRequest,
  User,
  FriendRequest,
} from "../api";
import { useAuth } from "../AuthContext";
import { useI18n } from "../LanguageContext";

function StatusDot({ state }: { state: string }) {
  const colors: Record<string, string> = {
    DISPONIBILE: "#4CAF50",
    OCCUPATO: "#F44336",
    ASSENTE: "#FF9800",
    OFFLINE: "#9E9E9E",
    INVISIBILE: "#BDBDBD",
    VISIBILE_A_TUTTI: "#2196F3",
  };

  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: colors[state] || "#9E9E9E",
        display: "inline-block",
        marginRight: 6,
      }}
    />
  );
}

function Avatar({ user }: { user: User }) {
  const initials = (user.displayName || user.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt="Avatar"
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid var(--tiko-purple)",
        }}
      />
    );
  }

  return <div className="tiko-avatar">{initials}</div>;
}

function getMoodColor(mood?: string | null): string {
  const map: Record<string, string> = {
    FELICE: "#facc15",
    TRISTE: "#3b82f6",
    STRESSATO: "#ec4899",
    ANNOIATO: "#6b7280",
    RILASSATO: "#22c55e",
    VOGLIA_DI_PARLARE: "#a855f7",
    CERCO_COMPAGNIA: "#14b8a6",
    VOGLIA_DI_RIDERE: "#f97316",
    CURIOSO: "#0ea5e9",
    MOTIVATO: "#eab308",
  };
  if (!mood) return "#4b5563";
  return map[mood] || "#4b5563";
}

const FriendsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  const [friends, setFriends] = useState<User[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tMood = (key?: string | null) => {
    if (!key) return "";
    const translated = t(`mood_${key}`);
    return translated === `mood_${key}` ? key : translated;
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsList, receivedList, sentList] = await Promise.all([
        fetchFriends(),
        fetchFriendRequestsReceived(),
        fetchFriendRequestsSent(),
      ]);
      setFriends(friendsList);
      setReceived(receivedList);
      setSent(sentList);
    } catch (err) {
      console.error(err);
      setError(t("friendsErrorLoad"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAccept = async (reqId: number) => {
    try {
      setActionMessage(null);
      await acceptFriendRequest(reqId);
      setActionMessage(t("friendsAcceptedMsg"));
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(t("friendsErrorLoad"));
    }
  };

  const handleDecline = async (reqId: number) => {
    try {
      setActionMessage(null);
      await declineFriendRequest(reqId);
      setActionMessage(t("friendsDeclinedMsg"));
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(t("friendsErrorLoad"));
    }
  };

  if (!user) return <div>Not authenticated</div>;

  return (
    <div className="tiko-layout">
      <Sidebar />

      <div
        className="tiko-content"
        style={{
          padding: 20,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <h1 className="tiko-title">{t("friendsTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--tiko-text-dim)" }}>
            {t("friendsSubtitle")}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#7F1D1D",
              color: "#FECACA",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {actionMessage && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#14532D",
              color: "#BBF7D0",
              fontSize: 13,
            }}
          >
            {actionMessage}
          </div>
        )}

        {/* Friends */}
        <section className="tiko-card">
          <h2 style={{ marginBottom: 10 }}>{t("friendsYourFriends")}</h2>

          {loading ? (
            <div>{t("friendsLoading")}</div>
          ) : friends.length === 0 ? (
            <div style={{ color: "var(--tiko-text-dim)" }}>
              {t("friendsNoFriends")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {friends.map((f) => {
                const moodLabel = f.mood ? tMood(f.mood) : null;
                const moodColor = getMoodColor(f.mood);

                return (
                  <div
                    key={f.id}
                    className="tiko-hover-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Avatar user={f} />

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <StatusDot state={f.state} />
                        <strong>{f.displayName}</strong>
                        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                          @{f.username}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 2 }}>
                        {moodLabel && (
                          <span
                            style={{
                              display: "inline-block",
                              backgroundColor: moodColor,
                              color: "#000",
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontSize: 11,
                              marginRight: 6,
                            }}
                          >
                            {moodLabel}
                          </span>
                        )}
                        {f.interests?.length ? `Interests: ${f.interests.join(", ")}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Received */}
        <section className="tiko-card">
          <h2 style={{ marginBottom: 10 }}>{t("friendsRequestsReceived")}</h2>

          {received.length === 0 ? (
            <div style={{ color: "var(--tiko-text-dim)" }}>
              {t("friendsNoRequestsReceived")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {received.map((r) => {
                const sender = r.sender;
                if (!sender) return null;

                const moodLabel = sender.mood ? tMood(sender.mood) : null;
                const moodColor = getMoodColor(sender.mood);

                return (
                  <div
                    key={r.id}
                    className="tiko-hover-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Avatar user={sender} />

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <StatusDot state={sender.state} />
                        <strong>{sender.displayName}</strong>
                        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                          @{sender.username}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 2 }}>
                        {t("friendsWantsToAddYou")}
                        {moodLabel && (
                          <span
                            style={{
                              display: "inline-block",
                              backgroundColor: moodColor,
                              color: "#000",
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontSize: 11,
                              marginLeft: 6,
                            }}
                          >
                            {moodLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleAccept(r.id)}
                        style={{
                          background: "var(--tiko-mint)",
                          color: "#000",
                          fontSize: 12,
                          padding: "6px 10px",
                        }}
                      >
                        {t("friendsAccept")}
                      </button>
                      <button
                        onClick={() => handleDecline(r.id)}
                        style={{
                          background: "var(--tiko-magenta)",
                          fontSize: 12,
                          padding: "6px 10px",
                        }}
                      >
                        {t("friendsDecline")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sent */}
        <section className="tiko-card">
          <h2 style={{ marginBottom: 10 }}>{t("friendsRequestsSent")}</h2>

          {sent.length === 0 ? (
            <div style={{ color: "var(--tiko-text-dim)" }}>
              {t("friendsNoRequestsSent")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sent.map((r) => {
                const receiver = r.receiver;
                if (!receiver) return null;

                const moodLabel = receiver.mood ? tMood(receiver.mood) : null;
                const moodColor = getMoodColor(receiver.mood);

                return (
                  <div
                    key={r.id}
                    className="tiko-hover-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Avatar user={receiver} />

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <StatusDot state={receiver.state} />
                        <strong>{receiver.displayName}</strong>
                        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--tiko-text-dim)" }}>
                          @{receiver.username}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 2 }}>
                        {t("friendsPending")}
                        {moodLabel && (
                          <span
                            style={{
                              display: "inline-block",
                              backgroundColor: moodColor,
                              color: "#000",
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontSize: 11,
                              marginLeft: 6,
                            }}
                          >
                            {moodLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FriendsPage;
