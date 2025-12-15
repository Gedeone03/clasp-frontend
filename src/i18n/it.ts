// src/i18n/it.ts
const it: Record<string, string> = {
  appName: "CLASP",

  navHome: "Home",
  navFriends: "Amici",
  navProfile: "Profilo",
  navMood: "Mood",
  navSettings: "Impostazioni",

  settingsTitle: "Impostazioni",
  settingsAccount: "Account",
  settingsPreferences: "Preferenze",
  settingsAbout: "Informazioni su CLASP",
  settingsLogout: "Logout",
  settingsLanguage: "Lingua",
  settingsLanguageIt: "Italiano",
  settingsLanguageEn: "Inglese",
  settingsVersion: "Versione app",

  authLoginTab: "Login",
  authRegisterTab: "Registrati",
  authEmailOrUsername: "Email o Username",
  authEmail: "Email",
  authPassword: "Password",
  authDisplayName: "Nome visualizzato",
  authUsername: "Username",
  authCityOptional: "Città (opzionale)",
  authAreaOptional: "Zona (opzionale)",
  authAcceptTermsPrefix: "Accetto i",
  authTerms: "Termini e Condizioni d'uso",
  authAnd: "e l'",
  authPrivacy: "Informativa Privacy",
  authEnter: "Entra",
  authCreateAccount: "Crea account",
  authWait: "Attendere...",
  authRequiredLogin: "emailOrUsername e password sono obbligatori",
  authRequiredRegister: "email, password, displayName e username sono obbligatori",
  authMustAcceptTerms: "Devi accettare i Termini e le Condizioni d'uso.",

  moodTitle: "Mood Connect",
  moodYourMood: "Il tuo mood attuale è:",
  moodNoMood: "Non hai ancora impostato un mood. Vai nella pagina Profilo e seleziona il tuo stato emozionale.",
  moodFindPeople: "Trova persone con il mio mood",
  moodQuickConnect: "Connettimi ORA",
  moodSearching: "Cerco persone...",
  moodConnecting: "Connessione...",
  moodNoPeople: "Nessun utente trovato con il tuo mood in questo momento.",
  moodNoPeopleQuick: "Al momento non ci sono altre persone con il tuo mood.",
  moodPeopleListTitle: "Persone con il tuo stesso mood",
  moodStartChat: "Inizia chat",
  moodErrorSearch: "Errore durante la ricerca per mood.",
  moodErrorQuick: "Errore durante il collegamento rapido.",

  // HOME
  homeSearchPlaceholder: "Cerca utente…",
  homeVisibleOnly: "Solo VISIBILE_A_TUTTI",
  homeSearchButton: "Cerca",
  homeNoUserFound: "Nessun utente trovato",
  homeSearchError: "Errore durante la ricerca",
  homeFriendRequestSentTo: "Richiesta di amicizia inviata a",
  homeAlreadyFriend: "Sei già amico di",
  homeAlreadyRequested: "Hai già inviato una richiesta a",
  homeStartChat: "Inizia chat",
  homeSendFriendRequest: "Invia richiesta amico",
  homeAlreadyFriendsButton: "Già amici",
  homeRequestSentButton: "Richiesta inviata",
  homeDeleteChatConfirm: "Vuoi davvero eliminare questa chat?\nL'operazione non può essere annullata.",
  homeDeleteChatError: "Errore durante l'eliminazione della chat",

  // FRIENDS
  friendsTitle: "Amici",
  friendsSubtitle: "Gestisci le tue connessioni su CLASP: amici, richieste ricevute e richieste inviate.",
  friendsYourFriends: "I tuoi amici",
  friendsNoFriends: "Non hai ancora amici. Invia una richiesta dalla ricerca utenti.",
  friendsRequestsReceived: "Richieste ricevute",
  friendsNoRequestsReceived: "Non hai richieste di amicizia in sospeso.",
  friendsRequestsSent: "Richieste inviate",
  friendsNoRequestsSent: "Non hai richieste in sospeso inviate ad altri utenti.",
  friendsAccept: "Accetta",
  friendsDecline: "Rifiuta",
  friendsAcceptedMsg: "Richiesta accettata",
  friendsDeclinedMsg: "Richiesta rifiutata",
  friendsLoading: "Caricamento…",
  friendsErrorLoad: "Errore durante il caricamento dei dati amici",
  friendsWantsToAddYou: "Vuole aggiungerti come amico.",
  friendsPending: "Richiesta in attesa di risposta.",

  // PROFILE
  profileTitle: "Profilo",
  profileLogout: "Logout",
  profileName: "Nome",
  profileUsername: "Username",
  profileEmail: "Email",
  profileCurrentMood: "Mood attuale",
  profileSectionTitle: "Stato, Mood e Interessi",
  profileStatus: "Stato",
  profileStatusText: "Messaggio di stato",
  profileStatusTextPh: "Es. Disponibile per chattare, al lavoro, ecc.",
  profileMood: "Mood (stato emozionale)",
  profileMoodNone: "Nessun mood specifico",
  profileCity: "Città",
  profileCityPh: "Es. Milano",
  profileArea: "Zona",
  profileAreaPh: "Es. Centro, Navigli...",
  profileInterests: "Interessi",
  profileUploadingAvatar: "Caricamento avatar…",
  profileSave: "Salva modifiche",
  profileSaving: "Salvataggio...",
  profileSavedOk: "Profilo aggiornato con successo",
  profileChangePhoto: "Cambia foto profilo",

  // MOODS (IT)
  mood_FELICE: "Felice",
  mood_TRISTE: "Triste",
  mood_STRESSATO: "Stressato",
  mood_ANNOIATO: "Annoiato",
  mood_RILASSATO: "Rilassato",
  mood_VOGLIA_DI_PARLARE: "Voglia di parlare",
  mood_CERCO_COMPAGNIA: "Cerco compagnia",
  mood_VOGLIA_DI_RIDERE: "Voglia di ridere",
  mood_CURIOSO: "Curioso",
  mood_MOTIVATO: "Motivato",
  // LEGAL - PRIVACY
  privacyTitle: "Informativa Privacy",
  privacyIntro:
    "La tua privacy è importante per noi. In questa informativa spieghiamo come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali.",
  privacyDataCollectedTitle: "Dati raccolti",
  privacyDataCollected:
    "Raccogliamo i dati che fornisci direttamente, come email, username, nome visualizzato, avatar, messaggi e preferenze.",
  privacyUsageTitle: "Utilizzo dei dati",
  privacyUsage:
    "I dati vengono utilizzati per fornire il servizio, migliorare l’esperienza utente, garantire la sicurezza e rispettare gli obblighi legali.",
  privacySharingTitle: "Condivisione dei dati",
  privacySharing:
    "Non vendiamo né condividiamo i tuoi dati con terze parti, salvo obblighi di legge.",
  privacySecurityTitle: "Sicurezza",
  privacySecurity:
    "Adottiamo misure tecniche e organizzative per proteggere i tuoi dati da accessi non autorizzati.",
  privacyRightsTitle: "Diritti dell’utente",
  privacyRights:
    "Hai il diritto di accedere, modificare o cancellare i tuoi dati in qualsiasi momento.",
  privacyContact:
    "Per qualsiasi domanda sulla privacy puoi contattarci all’indirizzo email indicato nell’app.",

  // LEGAL - TERMS
  termsTitle: "Termini e Condizioni",
  termsIntro:
    "Utilizzando CLASP accetti i seguenti termini e condizioni.",
  termsUsageTitle: "Uso del servizio",
  termsUsage:
    "CLASP è una piattaforma di comunicazione sociale. È vietato l’uso improprio, illegale o offensivo del servizio.",
  termsAccountTitle: "Account",
  termsAccount:
    "Sei responsabile della sicurezza del tuo account e delle attività effettuate.",
  termsContentTitle: "Contenuti",
  termsContent:
    "Sei responsabile dei contenuti che condividi. Non sono ammessi contenuti illegali o dannosi.",
  termsTerminationTitle: "Sospensione o chiusura",
  termsTermination:
    "Ci riserviamo il diritto di sospendere o chiudere account che violano i termini.",
  termsChangesTitle: "Modifiche",
  termsChanges:
    "I termini possono essere aggiornati. Le modifiche verranno comunicate tramite l’app."

};

export default it;
