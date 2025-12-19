import React from "react";
import Sidebar from "../components/ui/Sidebar";

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

  const [isMobile, setIsMobile] = React.useState(compute);
  React.useEffect(() => {
    const onResize = () => setIsMobile(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return isMobile;
}

export default function TermsPage() {
  const isMobile = useIsMobile(1100);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        background: "var(--tiko-bg-dark)",
        overflow: "hidden",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, lineHeight: 1.55 }}>
          <h1 style={{ marginTop: 0 }}>Termini e Condizioni d’Uso</h1>
          <p style={{ color: "var(--tiko-text-dim)" }}>Ultimo aggiornamento: 2025-12-19</p>

          <h2>1. Oggetto</h2>
          <p>
            Clasp è un servizio di comunicazione sociale (chat) accessibile via browser. Utilizzando il servizio accetti i presenti Termini.
          </p>

          <h2>2. Account</h2>
          <ul>
            <li>Sei responsabile delle credenziali e dell’uso del tuo account.</li>
            <li>Non devi impersonare altre persone o fornire dati falsi.</li>
          </ul>

          <h2>3. Contenuti e Condotta</h2>
          <ul>
            <li>È vietato pubblicare contenuti illegali, violenti, d’odio, molesti o che violino diritti altrui.</li>
            <li>È vietato tentare di compromettere la sicurezza del servizio.</li>
            <li>Puoi inviare messaggi e file nei limiti consentiti dall’app.</li>
          </ul>

          <h2>4. Privacy</h2>
          <p>
            Il trattamento dei dati personali è descritto nell’Informativa Privacy. Usando Clasp dichiari di averla letta.
          </p>

          <h2>5. Disponibilità e Modifiche</h2>
          <p>
            Il servizio può essere aggiornato, modificato o sospeso per manutenzione o esigenze tecniche. Potremmo aggiornare questi Termini;
            le modifiche saranno efficaci dalla pubblicazione.
          </p>

          <h2>6. Limitazioni di responsabilità</h2>
          <p>
            Nei limiti consentiti dalla legge, Clasp non è responsabile per perdite indirette, interruzioni del servizio o contenuti scambiati tra utenti.
          </p>

          <h2>7. Contatti</h2>
          <p>
            Per segnalazioni o richieste: inserire qui un contatto email o un form (consigliato).
          </p>

          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
}
