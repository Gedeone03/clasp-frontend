// src/pages/PrivacyPage.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../LanguageContext";

type Section = { title: string; body: string[] };

const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useI18n();

  const content: { title: string; intro: string; sections: Section[] } =
    lang === "en"
      ? {
          title: "Privacy Policy",
          intro:
            "Your privacy is important to us. This Privacy Policy explains how CLASP collects, uses, and protects personal data when you use the service via browser or application. By using CLASP, you agree to the practices described below.",
          sections: [
            {
              title: "1. Introduction",
              body: [
                "CLASP is a communication and social connection service. We aim to collect only the information that is necessary to provide the service and keep it secure.",
              ],
            },
            {
              title: "2. Personal data collected",
              body: [
                "CLASP only collects data necessary for the service to function properly. This may include:",
                "• Registration data: email, username, display name",
                "• Profile information: avatar, status, mood, interests, city/area (if provided)",
                "• User-generated content: text messages, images, audio",
                "• Minimal technical data required to operate the service",
                "CLASP does not collect sensitive data such as health, political, or financial information.",
              ],
            },
            {
              title: "3. Use of data",
              body: [
                "Collected data is used exclusively to:",
                "• Provide and manage the service",
                "• Enable user-to-user interaction",
                "• Improve the user experience",
                "• Ensure security and prevent abuse",
                "CLASP does not use personal data for external marketing purposes.",
              ],
            },
            {
              title: "4. Legal basis for processing",
              body: [
                "Personal data is processed based on:",
                "• The user’s consent at registration",
                "• The necessity to provide the requested service",
                "• Legitimate interest in ensuring security and proper operation of the platform",
              ],
            },
            {
              title: "5. Data retention",
              body: [
                "Personal data is retained for as long as necessary to provide the service.",
                "Users may request modification or deletion of their data at any time.",
              ],
            },
            {
              title: "6. Data sharing",
              body: [
                "CLASP does not sell or share user data with third parties, except where required by law or legal obligations.",
                "Data is never transferred for commercial purposes.",
              ],
            },
            {
              title: "7. Security",
              body: [
                "We apply appropriate technical and organizational measures to protect data from unauthorized access, loss, or misuse.",
                "However, no system can guarantee absolute security.",
              ],
            },
            {
              title: "8. User rights",
              body: [
                "In accordance with applicable regulations, users have the right to:",
                "• Access their personal data",
                "• Modify or update their data",
                "• Request deletion of their data",
                "• Restrict or object to data processing",
                "These rights may be exercised through the app features or by contacting the CLASP team.",
              ],
            },
            {
              title: "9. Changes to this policy",
              body: [
                "CLASP may update this Privacy Policy over time.",
                "Significant changes will be communicated through the app or website.",
              ],
            },
            {
              title: "10. Contact",
              body: [
                "For questions or requests regarding privacy, you may contact the CLASP team using the contact details available within the app.",
              ],
            },
          ],
        }
      : {
          title: "Informativa Privacy",
          intro:
            "La tua privacy è importante per noi. Questa Informativa Privacy descrive come CLASP raccoglie, utilizza e protegge i dati personali quando utilizzi il servizio via browser o applicazione. Utilizzando CLASP, accetti le pratiche descritte di seguito.",
          sections: [
            {
              title: "1. Introduzione",
              body: [
                "CLASP è un servizio di comunicazione e connessione sociale. Raccogliamo solo le informazioni necessarie per offrire il servizio e mantenerlo sicuro.",
              ],
            },
            {
              title: "2. Dati personali raccolti",
              body: [
                "CLASP raccoglie esclusivamente i dati necessari al funzionamento del servizio. In particolare:",
                "• Dati di registrazione: email, username, nome visualizzato",
                "• Informazioni del profilo: avatar, stato, mood, interessi, città/zona (se forniti)",
                "• Contenuti generati dall’utente: messaggi di testo, immagini, audio",
                "• Dati tecnici minimi necessari al funzionamento del servizio",
                "CLASP non raccoglie dati sensibili come informazioni sanitarie, politiche o finanziarie.",
              ],
            },
            {
              title: "3. Utilizzo dei dati",
              body: [
                "I dati raccolti vengono utilizzati esclusivamente per:",
                "• Fornire e gestire il servizio",
                "• Consentire l’interazione tra utenti",
                "• Migliorare l’esperienza d’uso",
                "• Garantire la sicurezza e prevenire abusi",
                "CLASP non utilizza i dati personali per finalità di marketing esterno.",
              ],
            },
            {
              title: "4. Base giuridica del trattamento",
              body: [
                "Il trattamento dei dati personali avviene sulla base di:",
                "• Consenso dell’utente al momento della registrazione",
                "• Necessità di eseguire il servizio richiesto dall’utente",
                "• Legittimo interesse a garantire sicurezza e corretto funzionamento della piattaforma",
              ],
            },
            {
              title: "5. Conservazione dei dati",
              body: [
                "I dati personali vengono conservati per il tempo necessario a fornire il servizio.",
                "L’utente può richiedere in qualsiasi momento la modifica o la cancellazione dei propri dati.",
              ],
            },
            {
              title: "6. Condivisione dei dati",
              body: [
                "CLASP non vende né condivide i dati personali degli utenti con terze parti, salvo nei casi previsti dalla legge o per obblighi legali.",
                "I dati non vengono ceduti per finalità commerciali.",
              ],
            },
            {
              title: "7. Sicurezza",
              body: [
                "Adottiamo misure tecniche e organizzative adeguate per proteggere i dati personali da accessi non autorizzati, perdita o uso improprio.",
                "Tuttavia, nessun sistema può garantire una sicurezza assoluta.",
              ],
            },
            {
              title: "8. Diritti dell’utente",
              body: [
                "In conformità alla normativa vigente, l’utente ha il diritto di:",
                "• Accedere ai propri dati",
                "• Modificarli o aggiornarli",
                "• Richiederne la cancellazione",
                "• Limitare o opporsi al trattamento",
                "Questi diritti possono essere esercitati tramite le funzionalità dell’app o contattando il team di CLASP.",
              ],
            },
            {
              title: "9. Modifiche all’informativa",
              body: [
                "CLASP si riserva il diritto di aggiornare questa Informativa Privacy.",
                "Eventuali modifiche rilevanti verranno comunicate tramite l’app o il sito.",
              ],
            },
            {
              title: "10. Contatti",
              body: [
                "Per domande o richieste relative alla privacy, è possibile contattare il team di CLASP tramite i riferimenti disponibili all’interno dell’app.",
              ],
            },
          ],
        };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--tiko-bg-dark)",
        color: "var(--tiko-text)",
        padding: "32px 16px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: 860,
          width: "100%",
          background: "var(--tiko-bg-card)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "var(--tiko-glow)",
        }}
      >
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <h1 className="tiko-title">{content.title}</h1>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "8px 14px",
              background: "var(--tiko-purple)",
              fontSize: 13,
            }}
          >
            {lang === "en" ? "Back" : "Torna indietro"}
          </button>
        </div>

        <p style={{ fontSize: 14, color: "var(--tiko-text-dim)", marginBottom: 16 }}>
          {content.intro}
        </p>

        {content.sections.map((s) => (
          <section key={s.title} style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 18, marginBottom: 6 }}>{s.title}</h2>
            {s.body.map((line, idx) => (
              <p
                key={idx}
                style={{
                  fontSize: 14,
                  color: "var(--tiko-text-dim)",
                  margin: "6px 0",
                  whiteSpace: "pre-wrap",
                }}
              >
                {line}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
};

export default PrivacyPage;
