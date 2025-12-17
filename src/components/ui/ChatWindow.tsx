// src/components/ui/ChatWindow.tsx

import React, { useEffect, useRef, useState } from "react";
import { Conversation, Message, User, uploadImage, uploadAudio } from "../../api";

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

function isImageUrl(content: string): boolean {
  return /^(https?:\/\/|\/).+\.(png|jpe?g|gif|webp|avif|svg)$/i.test(content);
}
function isAudioUrl(content: string): boolean {
  return /^(https?:\/\/|\/).+\.(mp3|ogg|wav|webm|m4a)$/i.test(content);
}

function formatMood(mood?: string | null): string | null {
  if (!mood) return null;
  const map: Record<string, string> = {
    FELICE: "Happy",
    TRISTE: "Sad",
    STRESSATO: "Stressed",
    ANNOIATO: "Bored",
    RILASSATO: "Relaxed",
    VOGLIA_DI_PARLARE: "Wants to talk",
    CERCO_COMPAGNIA: "Looking for company",
    VOGLIA_DI_RIDERE: "Wants to laugh",
    CURIOSO: "Curious",
    MOTIVATO: "Motivated",
  };
  return map[mood] || mood;
}

function AvatarBubble({ user, size = 34 }: { user: User | null; size?: number }) {
  const border = "1px solid rgba(255,255,255,0.12)";
  const shadow = "0 6px 18px rgba(0,0,0,0.35)";

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt="avatar"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border,
          boxShadow: shadow,
          flex: "0 0 auto",
        }}
      />
    );
  }

  const initials = (user?.displayName || user?.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border,
        boxShadow: shadow,
        background: "linear-gradient(140deg, var(--tiko-purple), var(--tiko-blue))",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: Math.max(12, Math.floor(size * 0.35)),
        flex: "0 0 auto",
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}

function formatTime(value?: any): string {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  currentUser: User;
  typingUserId: number | null;
  onSend: (content: string) => void;
  onTyping: () => void;
  onDeleteConversation?: () => void;
  onBack?: () => void; // mobile back
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  currentUser,
  typingUserId,
  onSend,
  onTyping,
  onDeleteConversation,
  onBack,
}) => {
  const [input, setInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!conversation) {
    return <div style={{ height: "100%", padding: 24 }}>Select a conversation</div>;
  }

  const other =
    conversation.participants
      .map((p) => p.user)
      .find((u) => u && u.id !== currentUser.id) || null;

  const otherMood = formatMood(other?.mood);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  const handleAttachImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const url = await uploadImage(file);
      onSend(url);
    } catch {
      alert("Image upload error");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const toggleRecording = async () => {
    if (!recording) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        try {
          setUploadingAudio(true);
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const file = new File([blob], "audio.webm", { type: "audio/webm" });
          const url = await uploadAudio(file);
          onSend(url);
        } catch {
          alert("Audio send error");
        } finally {
          setUploadingAudio(false);
          stream.getTracks().forEach((t) => t.stop());
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } else {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* HEADER */}
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid #222",
          background: "var(--tiko-bg-gray)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  border: "1px solid #444",
                  background: "transparent",
                  borderRadius: 10,
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            )}
            <StatusDot state={other?.state || "OFFLINE"} />
            <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {other?.displayName || "Conversation"}
            </strong>
          </div>

          <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 2 }}>
            {otherMood ? `Mood: ${otherMood} • ` : ""}
            {other?.interests?.length ? `Interests: ${other.interests.join(", ")}` : ""}
          </div>

          {typingUserId && typingUserId !== currentUser.id && (
            <div style={{ fontSize: 12, color: "var(--tiko-blue)", marginTop: 4 }}>
              Typing…
            </div>
          )}
        </div>

        {onDeleteConversation && (
          <button
            onClick={onDeleteConversation}
            style={{
              border: "1px solid #444",
              background: "transparent",
              borderRadius: 20,
              padding: "6px 12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Delete chat"
          >
            Delete
          </button>
        )}
      </div>

      {/* MESSAGES */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          padding: 16,
          overflowY: "auto",
          background: "var(--tiko-bg-dark)",
          minHeight: 0,
        }}
      >
        {messages.map((m) => {
          const mine = m.senderId === currentUser.id;
          const img = isImageUrl(m.content);
          const aud = isAudioUrl(m.content);

          // sender info
          const senderUser: User | null = mine ? currentUser : (m.sender as any) || other || null;

          // time + ticks (ticks only for mine)
          const timeStr = formatTime((m as any).createdAt);
          const ticks = mine ? "\u2713\u2713" : ""; // ✓✓ delivered (no read receipts yet)

          // "sfalsato": no bordi estremi
          // mine: spostato a destra ma non attaccato
          // others: spostato a sinistra ma non attaccato
          const rowPaddingStyle = mine
            ? { marginLeft: "25%", marginRight: 6 }
            : { marginRight: "25%", marginLeft: 6 };

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 10,
                ...rowPaddingStyle,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: mine ? "row-reverse" : "row",
                  alignItems: "flex-end",
                  gap: 10,
                  maxWidth: "100%",
                }}
              >
                <AvatarBubble user={senderUser} size={34} />

                <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  {/* Bubble */}
                  <div
                    style={{
                      maxWidth: "72vw",
                      width: "fit-content",
                      background: mine ? "var(--tiko-purple)" : "var(--tiko-bg-card)",
                      color: mine ? "#fff" : "var(--tiko-text)",
                      padding: img || aud ? 8 : 10,
                      borderRadius: 16,
                      border: mine ? "1px solid rgba(255,255,255,0.10)" : "1px solid #2a2a2a",
                      boxShadow: mine
                        ? "0 10px 24px rgba(122,41,255,0.28)"
                        : "0 10px 24px rgba(0,0,0,0.28)",
                      position: "relative",
                    }}
                  >
                    {!mine && (
                      <div style={{ fontSize: 11, color: "var(--tiko-text-dim)", marginBottom: 4 }}>
                        {senderUser?.displayName || "User"}
                      </div>
                    )}

                    {img ? (
                      <img
                        src={m.content}
                        alt="img"
                        style={{
                          maxWidth: "min(320px, 70vw)",
                          width: "100%",
                          borderRadius: 12,
                          display: "block",
                        }}
                      />
                    ) : aud ? (
                      <audio controls src={m.content} style={{ width: "min(320px, 70vw)" }} />
                    ) : (
                      <div style={{ lineHeight: 1.35, wordBreak: "break-word" }}>{m.content}</div>
                    )}

                    {/* Bubble tail */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 10,
                        [mine ? "right" : "left"]: -6,
                        width: 0,
                        height: 0,
                        borderTop: "6px solid transparent",
                        borderBottom: "6px solid transparent",
                        borderLeft: mine ? "6px solid transparent" : "6px solid var(--tiko-bg-card)",
                        borderRight: mine ? "6px solid var(--tiko-purple)" : "6px solid transparent",
                        filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.25))",
                      } as any}
                    />
                  </div>

                  {/* Meta: time + ticks */}
                  {(timeStr || ticks) && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: "var(--tiko-text-dim)",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      {timeStr && <span>{timeStr}</span>}
                      {ticks && <span style={{ letterSpacing: 1 }}>{ticks}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT */}
      <form
        onSubmit={handleSubmit}
        style={{
          borderTop: "1px solid #222",
          padding: 10,
          display: "flex",
          gap: 8,
          background: "var(--tiko-bg-gray)",
          alignItems: "center",
        }}
      >
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          +
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleAttachImage}
        />

        <button type="button" onClick={toggleRecording}>
          {recording ? "Stop" : "Audio"}
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onTyping}
          placeholder="Type a message…"
          style={{ flex: 1, minWidth: 0 }}
        />

        <button type="submit" disabled={!input.trim()}>
          Send
        </button>
      </form>

      {(uploadingImage || uploadingAudio) && (
        <div style={{ fontSize: 12, padding: 6 }}>Sending…</div>
      )}
    </div>
  );
};

export default ChatWindow;
