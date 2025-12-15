// src/components/ui/ConversationList.tsx

import React from "react";
import { Conversation, User } from "../../api";
import { useAuth } from "../../AuthContext";
import { useI18n } from "../../LanguageContext";

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
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[state] || "#9E9E9E",
        display: "inline-block",
        marginRight: 4,
      }}
    />
  );
}

function Avatar({ user }: { user: User | null }) {
  if (!user) return <div className="tiko-avatar">?</div>;

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

  const initials = (user.displayName || user.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId: number | null;
  onSelect: (conv: Conversation) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelect,
}) => {
  const { user } = useAuth();
  const { t } = useI18n();

  const tMood = (key?: string | null) => {
    if (!key) return "";
    const translated = t(`mood_${key}`);
    return translated === `mood_${key}` ? key : translated;
  };

  if (!user) return null;

  return (
    <div style={{ overflowY: "auto", borderTop: "1px solid #222", borderBottom: "1px solid #222" }}>
      {conversations.length === 0 && (
        <div style={{ padding: 12, color: "var(--tiko-text-dim)" }}>
          No conversations
        </div>
      )}

      {conversations.map((conv) => {
        const other = conv.participants
          .map((p) => p.user)
          .find((u) => u && u.id !== user.id) as User | null;

        const last = conv.messages[0];
        const isSelected = selectedConversationId === conv.id;

        const moodLabel = other?.mood ? tMood(other.mood) : null;
        const moodColor = getMoodColor(other?.mood);

        return (
          <div
            key={conv.id}
            className="tiko-hover-item"
            onClick={() => onSelect(conv)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 10,
              cursor: "pointer",
              background: isSelected ? "rgba(122, 41, 255, 0.2)" : "transparent",
              borderBottom: "1px solid #222",
            }}
          >
            <Avatar user={other} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                <StatusDot state={other?.state || "OFFLINE"} />
                <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {other?.displayName || "Conversation"}
                </span>
              </div>

              {moodLabel && (
                <div style={{ fontSize: 11, color: "var(--tiko-text-dim)", marginBottom: 2 }}>
                  <span
                    style={{
                      display: "inline-block",
                      backgroundColor: moodColor,
                      color: "#000",
                      borderRadius: 999,
                      padding: "2px 8px",
                      fontSize: 11,
                    }}
                  >
                    {moodLabel}
                  </span>
                </div>
              )}

              {last && (
                <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {last.content}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;
