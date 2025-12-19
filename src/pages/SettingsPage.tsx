import React, { useMemo, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import { unlockAudio, playNotificationBeep } from "../utils/notifySound";

function useIsMobile(breakpointPx = 1100) {
  const compute = () => {
    const coarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    const ua =
      typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const uaMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

    return coarse || uaMobile || window.innerWidth < breakpointPx;
  };

  const [isMobile, setIsMobile] = useState(compute);

  React.useEffect(() => {
    const onResize = () => setIsMobile(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isMobile;
}

function readSoundEnabled(): boolean {
  const v = localStorage.getItem("clasp.soundEnabled");
  return v !== "false"; // default ON
}

export default function SettingsPage() {
  const isMobile = useIsMobile(1100);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(readSoundEnabled());
  const [msg, setMsg] = useState<string | null>(null);

  const containerStyle: React.CSSProperties = useMemo(
    () => ({
      height: "100vh",
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      background: "var(--tiko-bg-dark)",
      overflow: "hidden",
    }),
    [isMobile]
  );

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    padding: 16,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--tiko-bg-card)",
    border: "1px solid #222",
    borderRadius: 14,
    padding: 14,
  };

  const toggleSound = async () => {
    if (soundEnabled) {
      localStorage.setItem("clasp.soundEnabled", "false");
      setSoundEnabled(false);
      setMsg("Suono notifiche disattivato.");
      return;
    }

    // abilitazione: serve gesto utente -> proviamo a sbloccare e facciamo beep
    localStorage.setItem("clasp.soundEnabled", "true");
    const okUnlock = await unlockAudio();
    if (!okUnlock) {
      setSoundEnabled(true); // la preferenza è ON, ma il browser può bloccare finché non clicchi ancora
      setMsg("Il browser sta bloccando l’audio. Premi ancora “Attiva suono” per sbloccarlo.");
      return;
    }

    await playNotificationBeep();
    setSoundEnabled(true);
    setMsg("Suono notifiche attivato.");
  };

  return (
    <div style={containerStyle}>
      <Sidebar />

      <div style={contentStyle}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <h1 style={{ margin: 0 }}>Impostazioni</h1>
          <div style={{ color: "var(--tiko-text-dim)", fontSize: 13 }}>
            Qui aggiungeremo le funzioni future (sfondi, tema, preferenze, ecc.).
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Notifiche</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900 }}>Suono messaggi</div>
                <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
                  Attiva/disattiva il suono delle notifiche (su mobile può richiedere un click per sbloccare l’audio).
                </div>
              </div>

              <button
                type="button"
                onClick={toggleSound}
                style={{
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid #2a2a2a",
                  background: soundEnabled ? "#ff3b30" : "var(--tiko-mint)",
                  color: soundEnabled ? "#fff" : "#000",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                {soundEnabled ? "Disattiva suono" : "Attiva suono"}
              </button>
            </div>

            {msg && <div style={{ marginTop: 10, fontSize: 12, color: "var(--tiko-text-dim)" }}>{msg}</div>}
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Aspetto</div>
            <div style={{ fontSize: 12, color: "var(--tiko-text-dim)" }}>
              Prossime funzioni:
              <ul style={{ marginTop: 6 }}>
                <li>Cambia sfondo chat</li>
                <li>Tema chiaro/scuro</li>
                <li>Dimensione testo</li>
              </ul>
            </div>

            <button
              type="button"
              disabled
              style={{
                marginTop: 8,
                borderRadius: 12,
                padding: "10px 12px",
                border: "1px solid #2a2a2a",
                background: "#333",
                color: "#bbb",
                fontWeight: 900,
                cursor: "not-allowed",
              }}
              title="In arrivo"
            >
              Cambia sfondo (in arrivo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
