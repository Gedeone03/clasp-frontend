import React, { useEffect, useRef, useState } from "react";
import { uploadAudio, uploadImage } from "../../api";

type User = {
  id: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
};

type Msg = {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: number | null;
};

function formatTime(dt: any): string {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function isImagePayload(s: string) {
  return s.startsWith("__image__:");
}
function isAudioPayload(s: string) {
  return s.startsWith("__audio__:");
}
function isFilePayload(s: string) {
  return s.startsWith("__file__:");
}

function parsePayload(content: string): { kind: "text" | "image" | "audio" | "file"; url?: string; name?: string; text?: string } {
  const c = String(content || "");
  if (isImagePayload(c)) return { kind: "image", url: c.slice(9).trim() };
  if (isAudioPayload(c)) return { kind: "audio", url: c.slice(9).trim() };
  if (isFilePayload(c)) {
    const rest = c.slice(8).trim();
    const [u, name] = rest.split("|");
    return { kind: "file", url: (u || "").trim(), name: (name || "").trim() || undefined };
  }
  return { kind: "text", text: c };
}

export default function ChatWindow(props: any) {
  const me: User | null = props?.me || props?.user || props?.currentUser || null;
  const otherUser: User | null = props?.otherUser || props?.other || props?.peerUser || props?.friend || null;

  const messages: Msg[] = Array.isArray(props?.messages) ? props.messages : [];
  const typingUserId: number | null = props?.typingUserId ?? null;

  const onBack: (() => void) | undefined = props?.onBack;
  const onSendWithReply: ((content: string, replyToId: number | null) => Promise<void> | void) | undefined = props?.onSendWithReply;
  const onSend: ((content: string) => Promise<void> | void) | undefined = props?.onSend || props?.onSendMessage;

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // audio recorder
  const recorderRef = useRef<any>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recMs, setRecMs] = useState(0);

  async function doSend(content: string) {
    const c = content.trim();
    if (!c) return;

    if (!onSendWithReply && !onSend) {
      setErr("Callback invio mancante (onSend / onSendWithReply).");
      return;
    }

    setErr(null);
    setBusy(true);
    try {
      if (onSendWithReply) await onSendWithReply(c, replyTo?.id ?? null);
      else if (onSend) await onSend(c);

      setText("");
      setReplyTo(null);
    } catch (e: any) {
      setErr(e?.message || "Errore invio messaggio");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickAnyFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const mime = file.type || "";

      // immagini -> /upload/image
      if (mime.startsWith("image/")) {
        const up = await uploadImage(file);
        await doSend(`__image__:${up.url}`);
        return;
      }

      // audio -> /upload/audio (fallback interno in api.ts)
      if (mime.startsWith("audio/")) {
        const up = await uploadAudio(file);
        await doSend(`__audio__:${up.url}`);
        return;
      }

      // altri file: usiamo uploadAudio fallback (che prova /upload/file e /upload/image)
      const up = await uploadAudio(file);
      await doSend(`__file__:${up.url}|${file.name || "file"}`);
    } catch (e: any) {
      setErr(e?.message || "Errore invio file/audio");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Registrazione non supportata su questo browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const MediaRecorderAny = (window as any).MediaRecorder;
      if (!MediaRecorderAny) {
        stream.getTracks().forEach((t: any) => t.stop());
        setErr("MediaRecorder non disponibile.");
        return;
      }

      chunksRef.current = [];
      setRecMs(0);

      const rec = new MediaRecorderAny(stream);
      recorderRef.current = rec;

      rec.ondataavailable = (e: any) => {
        if (e?.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        try {
          stream.getTracks().forEach((t: any) => t.stop());
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          const ext = String(rec.mimeType || "").includes("ogg") ? "ogg" : "webm";
          const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });
          await handlePickAnyFile(file);
        } catch (e: any) {
          setErr(e?.message || "Errore invio audio");
        }
      };

      rec.start(250);
      setRecording(true);

      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => setRecMs((p) => p + 250), 250);
    } catch (e: any) {
      setErr(e?.message || "Permesso microfono negato.");
    }
  }

  function stopRecording() {
    try {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;

      const rec = recorderRef.current;
      recorderRef.current = null;

      setRecording(false);
      if (rec && rec.state !== "inactive") rec.stop();
    } catch (e: any) {
      setErr(e?.message || "Errore stop registrazione");
    }
  }

  const iconBtn: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "var(--tiko-bg-dark)",
    color: "var(--tiko-text)",
    fontWeight: 950,
    cursor: "pointer",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--tiko-bg-card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {onBack && (
            <button type="button" style={iconBtn} onClick={onBack} aria-label="Indietro">
              ←
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, color: "var(--tiko-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {otherUser?.displayName || otherUser?.username || "Chat"}
            </div>
            {typingUserId ? <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>sta scrivendo…</div> : null}
          </div>
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, background: "var(--tiko-bg-dark)" }}>
        {messages.map((m) => {
          const mine = me?.id && m.senderId === me.id;
          const p = parsePayload(String(m.content ?? ""));
          const deleted = !!m.deletedAt;

          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
              <div style={{ maxWidth: "78%", padding: "10px 12px", borderRadius: 16, border: "1px solid #2a2a2a", background: mine ? "rgba(122,41,255,0.18)" : "rgba(58,190,255,0.12)", color: "var(--tiko-text)" }}>
                {deleted ? (
                  <i style={{ color: "var(--tiko-text-dim)" }}>Messaggio eliminato</i>
                ) : p.kind === "text" ? (
                  p.text
                ) : p.kind === "image" ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt="img" style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid #333" }} />
                  </a>
                ) : p.kind === "audio" ? (
                  <audio controls src={p.url} style={{ width: "100%" }} />
                ) : (
                  <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "#3ABEFF", fontWeight: 900 }}>
                    Scarica file{p.name ? `: ${p.name}` : ""}
                  </a>
                )}

                <div style={{ marginTop: 6, fontSize: 11, color: "var(--tiko-text-dim)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{formatTime(m.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(m)}
                    style={{ background: "transparent", border: "none", color: "#3ABEFF", cursor: "pointer", fontWeight: 900, padding: 0 }}
                  >
                    Rispondi
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ✅ BARRA CHAT RIPRISTINATA (web+mobile) */}
      <div style={{ borderTop: "1px solid #222", background: "var(--tiko-bg-card)", padding: 10, position: "sticky", bottom: 0 }}>
        {err && (
          <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 12, border: "1px solid #3a1f1f", background: "rgba(255,59,48,0.08)", color: "#ff6b6b", fontWeight: 850 }}>
            {err}
          </div>
        )}

        {replyTo && (
          <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 12, border: "1px solid #2a2a2a", background: "rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
              Risposta a <strong>#{replyTo.id}</strong>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} style={{ background: "transparent", border: "none", color: "#ff3b30", fontWeight: 950, cursor: "pointer" }}>
              Annulla
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <button type="button" style={{ ...iconBtn, opacity: busy ? 0.7 : 1 }} onClick={() => fileInputRef.current?.click()} disabled={busy} title="Invia file">
            📎
          </button>

          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePickAnyFile(f);
              e.currentTarget.value = "";
            }}
          />

          <button
            type="button"
            style={{
              ...iconBtn,
              background: recording ? "rgba(255,59,48,0.18)" : "var(--tiko-bg-dark)",
              borderColor: recording ? "#ff3b30" : "#2a2a2a",
            }}
            onClick={() => (recording ? stopRecording() : startRecording())}
            disabled={busy}
            title={recording ? "Stop registrazione" : "Registra audio"}
          >
            🎙️
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={recording ? `Registrazione… ${(recMs / 1000).toFixed(1)}s` : "Scrivi un messaggio…"}
            style={{
              flex: 1,
              resize: "none",
              minHeight: 42,
              maxHeight: 120,
              padding: "10px 10px",
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              background: "var(--tiko-bg-dark)",
              color: "var(--tiko-text)",
              outline: "none",
              fontSize: 14,
              lineHeight: 1.25,
            }}
            disabled={busy || recording}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                doSend(text);
              }
            }}
          />

          <button
            type="button"
            style={{ minWidth: 80, height: 42, borderRadius: 12, border: "1px solid #2a2a2a", background: "#7A29FF", color: "#fff", fontWeight: 950, cursor: "pointer", opacity: busy ? 0.7 : 1 }}
            disabled={busy || recording || !text.trim()}
            onClick={() => doSend(text)}
          >
            {busy ? "…" : "Invia"}
          </button>
        </div>
      </div>
    </div>
  );
}
