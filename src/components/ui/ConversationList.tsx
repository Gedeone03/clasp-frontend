import React from "react";
import { Conversation } from "../../api";
import { useAuth } from "../../AuthContext";

type Props = {
  conversations: Conversation[];
  selectedConversationId: number | null;
  onSelect: (conv: Conversation) => void;
  unreadCounts?: Record<number, number>;
};

function clip(s: string, n: number) {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

export default function ConversationList({
  conversations,
  selectedConversationId,
  onSelect,
  unreadCounts,
}: Props) {
  const { user } = useAuth();
  const myId = user?.id;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      {conversations.map((conv) => {
        const unread = unreadCounts?.[conv.id] ?? 0;

        const other = conv.participants
          ?.map((p: any) => p.user)
          ?.find((u: any) => u && u.id !== myId);

        const last = conv.messages?.[0] as any | undefined;
        const lastText = last?.deletedAt ? "Messaggio eliminato" : last?.content || "";

        const isSelected = selectedConversationId === conv.id;

        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv)}
            style={{
              padding: 12,
              borderBottom: "1px solid #222",
              cursor: "pointer",
              background: isSelected ? "var(--tiko-bg-card)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {other?.displayName || "Conversazione"}
              </div>
              <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {clip(lastText, 42)}
              </div>
            </div>

            {/* Badge unread */}
            {unread > 0 && (
              <div
                style={{
                  minWidth: 22,
                  height: 22,
                  padding: "0 7px",
                  borderRadius: 999,
                  background: "#ff3b30",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
                title="Messaggi non letti"
              >
                {unread > 99 ? "99+" : unread}
              </div>
            )}
          </div>
        );
      })}

      {conversations.length === 0 && (
        <div style={{ padding: 12, color: "var(--tiko-text-dim)" }}>Nessuna chat</div>
      )}
    </div>
  );
}
