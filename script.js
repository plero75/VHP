// --- CONFIG PROXY ---
const PROXY_URL = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/';

// --- Liste des stations Vélib à surveiller ---
const velibStations = [
  { code: "21005", container: "velib-vincennes", name: "Vincennes - République" },
  { code: "12036", container: "velib-breuil", name: "Château de Vincennes - Breuil" }
];

// Fonction utilitaire pour comparer les noms
function normalizeString(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// --- Extraction de valeur (corrigée pour afficher une vraie chaîne) ---
function getValue(val) {
  if (Array.isArray(val)) {
    return getValue(val[0]);
  }
  if (typeof val === "object" && val !== null) {
    if ("value" in val) return val.value;
    if ("Name" in val) return val.Name;
    if ("label" in val) return val.label;
    const keys = Object.keys(val);
    if (keys.length === 1) return getValue(val[keys[0]]);
    return JSON.stringify(val);
  }
  return val ?? "";
}

// --- IDFM : Temps réel BUS ---
async function fetchIDFMBusRealtime(ref, containerId) {
  const apiBase = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring";
  const apiUrl = `${apiBase}?MonitoringRef=${encodeURIComponent(ref)}`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(apiUrl)}`;
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
    el.innerHTML = visits.slice(0, 4).map(v => {
      const aimed = v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
      const dt = aimed ? new Date(aimed) : null;
      const dest = getValue(v.MonitoredVehicleJourney?.DestinationName);
      const line = getValue(v.MonitoredVehicleJourney?.LineRef);
      const now = new Date();
      const mins = dt ? Math.round((dt - now) / 60000) : null;
      return `<div class="bus-row">
        <span class="bus-line-idfm">${line.replace(/\D/g,'')}</span>
        <span class="bus-destination">${dest}</span>
        <span class="bus-wait">${mins !== null ? (mins > 0 ? `dans ${mins} min` : "à l'instant") : ""}</span>
      </div>`;
    }).join("");
  } catch (e) {
    el.innerHTML = `<div class="status warning">⛔ Temps réel IDFM indisponible (${e.message})</div>`;
  }
}

// --- IDFM : Temps réel RER ---
async function fetchIDFMRERRealtime(ref, containerId) {
  const apiBase = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring";
  const apiUrl = `${apiBase}?MonitoringRef=${encodeURIComponent(ref)}`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(apiUrl)}`;
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
    el.innerHTML = visits.slice(0, 4).map(v => {
      const aimed = v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
      const dt = aimed ? new Date(aimed) : null;
      const dest = getValue(v.MonitoredVehicleJourney?.DestinationName);
      const line = getValue(v.MonitoredVehicleJourney?.LineRef);
      const now = new Date();
      const mins = dt ? Math.round((dt - now) / 60000) : null;
      return `<div class="rer-row">
        <span class="rer-line-idfm">A</span>
        <span class="rer-destination">${dest}</span>
        <span class="rer-wait">${mins !== null ? (mins > 0 ? `dans ${mins} min` : "à l'instant") : ""}</span>
      </div>`;
    }).join("");
  } catch (e) {
    el.innerHTML = `<div class="status warning">⛔ Temps réel IDFM indisponible (${e.message})</div>`;
  }
}

// --- VELIB' ---
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
    if (!el) continue;
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
      <div class="velib-data">
        <b>${station.name}</b>
        <span class="ratp-code">${station.stationcode}</span><br>
        Vélos mécaniques dispo : <b>${station.mechanical ?? "?"}</b><br>
        Vélos électriques dispo : <b>${station.ebike ?? "?"}</b><br>
        Bornes libres : <b>${station.numdocksavailable ?? "?"}</b><br>
        Vélos totaux disponibles : <b>${station.numbikesavailable ?? "?"}</b><br>
        État : <b>${station.status === "OPEN" ? "Ouverte" : "Fermée"}</b>
      </div>
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
  fetchIDFMRERRealtime("STIF:StopArea:SP:43135:", "rer-content");     // RER A Vincennes
  fetchIDFMBusRealtime("STIF:StopArea:SP:463641:", "bus77-content"); // Bus 77
  fetchIDFMBusRealtime("STIF:StopArea:SP:463644:", "bus201-content");// Bus 201
  updateLastUpdate();
}

// --- Lancements périodiques ---
refreshAll();
setInterval(refreshAll, 60000);
setInterval(updateDateTime, 1000);

// Masquer le loader après les chargements
function hideLoader() {
  const loader = document.getElementById('loading-overlay');
  if(loader) {
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 400);
  }
}
