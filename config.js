// === CONFIG VHP – Hippodrome de Vincennes ===
window.CONFIG = {
  // Proxy Cloudflare (utilisé seulement si pas d'API key)
  PROXY: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=",

  // Coordonnées Hippodrome (météo)
  COORDS: { lat: 48.835, lon: 2.440 },

  // PRIM direct mode (si API key renseignée, on bypasse le proxy)
  PRIM: {
    BASE: "https://prim.iledefrance-mobilites.fr/marketplace",
    APIKEY: "" // Renseigner votre clé ici pour requêtes directes (sinon le proxy est utilisé)
  },

  // --- Arrêts (MonitoringRef) – Formats STIF compatibles PRIM ---
  STOPS: {
    // RER A — Joinville-le-Pont 
    RER_A_JOINVILLE: "STIF:StopArea:SP:70640:",

    // Bus locaux
    BUS_77_HIPPODROME: "STIF:StopArea:SP:463641:",
    BUS_201_BREUIL: "STIF:StopArea:SP:463644:"
  },

  // --- Références de lignes ---
  LINES: {
    RER_A: "STIF:Line::C01742:",
    BUS_77: "STIF:Line::C02251:",
    BUS_201: "STIF:Line::C02251:"
  },

  // --- Fréquences de rafraîchissement ---
  REFRESH_MS: {
    STOP_MONITORING: 30000,  // passages temps réel
    TRAFFIC: 120000, // info trafic
    VELIB: 30000,  // disponibilité vélos
    WEATHER: 600000,  // météo
    NEWS: 60000,  // carrousel actus
    RACES: 600000   // programme courses
  }
};