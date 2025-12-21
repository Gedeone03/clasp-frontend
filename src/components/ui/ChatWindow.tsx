import React, { useEffect, useMemo, useRef, useState } from "react";
import { sendMessage, uploadAudio, uploadFile, uploadImage } from "../../api";

type User = {
  id: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
};

type MsgAny = any;

function formatTime(dt: any): string {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function parsePayload(content: string): { kind: "text" | "image" | "audio" | "file"; url?: string; name?: string; text?: string } {
  const c = String(content || "");
  if (c.startsWith("__image__:")) return { kind: "image", url: c.slice(9).trim() };
  if (c.startsWith("__audio__:")) return { kind: "audio", url: c.slice(9).trim() };
  if (c.startsWith("__file__:")) {
    const rest = c.slice(8).trim();
    const [u, name] = rest.split("|");
    return { kind: "file", url: (u || "").trim(), name: (name || "").trim() || undefined };
  }
  return { kind: "text", text: c };
}

function axiosErrorToText(e: any): string {
  const status = e?.response?.status;
  const data = e?.response?.data;
  const msg = e?.message;
  if (status) return `Errore invio (${status}) ${typeof data === "string" ? data : ""}`.trim();
  return msg || "Errore invio";
}

function getConvId(props: any, incoming: any[]): number {
  const candidates: any[] = [];
  candidates.push(props?.conversationId);
  candidates.push(props?.conversation?.id);
  candidates.push(props?.selectedConversation?.id);
  candidates.push(props?.selectedConversationId);

  try {
    const p = new URLSearchParams(window.location.search);
    const cid = p.get("cid");
    if (cid) candidates.push(cid);
  } catch {}

  if (incoming?.[0]?.conversationId) candidates.push(incoming[0].conversationId);

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export default function ChatWindow(props: any) {
  const me: User | null = props?.me || props?.user || props?.currentUser || null;
  const otherUser: User | null = props?.otherUser || props?.other || props?.peerUser || props?.friend || null;

  const incoming: MsgAny[] = Array.isArray(props?.messages) ? props.messages : [];
  const [messages, setMessages] = useState<MsgAny[]>(incoming);

  useEffect(() => {
    setMessages(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.length]);

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onBack: (() => void) | undefined = props?.onBack;
  const typingUserId: number | null = props?.typingUserId ?? null;

  const conversationId: number = useMemo(() => getConvId(props, incoming), [props, incoming]);

  // ====== File picker ======
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ====== Audio recorder ======
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recMs, setRecMs] = useState(0);

  async function doSendContent(content: string) {
    const c = content.trim();
    if (!c) return;

    if (!conversationId) {
      setErr("Impossibile inviare: conversationId mancante (seleziona una chat e riprova).");
      return;
    }

    setErr(null);
    setBusy(true);
    try {
      const created = await sendMessage(conversationId, c, null);
      setMessages((prev) => [...prev, created as any]);
      setText("");
    } catch (e: any) {
      console.error("SEND ERROR", e);
      setErr(axiosErrorToText(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePickFile(file: File) {
    if (!conversationId) {
      setErr("Impossibile inviare file: conversationId mancante.");
      return;
    }

    setErr(null);
    setBusy(true);
    try {
      const mime = file.type || "";
      let payload = "";

      if (mime.startsWith("image/")) {
        const up = await uploadImage(file);
        payload = `__image__:${up.url}`;
      } else if (mime.startsWith("audio/")) {
        const up = await uploadAudio(file);
        payload = `__audio__:${up.url}`;
      } else {
        const up = await uploadFile(file);
        payload = `__file__:${up.url}|${file.name || "file"}`;
      }

      const created = await sendMessage(conversationId, payload, null);
      setMessages((prev) => [...prev, created as any]);
    } catch (e: any) {
      console.error("FILE SEND ERROR", e);
      setErr(axiosErrorToText(e));
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setErr(null);

    if (!conversationId) {
      setErr("Apri una chat prima di registrare un vocale.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Registrazione vocale non supportata su questo browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // scegliamo un mimeType supportato se possibile
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const mrAny: any = window as any;
      const mimeType = mrAny.MediaRecorder?.isTypeSupported
        ? candidates.find((m) => mrAny.MediaRecorder.isTypeSupported(m)) || ""
        : "";

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      setRecMs(0);

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        try {
          // stop stream
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;

          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          const ext = (rec.mimeType || "").includes("ogg") ? "ogg" : "webm";
          const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });

          setBusy(true);
          const up = await uploadAudio(file);
          const payload = `__audio__:${up.url}`;
          const created = await sendMessage(conversationId, payload, null);
          setMessages((prev) => [...prev, created as any]);
        } catch (e: any) {
          setErr(e?.message || "Errore invio vocale");
        } finally {
          setBusy(false);
        }
      };

      rec.start(250);
      setRecording(true);

      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => setRecMs((p) => p + 200), 200);
    } catch (e: any) {
      setErr(e?.message || "Permesso microfono negato o errore registrazione.");
    }
  }

  function stopRecording() {
    try {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;

      setRecording(false);

      const rec = recorderRef.current;
      recorderRef.current = null;

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
        {messages.map((m: any) => {
          const mine = me?.id && Number(m.senderId) === Number(me.id);
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
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #222", background: "var(--tiko-bg-card)", padding: 10, position: "sticky", bottom: 0 }}>
        {err && (
          <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 12, border: "1px solid #3a1f1f", background: "rgba(255,59,48,0.08)", color: "#ff6b6b", fontWeight: 850 }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          {/* 📎 documenti: input file senza accept/capture */}
          <button type="button" style={{ ...iconBtn, opacity: busy ? 0.7 : 1 }} onClick={() => fileInputRef.current?.click()} disabled={busy || recording} title="Invia file">
            📎
          </button>

          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePickFile(f);
              e.currentTarget.value = "";
            }}
          />

          {/* 🎙️ vocale: toggle start/stop */}
          <button
            type="button"
            style={{
              ...iconBtn,
              background: recording ? "rgba(255,59,48,0.18)" : "var(--tiko-bg-dark)",
              borderColor: recording ? "#ff3b30" : "#2a2a2a",
            }}
            disabled={busy}
            onClick={() => (recording ? stopRecording() : startRecording())}
            title={recording ? `Stop (${(recMs / 1000).toFixed(1)}s)` : "Registra vocale"}
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
                doSendContent(text);
              }
            }}
          />

          <button
            type="button"
            style={{ minWidth: 80, height: 42, borderRadius: 12, border: "1px solid #2a2a2a", background: "#7A29FF", color: "#fff", fontWeight: 950, cursor: "pointer", opacity: busy ? 0.7 : 1 }}
            disabled={busy || recording || !text.trim()}
            onClick={() => doSendContent(text)}
          >
            {busy ? "…" : "Invia"}
          </button>
        </div>
      </div>
    </div>
  );
}
