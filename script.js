// --- CONFIG PROXY ---
const PROXY_URL = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/';

async function fetchIDFMRealtime(ref, containerId) {
  // ref doit être du type "STIF:StopArea:SP:43135:"
  const apiBase = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring";
  // Ici, encodeURIComponent sur le paramètre, PAS DEUX FOIS!
  const apiUrl = `${apiBase}?MonitoringRef=${encodeURIComponent(ref)}`;
  // Ensuite, encodeURIComponent sur toute l'URL cible pour le proxy
  const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=${encodeURIComponent(apiUrl)}`;
   
   const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    const visits = (data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit) || [];
    if (!visits.length) {
      el.innerHTML = `<div class="status warning">Aucun passage à venir pour cet arrêt.</div>`;
      return;
    }
    el.innerHTML = visits.slice(0, 5).map(v => {
      const aimed = v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
      const dt = aimed ? new Date(aimed) : null;
      const dest = v.MonitoredVehicleJourney?.DestinationName?.[0] || '';
      const line = v.MonitoredVehicleJourney?.LineRef || '';
      const now = new Date();
      const mins = dt ? Math.round((dt - now) / 60000) : null;
      return `<span class="badge-time">${dt ? dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "?"}</span>
        <b>${line}</b> → ${dest} <span class="small">${mins !== null ? (mins > 0 ? `dans ${mins} min` : "à l'instant") : ""}</span>`;
    }).join("<br>");
  } catch (e) {
    el.innerHTML = `<div class="status warning">⛔ Temps réel IDFM indisponible (${e.message})</div>`;
  }
}

// --- VELIB' ---
const velibStations = [
  { name: "Pyramide - Ecole du Breuil", container: "velib-breuil" },
  { code: "12163", container: "velib-vincennes" }
];

function normalizeString(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function fetchAndDisplayAllVelibStations() {
  const url = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json";
  let stations;
  try {
    const res = await fetch(url, { cache: "no-store" });
    stations = await res.json();
    if (!Array.isArray(stations)) throw new Error("Réponse Vélib' inattendue");
  } catch (e) {
    velibStations.forEach(sta => {
      const el = document.getElementById(sta.container);
      if (el) el.innerHTML = `<div class="status warning">Erreur Vélib (Paris) : ${e.message}</div>`;
    });
    return;
  }
  for (const sta of velibStations) {
    const el = document.getElementById(sta.container);
    if (!el) {
      console.warn("Bloc HTML manquant pour", sta.container);
      continue;
    }
    let station;
    if (sta.code) {
      station = stations.find(s => s.stationcode === sta.code);
    } else if (sta.name) {
      station = stations.find(s => normalizeString(s.name) === normalizeString(sta.name));
    }
    if (!station) {
      el.innerHTML = `<div class="status warning">Station Vélib’ non trouvée.</div>`;
      continue;
    }
    el.innerHTML = `
      <b>${station.name}</b><br>
      Vélos mécaniques dispo : ${station.mechanical}<br>
      Vélos électriques dispo : ${station.ebike}<br>
      Bornes libres : ${station.numdocksavailable}<br>
      Vélos totaux disponibles : ${station.numbikesavailable}<br>
      État : ${station.status === "OPEN" ? "Ouverte" : "Fermée"}
    `;
  }
}

// --- MÉTÉO ---
async function updateWeather() {
  const el = document.getElementById("weather-content");
  if (!el) return;
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true", { cache: "no-store" });
    const data = await res.json();
    const w = data.current_weather;
    el.textContent = `🌤 ${w.temperature}°C · Vent ${w.windspeed} km/h`;
  } catch {
    el.textContent = "🌤 Météo indisponible";
  }
}

// --- HORLOGE ---
function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById("current-date");
  const timeEl = document.getElementById("current-time");
  if (dateEl) dateEl.textContent = now.toLocaleDateString("fr-FR");
  if (timeEl) timeEl.textContent = now.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// --- MISE À JOUR ---
function updateLastUpdate() {
  const el = document.getElementById("last-update");
  if (el) {
    el.textContent = "Dernière mise à jour : " +
      new Date().toLocaleString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
  }
}

// --- CLEAR ---
function clearAllBlocks() {
  ["bus77-content", "bus201-content", "rer-content", "velib-breuil", "velib-vincennes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

// --- REFRESH GLOBAL ---
async function refreshAll() {
  clearAllBlocks();
  updateDateTime();
  updateWeather();
  fetchAndDisplayAllVelibStations();
  fetchIDFMRealtime("STIF:StopArea:SP:43135:", "rer-content");     // RER A Vincennes
  fetchIDFMRealtime("STIF:StopArea:SP:463641:", "bus77-content"); // Bus 77
  fetchIDFMRealtime("STIF:StopArea:SP:463644:", "bus201-content");// Bus 201
  updateLastUpdate();
}

refreshAll();
setInterval(refreshAll, 60000);
setInterval(updateDateTime, 1000);
