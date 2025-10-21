// === CONFIG VHP – Hippodrome de Vincennes ===
window.CONFIG = {
  // Proxy Cloudflare avec clé PRIM injectée côté worker
  PROXY: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=",

  // Coordonnées Hippodrome (météo)
  COORDS: { lat: 48.835, lon: 2.440 },

  // PRIM en mode proxy uniquement (clé injectée côté worker)
  PRIM: {
    BASE: "https://prim.iledefrance-mobilites.fr/marketplace",
    APIKEY: "" // Laissé vide car clé injectée côté proxy worker
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
    STOP_MONITORING: 45000,  // passages temps réel (réduit pour éviter surcharge proxy)
    TRAFFIC: 180000, // info trafic
    VELIB: 60000,  // disponibilité vélos
    WEATHER: 300000,  // météo (plus fréquent pour test)
    NEWS: 120000,  // carrousel actus
    RACES: 600000   // programme courses
  }
};