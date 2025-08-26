// === CONFIG VHP – Hippodrome de Vincennes ===
window.CONFIG = {
  // Proxy Cloudflare (injection des clés + CORS)
  PROXY: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=",

  // Coordonnées Hippodrome (météo)
  COORDS: { lat: 48.835, lon: 2.440 },

  // --- Arrêts principaux (MonitoringRef SIRI) ---
  STOPS: {
    // RER A — Joinville-le-Pont
    // NB: tu peux utiliser le StopArea pour capter plusieurs points d'arrêt si dispo côté producteur
    RER_A_JOINVILLE_STOPPOINT: "IDFM:70640",
    RER_A_JOINVILLE_STOPAREA:  "IDFM:70640",

    // Bus locaux côté Hippodrome / Breuil (fournis par toi)
    BUS_77_HIPPODROME: "IDFM:463641",
    BUS_201_BREUIL:    "IDFM:463644"
  },

  // --- Références de lignes (pour l'API /general-message trafic) ---
  LINE_REFS: {
    // Confirmé
    RER_A: "line:IDFM:C01742",

    // Si tu connais les LineRef IDFM exactes des lignes bus, mets-les ici (sinon on filtrera par StopAreaRef)
    // Exemples : "STIF:Line::C0XXXX:"
    BUS_77: "line:IDFM:C02251",
    BUS_201: "line:IDFM:C02251"
  },

  // --- Vélib’ (stations proches) ---
  VELIB: {
    VINCENNES: { station_id: "1074333296", stationCode: "12163", label: "Vincennes" },
    BREUIL:    { station_id: "508042092",  stationCode: "12128", label: "Breuil" }
  },

  // --- "Tous les bus de Joinville-le-Pont" ---
  // On gère ça de 2 façons possibles côté app.js :
  //  A) par liste de lignes (ci-dessous), avec découverte auto des StopAreaRef autour de Joinville
  //  B) par StopAreaRef connus si tu veux figer (tu pourras remplacer/compléter ensuite)
  JOINVILLE_HUB: {
    // géoloc Joinville RER (approchée) pour discovery si tu l'actives dans l'app
    GEO: { lat: 48.8229, lon: 2.4634, radius_m: 250 },

    // Liste des lignes à prendre en compte autour de Joinville-le-Pont
    // (codes "publics" visibles voyageur ; l’app peut faire la correspondance vers LineRef/StopArea via SIRI/GTFS)
    LINES: [
      "77",     // déjà couvert mais utile si discovery activée
      "108",
      "110",
      "201",    // déjà couvert
      "281",
      "317",
      "393",
      "N33"     // Noctilien
    ],

    // Option : si tu connais déjà les StopAreaRef bus exacts à Joinville, tu peux les lister ici
    // et l'app montera directement les cartes sans discovery.
    // Exemple (remplace par les bons SP:.... quand tu les as) :
    KNOWN_STOP_AREAS: [
      // "STIF:StopArea:SP:70xxx:", // Bus 108 — Joinville-le-Pont RER (exemple)
      // "STIF:StopArea:SP:70yyy:", // Bus 110 — Joinville-le-Pont RER (exemple)
      // ...
    ]
  },

  // --- Fréquences de rafraîchissement ---
  REFRESH_MS: {
    STOP_MONITORING: 30000,  // passages temps réel
    TRAFFIC:         120000,  // info trafic
    VELIB:           30000,  // disponibilité vélos
    WEATHER:        600000,  // météo
    NEWS:            60000,  // carrousel actus
    RACES:          600000   // programme courses
  }
};
