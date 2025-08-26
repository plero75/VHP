// IDs & configuration
window.CONFIG = {
  PROXY: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=",
  COORDS: { lat: 48.835, lon: 2.440 }, // Hippodrome Vincennes approx
  // MonitoringRef (SIRI)
  STOPS: {
    RER_A_JOINVILLE: "STIF:StopPoint:Q:43135:",      // RER A (StopPoint). Possible d'utiliser StopArea si besoin.
    BUS_77_HIPPODROME: "STIF:StopArea:SP:463641:",
    BUS_201_BREUIL: "STIF:StopArea:SP:463644:"
  },
  // Optionnel: filtres lignes pour trafic
  LINE_FILTERS: {
    RER_A: ["IDFM:Line::C01742:"], // à ajuster avec le vrai LineRef si besoin
    BUS_NEAR_JOINVILLE: ["77","201"] // ou LineRef IDFM
  },
  // Velib stations
  VELIB: {
    VINCENNES: { station_id: "1074333296", stationCode: "12163", label: "Vincennes" },
    BREUIL:    { station_id: "508042092", stationCode: "12128", label: "Breuil" }
  },
  FEATURES: {
    SHOW_VIGILANCE: false
  },
  REFRESH_MS: {
    STOP_MONITORING: 30000,
    TRAFFIC: 60000,
    VELIB: 60000,
    WEATHER: 600000,
    NEWS: 120000,
    RACES: 900000
  }
};
