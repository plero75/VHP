// === CONFIG VHP – Hippodrome de Vincennes ===
window.CONFIG = {
  // Proxy Cloudflare (injection des clés + CORS)
  PROXY: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=",

  // Coordonnées Hippodrome (météo)
  COORDS: { lat: 48.835, lon: 2.440 },

  // --- Arrêts principaux (MonitoringRef SIRI) — IDs IDFM (nouveau format) ---
  STOPS: {
    // RER A — Joinville-le-Pont
    RER_A_JOINVILLE_STOPAREA: "IDFM:70640",

    // Bus locaux côté Hippodrome / Breuil
    BUS_77_HIPPODROME: "IDFM:463641",
    BUS_201_BREUIL: "IDFM:463644"
  },

  // --- Références de lignes ---
  LINES: {
    RER_A: "line:IDFM:C01742",
    BUS_77: "line:IDFM:C02251",
    BUS_201: "line:IDFM:C02251"
  },

  // --- Filtres pour les messages trafic ---
  LINE_FILTERS: {
    RER_A: ["RER A", "C01742", "line:IDFM:C01742", "A"],
    BUS_77: ["77", "C02251", "line:IDFM:C02251"],
    BUS_201: ["201", "C02251", "line:IDFM:C02251"]
  },

  // --- Sources Vélib' ---
  VELIB: {
    STATIONS: [
      { id: 12163, label: "Vincennes – Hippodrome" },
      { id: 12128, label: "École du Breuil / Pyramides" }
    ]
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
