// src/pages/TermsPage.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../LanguageContext";

type Section = { title: string; body: string[] };

const TermsPage: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useI18n();

  const content: { title: string; intro: string; sections: Section[] } =
    lang === "en"
      ? {
          title: "Terms and Conditions",
          intro:
            "These Terms and Conditions govern your use of CLASP. By accessing or using the service, you agree to these terms.",
          sections: [
            {
              title: "1. Introduction",
              body: [
                "CLASP is a social communication service. Please read these terms carefully before using the platform.",
              ],
            },
            {
              title: "2. Description of the service",
              body: [
                "CLASP allows users to create a profile, communicate with other users, share multimedia content, and connect based on interests and moods.",
                "The service is free of charge.",
              ],
            },
            {
              title: "3. Account and responsibility",
              body: [
                "You are responsible for the information you provide and for keeping your account secure.",
                "It is prohibited to impersonate others, provide false information, or use someone else’s account without authorization.",
              ],
            },
            {
              title: "4. Proper use of the service",
              body: [
                "You agree to use CLASP lawfully and respectfully.",
                "It is not permitted to send illegal, offensive, or harmful content, harass other users, or use the service for fraud or spam.",
              ],
            },
            {
              title: "5. User content",
              body: [
                "You are solely responsible for the content you share through CLASP.",
                "CLASP does not pre-screen content but may intervene in case of violations of these terms.",
              ],
            },
            {
              title: "6. Suspension or termination",
              body: [
                "CLASP may suspend or terminate accounts that violate these terms, compromise the platform’s security, or cause harm to other users.",
              ],
            },
            {
              title: "7. Limitation of liability",
              body: [
                "CLASP provides the service “as is”, without guarantees of uninterrupted availability or error-free operation.",
                "To the extent permitted by law, CLASP is not liable for damages arising from the use of the service.",
              ],
            },
            {
              title: "8. Changes to the terms",
              body: [
                "These Terms and Conditions may be updated over time.",
                "Continued use of the service constitutes acceptance of the updated terms.",
              ],
            },
            {
              title: "9. Applicable law",
              body: [
                "These terms are governed by applicable laws based on the user’s country of residence, without prejudice to local consumer protection rights.",
              ],
            },
          ],
        }
      : {
          title: "Termini e Condizioni",
          intro:
            "I presenti Termini e Condizioni regolano l’utilizzo di CLASP. Accedendo o utilizzando il servizio, accetti questi termini.",
          sections: [
            {
              title: "1. Introduzione",
              body: [
                "CLASP è un servizio di comunicazione e connessione sociale. Ti invitiamo a leggere con attenzione questi termini prima di utilizzare la piattaforma.",
              ],
            },
            {
              title: "2. Descrizione del servizio",
              body: [
                "CLASP consente agli utenti di creare un profilo, comunicare con altri utenti, condividere contenuti multimediali e connettersi in base a interessi e mood.",
                "Il servizio è gratuito.",
              ],
            },
            {
              title: "3. Account e responsabilità",
              body: [
                "Sei responsabile delle informazioni fornite e della sicurezza del tuo account.",
                "È vietato impersonare altre persone, fornire informazioni false o utilizzare account di terzi senza autorizzazione.",
              ],
            },
            {
              title: "4. Uso corretto del servizio",
              body: [
                "L’utente si impegna a utilizzare CLASP in modo lecito e rispettoso.",
                "Non è consentito inviare contenuti illegali, offensivi o dannosi, molestare altri utenti o utilizzare il servizio per frodi o spam.",
              ],
            },
            {
              title: "5. Contenuti degli utenti",
              body: [
                "Sei l’unico responsabile dei contenuti che condividi tramite CLASP.",
                "CLASP non controlla preventivamente i contenuti ma può intervenire in caso di violazioni dei presenti termini.",
              ],
            },
            {
              title: "6. Sospensione o chiusura dell’account",
              body: [
                "CLASP può sospendere o chiudere account che violano i termini, compromettono la sicurezza della piattaforma o arrecano danni ad altri utenti.",
              ],
            },
            {
              title: "7. Limitazione di responsabilità",
              body: [
                "CLASP fornisce il servizio “così com’è”, senza garanzie di continuità o assenza di errori.",
                "Nei limiti consentiti dalla legge, CLASP non è responsabile per danni derivanti dall’uso del servizio.",
              ],
            },
            {
              title: "8. Modifiche ai termini",
              body: [
                "I Termini e Condizioni possono essere aggiornati nel tempo.",
                "L’uso continuato del servizio implica l’accettazione delle modifiche.",
              ],
            },
            {
              title: "9. Legge applicabile",
              body: [
                "I presenti termini sono regolati dalla normativa applicabile in base al paese di residenza dell’utente, senza pregiudizio dei diritti garantiti dalle leggi locali.",
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

export default TermsPage;
