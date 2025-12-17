// src/components/ui/ChatWindow.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Conversation, Message, User, uploadImage, uploadAudio } from "../../api";
import { API_BASE_URL } from "../../config";

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

function formatTime(value?: any): string {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return "";
  }
}

function useIsMobile(breakpointPx: number = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isMobile;
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

type MessageLike = Message & {
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: number | null;
  replyTo?: any | null;
};

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: MessageLike[];
  currentUser: User;
  typingUserId: number | null;
  onSend: (content: string) => void;
  onTyping: () => void;
  onDeleteConversation?: () => void;
  onBack?: () => void;

  // ✅ opzionale: se HomePage lo passa, inviamo replyToId “vero”
  onSendWithReply?: (content: string, replyToId: number | null) => void;
}

export default function ChatWindow({
  conversation,
  messages,
  currentUser,
  typingUserId,
  onSend,
  onTyping,
  onDeleteConversation,
  onBack,
  onSendWithReply,
}: ChatWindowProps) {
  const isMobile = useIsMobile(900);

  const [input, setInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // UI state for actions
  const [activeActionMsgId, setActiveActionMsgId] = useState<number | null>(null);

  // reply/edit modes
  const [replyTo, setReplyTo] = useState<MessageLike | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageLike | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // sfalsamento dinamico
  const STAGGER = isMobile ? 25 : 14;

  const baseUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ""), []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    // quando cambi conversazione, resetta modalità reply/edit
    setReplyTo(null);
    setEditingMsg(null);
    setActiveActionMsgId(null);
    setInput("");
  }, [conversation?.id]);

  if (!conversation) {
    return <div style={{ height: "100%", padding: 24 }}>Select a conversation</div>;
  }

  const other =
    conversation.participants
      .map((p: any) => p.user)
      .find((u: any) => u && u.id !== currentUser.id) || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    // EDIT mode
    if (editingMsg) {
      try {
        await patchMessage(editingMsg.id, text);
        setEditingMsg(null);
        setInput("");
      } catch (err) {
        console.error(err);
        alert("Edit failed");
      }
      return;
    }

    // REPLY mode (prefer onSendWithReply if provided)
    if (replyTo && onSendWithReply) {
      onSendWithReply(text, replyTo.id);
      setReplyTo(null);
      setInput("");
      return;
    }

    // fallback: normal send
    onSend(text);
    setReplyTo(null);
    setInput("");
  };

  const handleAttachImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const url = await uploadImage(file);
      if (replyTo && onSendWithReply) {
        onSendWithReply(url, replyTo.id);
        setReplyTo(null);
      } else {
        onSend(url);
        setReplyTo(null);
      }
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

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        try {
          setUploadingAudio(true);
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const file = new File([blob], "audio.webm", { type: "audio/webm" });
          const url = await uploadAudio(file);

          if (replyTo && onSendWithReply) {
            onSendWithReply(url, replyTo.id);
            setReplyTo(null);
          } else {
            onSend(url);
            setReplyTo(null);
          }
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

  async function patchMessage(messageId: number, content: string) {
    const token = localStorage.getItem("token");
    const r = await fetch(`${baseUrl}/messages/${messageId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });
    if (!r.ok) throw new Error(`PATCH failed: ${r.status}`);
    return await r.json();
  }

  async function deleteMessage(messageId: number) {
    const token = localStorage.getItem("token");
    const r = await fetch(`${baseUrl}/messages/${messageId}`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!r.ok) throw new Error(`DELETE failed: ${r.status}`);
    return await r.json();
  }

  const renderQuoted = (msg: MessageLike) => {
    if (!msg.replyTo) return null;
    const rt = msg.replyTo;
    const rtText = rt.deletedAt ? "Message deleted" : (rt.content || "");
    const rtName = rt.sender?.displayName || "User";
    return (
      <div
        style={{
          borderLeft: "3px solid rgba(255,255,255,0.25)",
          paddingLeft: 8,
          marginBottom: 6,
          opacity: 0.9,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 2 }}>{rtName}</div>
        <div style={{ color: "rgba(255,255,255,0.85)" }}>{rtText.slice(0, 120)}</div>
      </div>
    );
  };

  const renderContent = (m: MessageLike) => {
    if (m.deletedAt) {
      return <div style={{ fontStyle: "italic", opacity: 0.85 }}>Message deleted</div>;
    }
    if (isImageUrl(m.content)) {
      return (
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
      );
    }
    if (isAudioUrl(m.content)) {
      return <audio controls src={m.content} style={{ width: "min(320px, 70vw)" }} />;
    }
    return <div style={{ lineHeight: 1.35, wordBreak: "break-word" }}>{m.content}</div>;
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
                  fontWeight: 800,
                }}
                aria-label="Back"
              >
                ←
              </button>
            )}
            <StatusDot state={other?.state || "OFFLINE"} />
            <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {other?.displayName || "Conversation"}
            </strong>
          </div>

          <div style={{ fontSize: 12, color: "var(--tiko-text-dim)", marginTop: 2 }}>
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
          const senderUser: User | null = mine ? currentUser : ((m as any).sender as any) || other || null;

          const timeStr = formatTime((m as any).createdAt);
          const ticks = mine ? "\u2713\u2713" : "";

          const rowPaddingStyle = mine
            ? { marginLeft: `${STAGGER}%`, marginRight: 6 }
            : { marginRight: `${STAGGER}%`, marginLeft: 6 };

          const showActions = activeActionMsgId === m.id;

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
                    onClick={() => setActiveActionMsgId((prev) => (prev === m.id ? null : m.id))}
                    style={{
                      maxWidth: "72vw",
                      width: "fit-content",
                      background: mine ? "var(--tiko-purple)" : "var(--tiko-bg-card)",
                      color: mine ? "#fff" : "var(--tiko-text)",
                      padding: 10,
                      borderRadius: 16,
                      border: mine ? "1px solid rgba(255,255,255,0.10)" : "1px solid #2a2a2a",
                      boxShadow: mine
                        ? "0 10px 24px rgba(122,41,255,0.28)"
                        : "0 10px 24px rgba(0,0,0,0.28)",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    title="Tap for actions"
                  >
                    {!mine && (
                      <div style={{ fontSize: 11, color: "var(--tiko-text-dim)", marginBottom: 4 }}>
                        {senderUser?.displayName || "User"}
                      </div>
                    )}

                    {/* Quoted reply */}
                    {renderQuoted(m)}

                    {/* Body */}
                    {renderContent(m)}

                    {/* edited badge */}
                    {m.editedAt && !m.deletedAt && (
                      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85 }}>(edited)</div>
                    )}
                  </div>

                  {/* Actions mini menu */}
                  {showActions && (
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(m);
                          setEditingMsg(null);
                          setActiveActionMsgId(null);
                        }}
                        style={{ fontSize: 12 }}
                      >
                        Reply
                      </button>

                      {mine && !m.deletedAt && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMsg(m);
                              setReplyTo(null);
                              setInput(m.content || "");
                              setActiveActionMsgId(null);
                            }}
                            style={{ fontSize: 12 }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const ok = window.confirm("Delete this message?");
                              if (!ok) return;
                              try {
                                await deleteMessage(m.id);
                                setActiveActionMsgId(null);
                              } catch (e) {
                                console.error(e);
                                alert("Delete failed");
                              }
                            }}
                            style={{ fontSize: 12, background: "var(--tiko-magenta)" }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Meta */}
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

      {/* Composer bar: Reply/Edit preview */}
      {(replyTo || editingMsg) && (
        <div
          style={{
            padding: 10,
            borderTop: "1px solid #222",
            background: "var(--tiko-bg-gray)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
            {replyTo && (
              <>
                <strong>Replying to:</strong>{" "}
                {(replyTo as any)?.sender?.displayName || (other?.displayName ?? "User")} —{" "}
                {(replyTo.deletedAt ? "Message deleted" : replyTo.content || "").slice(0, 80)}
              </>
            )}
            {editingMsg && (
              <>
                <strong>Editing message</strong>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setReplyTo(null);
              setEditingMsg(null);
              setInput("");
            }}
            style={{ fontSize: 12 }}
          >
            X
          </button>
        </div>
      )}

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
          placeholder={editingMsg ? "Edit message…" : replyTo ? "Reply…" : "Type a message…"}
          style={{ flex: 1, minWidth: 0 }}
        />

        <button type="submit" disabled={!input.trim()}>
          {editingMsg ? "Save" : "Send"}
        </button>
      </form>

      {(uploadingImage || uploadingAudio) && <div style={{ fontSize: 12, padding: 6 }}>Sending…</div>}
    </div>
  );
}
