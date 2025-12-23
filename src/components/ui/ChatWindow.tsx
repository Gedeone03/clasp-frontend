import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../../config";

type AnyUser = any;
type AnyMessage = any;
type AnyConversation = any;

function getToken(): string {
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    ""
  );
}

function isImageUrl(s: string) {
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(s) || s.includes("/uploads/") && /image/i.test(s);
}

function parseTaggedContent(content: string) {
  // Supporto semplice senza cambiare struttura:
  // [img] URL
  // [audio] URL
  // [file] filename URL
  const t = (content || "").trim();
  if (t.toLowerCase().startsWith("[img]")) {
    const url = t.slice(5).trim();
    return { kind: "img" as const, url };
  }
  if (t.toLowerCase().startsWith("[audio]")) {
    const url = t.slice(7).trim();
    return { kind: "audio" as const, url };
  }
  if (t.toLowerCase().startsWith("[file]")) {
    const rest = t.slice(6).trim();
    const parts = rest.split(/\s+/);
    if (parts.length >= 2) {
      const url = parts[parts.length - 1];
      const name = parts.slice(0, -1).join(" ");
      return { kind: "file" as const, url, name };
    }
    return { kind: "text" as const, text: t };
  }
  if (/^https?:\/\//i.test(t) && isImageUrl(t)) return { kind: "img" as const, url: t };
  return { kind: "text" as const, text: content };
}

async function uploadTo(endpoint: string, file: File): Promise<string> {
  const token = getToken();
  const fd = new FormData();

  // Appendiamo più nomi campo per compatibilità backend (multer field name)
  fd.append("file", file);
  fd.append("image", file);
  fd.append("audio", file);

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Upload failed: HTTP ${res.status}`);
  }

  const data = await res.json().catch(() => ({} as any));
  const url = data?.url || data?.fileUrl || data?.path || data?.location;
  if (!url) throw new Error("Upload ok ma risposta senza URL.");
  return url;
}

async function sendMessage(conversationId: number, content: string, replyToId?: number | null): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content, replyToId: replyToId ?? null }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Send failed: HTTP ${res.status}`);
  }
  return res.json();
}

export default function ChatWindow({
  conversationId,
  conversation,
  currentUser,
  messages,
  onBack,
}: {
  conversationId?: number;
  conversation?: AnyConversation | null;
  currentUser?: AnyUser | null;
  messages?: AnyMessage[];
  onBack?: (() => void) | undefined;
}) {
  const convId = Number(conversationId || conversation?.id || 0);

  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => {
    const arr = Array.isArray(messages) ? [...messages] : [];
    arr.sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime();
      const tb = new Date(b?.createdAt || 0).getTime();
      return ta - tb;
    });
    return arr;
  }, [messages]);

  useEffect(() => {
    // scroll giù quando arrivano messaggi
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [sorted.length]);

  async function handleSend() {
    const content = text.trim();
    if (!content) return;
    if (!convId) {
      setErr("ConversationId mancante: non posso inviare.");
      return;
    }

    setErr(null);
    setBusy(true);
    try {
      await sendMessage(convId, content, null);
      setText("");
    } catch (e: any) {
      setErr(e?.message || "Errore invio messaggio");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!convId) {
      setErr("ConversationId mancante: non posso inviare file.");
      return;
    }

    setErr(null);
    setBusy(true);

    try {
      let url = "";

      // immagini -> /upload/image
      if (f.type.startsWith("image/")) {
        url = await uploadTo("/upload/image", f);
        await sendMessage(convId, `[img] ${url}`, null);
      }
      // audio -> /upload/audio
      else if (f.type.startsWith("audio/")) {
        url = await uploadTo("/upload/audio", f);
        await sendMessage(convId, `[audio] ${url}`, null);
      }
      // qualsiasi altro file -> /upload/file (documenti inclusi)
      else {
        url = await uploadTo("/upload/file", f);
        await sendMessage(convId, `[file] ${f.name} ${url}`, null);
      }
    } catch (e2: any) {
      setErr(e2?.message || "Errore invio file");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Microfono non supportato su questo dispositivo/browser.");
      return;
    }

    setErr(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // scegliamo un mimeType supportato
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
      const mimeType = candidates.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
          chunksRef.current = [];

          // stop stream tracks
          stream.getTracks().forEach((t) => t.stop());

          if (!convId) return;

          setBusy(true);
          const ext = (mr.mimeType || "").includes("ogg") ? "ogg" : "webm";
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mr.mimeType || "audio/webm" });

          const url = await uploadTo("/upload/audio", file);
          await sendMessage(convId, `[audio] ${url}`, null);
        } catch (e: any) {
          setErr(e?.message || "Errore invio vocale");
        } finally {
          setBusy(false);
          setRecording(false);
          mediaRecorderRef.current = null;
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e: any) {
      setErr(e?.message || "Impossibile avviare registrazione microfono");
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    try {
      mr.stop();
    } catch {
      // ignore
    }
  }

  const header: React.CSSProperties = {
    padding: 10,
    borderBottom: "1px solid #222",
    background: "var(--tiko-bg-card)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const headerBtn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "transparent",
    color: "var(--tiko-text)",
    cursor: "pointer",
    fontWeight: 950,
  };

  const bubbleBase: React.CSSProperties = {
    maxWidth: "82%",
    borderRadius: 16,
    padding: "10px 12px",
    border: "1px solid #232323",
    background: "var(--tiko-bg-card)",
    color: "var(--tiko-text)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {onBack ? (
            <button type="button" style={headerBtn} onClick={onBack} aria-label="Indietro">
              ←
            </button>
          ) : null}
          <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {conversation?.title || "Chat"}
          </div>
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((m) => {
          const mine = Number(m?.senderId) === Number(currentUser?.id);
          const content = String(m?.content || "");
          const parsed = parseTaggedContent(content);

          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{ ...bubbleBase }}>
                {parsed.kind === "img" ? (
                  <img src={parsed.url} alt="img" style={{ maxWidth: "100%", borderRadius: 12 }} />
                ) : parsed.kind === "audio" ? (
                  <audio controls src={parsed.url} style={{ width: "100%" }} />
                ) : parsed.kind === "file" ? (
                  <a href={parsed.url} target="_blank" rel="noreferrer" style={{ color: "var(--tiko-mint)", fontWeight: 950 }}>
                    {parsed.name || "File"}
                  </a>
                ) : (
                  parsed.text
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra chat (ripristinata): file + microfono + invio */}
      <div style={{ padding: 10, borderTop: "1px solid #222", background: "var(--tiko-bg-gray)", display: "flex", flexDirection: "column", gap: 8 }}>
        {err ? (
          <div style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #3a1f1f", background: "rgba(255,59,48,0.08)", color: "#ff6b6b", fontWeight: 900 }}>
            {err}
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={handlePickFile}
            disabled={busy}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              border: "1px solid #2a2a2a",
              background: "transparent",
              color: "var(--tiko-text)",
              cursor: "pointer",
              fontWeight: 950,
            }}
            title="Invia file"
            aria-label="Invia file"
          >
            📎
          </button>

          <button
            type="button"
            onClick={() => (recording ? stopRecording() : startRecording())}
            disabled={busy}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              border: "1px solid #2a2a2a",
              background: recording ? "rgba(255,59,48,0.18)" : "transparent",
              color: "var(--tiko-text)",
              cursor: "pointer",
              fontWeight: 950,
            }}
            title={recording ? "Stop registrazione" : "Registra vocale"}
            aria-label="Microfono"
          >
            🎙️
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Scrivi un messaggio..."
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid #2a2a2a",
              background: "var(--tiko-bg-dark)",
              color: "var(--tiko-text)",
              outline: "none",
            }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={busy || !text.trim()}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid var(--tiko-mint)",
              background: "var(--tiko-mint)",
              color: "#000",
              cursor: "pointer",
              fontWeight: 950,
            }}
          >
            Invia
          </button>

          {/* File input nascosto: IMPORTANTISSIMO accept="*/*" così su mobile compaiono anche documenti */}
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </div>

        {recording ? <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>Registrazione in corso… premi il microfono per inviare.</div> : null}
      </div>
    </div>
  );
}
