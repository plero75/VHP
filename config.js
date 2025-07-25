export const CONFIG = {
  PROXY_BASE: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=",

  STOPS: {
    STIF:StopPoint:Q:43135:
    rerA_area: "STIF:StopArea:SP:475771:", // Joinville-le-Pont (zone complète, recommandé pour l'affichage RER A)
    rerA_point: "STIF:StopPoint:Q:43135:",
", // Joinville-le-Pont (point précis, rarement utile pour l'affichage grand public)
    bus77: "STIF:StopArea:SP:463641:",
    bus201: "STIF:StopArea:SP:463644:"
  },

  LINES: {
    rerA: "line:IDFM:C01742",
    bus77_201: "line:IDFM:C02251",
    bus201_alt: "line:IDFM:C01219"
  },

  VELIB: {
    vincennes: { station_id: 1074333296, stationCode: "12163" },
    breuil: { station_id: 508042092, stationCode: "12128" }
  },

  NEWS_URL: "https://raw.githubusercontent.com/plero75/VHP/main/news.json",
  RACES_URL: "https://raw.githubusercontent.com/plero75/VHP/main/races.json",

  WEATHER_URL: "https://api.open-meteo.com/v1/forecast?latitude=48.828&longitude=2.435&current=temperature_2m,weathercode&timezone=Europe%2FParis"
};
