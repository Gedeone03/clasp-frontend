import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../../config";

type Msg = {
  id: number;
  senderId: number;
  content: string;
  createdAt?: string | Date;
  editedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  replyToId?: number | null;
  sender?: { id: number; username?: string; displayName?: string; avatarUrl?: string | null } | null;
};

function getAuthTokenLoose(): string | null {
  // prova alcune chiavi comuni senza toccare la tua AuthContext
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("clasp_token") ||
    localStorage.getItem("tiko_token") ||
    null
  );
}

function resolveUploadedUrl(u: string): string {
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
}

function looksLikeUrl(s: string) {
  return /^https?:\/\//i.test(s) || s.startsWith("/uploads/") || s.startsWith("uploads/");
}

function isImageUrl(s: string) {
  const x = s.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(x);
}

function isAudioUrl(s: string) {
  const x = s.toLowerCase();
  return /\.(webm|ogg|mp3|wav|m4a|aac)(\?.*)?$/.test(x);
}

function fmtTime(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function httpSendMessage(conversationId: number, content: string, replyToId: number | null) {
  const token = getAuthTokenLoose();
  const body = JSON.stringify({ conversationId, content, replyToId: replyToId ?? null });

  // tentiamo endpoint più probabili senza cambiare il backend
  const tries: Array<{ url: string; method: string; body?: string; headers?: Record<string, string> }> = [
    {
      url: `${API_BASE_URL}/messages`,
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    },
    {
      url: `${API_BASE_URL}/conversations/${conversationId}/messages`,
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    },
  ];

  let lastErr: any = null;

  for (const t of tries) {
    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers: {
          ...(t.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: t.body,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || json?.message || `Errore invio (${res.status})`;
        throw new Error(msg);
      }
      return json;
    } catch (e: any) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Errore invio messaggio");
}

async function uploadFileSmart(file: File, kind: "image" | "audio" | "file") {
  const token = getAuthTokenLoose();

  // Proviamo endpoint e fieldname tipici (senza cambiare struttura backend)
  const attempts =
    kind === "image"
      ? [
          { endpoint: "/upload/image", field: "image" },
          { endpoint: "/upload/image", field: "file" },
          { endpoint: "/upload/file", field: "file" },
        ]
      : kind === "audio"
      ? [
          { endpoint: "/upload/audio", field: "audio" },
          { endpoint: "/upload/audio", field: "file" },
          { endpoint: "/upload/file", field: "file" },
        ]
      : [
          { endpoint: "/upload/file", field: "file" },
          { endpoint: "/upload/upload", field: "file" },
          { endpoint: "/upload/image", field: "file" },
        ];

  let lastErr: any = null;

  for (const a of attempts) {
    try {
      const fd = new FormData();
      fd.append(a.field, file, file.name);

      const res = await fetch(`${API_BASE_URL}${a.endpoint}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: fd,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || json?.message || `Upload fallito (${res.status})`;
        throw new Error(msg);
      }

      const u =
        json?.url ||
        json?.fileUrl ||
        json?.path ||
        json?.location ||
        json?.data?.url ||
        (typeof json === "string" ? json : null);

      if (typeof u === "string" && u.trim()) return resolveUploadedUrl(u.trim());

      throw new Error("Upload ok ma risposta senza URL");
    } catch (e: any) {
      lastErr = e;
      // se 404, ha senso provare altri endpoint; se 400 “Unexpected field”, proviamo field diverso
    }
  }

  throw lastErr || new Error("Upload fallito");
}

export default function ChatWindow(props: {
  conversationId?: number | null;
  conversation?: any;
  currentUser: any;
  messages: any[];
  typingUserId?: number | null;
  onBack?: () => void;
  onSendWithReply?: (content: string, replyToId: number | null) => Promise<void> | void;
}) {
  const conversationId = Number(props.conversationId || 0);
  const msgs: Msg[] = Array.isArray(props.messages) ? (props.messages as any) : [];

  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [replyToId, setReplyToId] = useState<number | null>(null);

  // Microfono
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // File input (documenti + immagini)
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // autoscroll
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const replyMsg = useMemo(() => (replyToId ? msgs.find((m) => m.id === replyToId) : null), [replyToId, msgs]);

  function title() {
    const c = props.conversation;
    return c?.title || c?.name || "Chat";
  }

  async function sendContent(content: string) {
    setErr(null);
    const c = content.trim();
    if (!c) return;

    if (!conversationId) {
      setErr("Impossibile inviare: conversationId mancante.");
      return;
    }

    setBusy(true);
    try {
      if (props.onSendWithReply) {
        await props.onSendWithReply(c, replyToId);
      } else {
        await httpSendMessage(conversationId, c, replyToId);
      }
      setText("");
      setReplyToId(null);
    } catch (e: any) {
      setErr(e?.message || "Errore invio messaggio");
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;

    setErr(null);
    if (!conversationId) {
      setErr("Apri una chat prima di inviare un file.");
      return;
    }

    setBusy(true);
    try {
      const kind: "image" | "file" = f.type?.startsWith("image/") ? "image" : "file";
      const url = await uploadFileSmart(f, kind);
      // inviamo il link come contenuto (la UI lo renderizza come immagine/audio/link)
      await sendContent(url);
    } catch (e: any) {
      setErr(e?.message || "Errore invio file");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setErr(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Microfono non supportato su questo dispositivo/browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
      let mimeType = "";
      for (const m of mimeCandidates) {
        if ((window as any).MediaRecorder?.isTypeSupported?.(m)) {
          mimeType = m;
          break;
        }
      }

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        // stop tracks
        try {
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
        mediaStreamRef.current = null;
      };

      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e: any) {
      setErr(e?.message || "Permesso microfono negato o errore avvio registrazione");
    }
  }

  async function stopRecordingAndSend() {
    setErr(null);
    const rec = mediaRecorderRef.current;
    if (!rec) {
      setRecording(false);
      return;
    }

    setBusy(true);

    try {
      const blob: Blob = await new Promise((resolve) => {
        const onStop = () => {
          rec.removeEventListener("stop", onStop as any);
          const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          resolve(b);
        };
        rec.addEventListener("stop", onStop as any);
        rec.stop();
      });

      mediaRecorderRef.current = null;
      setRecording(false);

      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp3") ? "mp3" : "webm";
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });

      if (!conversationId) throw new Error("Apri una chat prima di inviare un vocale.");

      const url = await uploadFileSmart(file, "audio");
      await sendContent(url);
    } catch (e: any) {
      setErr(e?.message || "Errore invio vocale");
      setRecording(false);
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  const composerBtn: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "transparent",
    color: "var(--tiko-text)",
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const sendBtn: React.CSSProperties = {
    height: 40,
    borderRadius: 12,
    border: "1px solid var(--tiko-mint)",
    background: "var(--tiko-mint)",
    color: "#000",
    cursor: "pointer",
    fontWeight: 950,
    padding: "0 14px",
  };

  const bubbleBase: React.CSSProperties = {
    borderRadius: 14,
    padding: "10px 12px",
    maxWidth: "82%",
    border: "1px solid #232323",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        style={{
          padding: 10,
          borderBottom: "1px solid #222",
          background: "var(--tiko-bg-card)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {props.onBack ? (
          <button type="button" onClick={props.onBack} style={{ ...composerBtn, width: 44 }} aria-label="Indietro">
            ←
          </button>
        ) : null}
        <div style={{ fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title()}</div>
        <div style={{ marginLeft: "auto", color: "var(--tiko-text-dim)", fontSize: 12 }}>
          {props.typingUserId ? "Sta scrivendo..." : ""}
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, background: "var(--tiko-bg-gray)" }}>
        {msgs.map((m) => {
          const mine = Number(m.senderId) === Number(props.currentUser?.id);
          const content = m.deletedAt ? "Messaggio eliminato" : m.content || "";
          const showUrl = looksLikeUrl(content);
          const url = showUrl ? resolveUploadedUrl(content) : "";

          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
              <div
                style={{
                  ...bubbleBase,
                  background: mine ? "rgba(58,190,255,0.10)" : "var(--tiko-bg-card)",
                }}
                onDoubleClick={() => setReplyToId(m.id)}
                title="Doppio tap/click per Rispondi"
              >
                {m.replyToId ? (
                  <div style={{ fontSize: 12, opacity: 0.85, borderLeft: "3px solid #3ABEFF", paddingLeft: 8, marginBottom: 8 }}>
                    Risposta a #{m.replyToId}
                  </div>
                ) : null}

                {showUrl && isImageUrl(url) ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="img" style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid #222" }} />
                  </a>
                ) : showUrl && isAudioUrl(url) ? (
                  <audio controls src={url} style={{ width: "100%" }} />
                ) : showUrl ? (
                  <a href={url} target="_blank" rel="noreferrer" style={{ color: "#3ABEFF", fontWeight: 900 }}>
                    📎 Apri file
                  </a>
                ) : (
                  <div style={{ opacity: m.deletedAt ? 0.7 : 1 }}>{content}</div>
                )}

                <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end", gap: 10, fontSize: 11, color: "var(--tiko-text-dim)" }}>
                  <span>{fmtTime(m.createdAt)}</span>
                  {m.editedAt ? <span>(mod.)</span> : null}
                  <button
                    type="button"
                    onClick={() => setReplyToId(m.id)}
                    style={{ background: "transparent", border: "none", color: "var(--tiko-text-dim)", cursor: "pointer" }}
                    title="Rispondi"
                  >
                    ↩
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {err ? (
        <div style={{ padding: "10px 12px", borderTop: "1px solid #222", background: "rgba(255,59,48,0.08)", color: "#ff6b6b", fontWeight: 900 }}>
          {err}
        </div>
      ) : null}

      {replyMsg ? (
        <div style={{ padding: 10, borderTop: "1px solid #222", background: "var(--tiko-bg-card)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--tiko-text)" }}>
            <strong>Rispondi:</strong>{" "}
            <span style={{ color: "var(--tiko-text-dim)" }}>
              {String(replyMsg.content || "").slice(0, 80)}
              {String(replyMsg.content || "").length > 80 ? "…" : ""}
            </span>
          </div>
          <button type="button" style={{ ...composerBtn, width: 44 }} onClick={() => setReplyToId(null)} aria-label="Annulla risposta">
            ×
          </button>
        </div>
      ) : null}

      <div style={{ padding: 10, borderTop: "1px solid #222", background: "var(--tiko-bg-card)" }}>
        <input
          ref={fileInputRef}
          type="file"
          // IMPORTANTISSIMO: niente accept="image/*" -> così non è solo camera, ma anche documenti
          style={{ display: "none" }}
          onChange={onPickFile}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={composerBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            title="Invia file (documenti, immagini, ecc.)"
            aria-label="Invia file"
          >
            📎
          </button>

          <button
            type="button"
            style={{
              ...composerBtn,
              borderColor: recording ? "#ff3b30" : "#2a2a2a",
              color: recording ? "#ff3b30" : "var(--tiko-text)",
            }}
            onClick={() => (recording ? stopRecordingAndSend() : startRecording())}
            disabled={busy}
            title={recording ? "Stop & invia vocale" : "Registra vocale"}
            aria-label="Microfono"
          >
            {recording ? "■" : "🎙️"}
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Scrivi un messaggio…"
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 110,
              resize: "none",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              background: "var(--tiko-bg-dark)",
              color: "var(--tiko-text)",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) sendContent(text);
              }
            }}
          />

          <button type="button" style={sendBtn} disabled={busy || !text.trim()} onClick={() => sendContent(text)} aria-label="Invia">
            Invia
          </button>
        </div>
      </div>
    </div>
  );
}
