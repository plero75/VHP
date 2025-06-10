// --- CONFIG PROXY ---
const PROXY_URL = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/';

// --- Liste des stations Vélib à surveiller ---
const velibStations = [
  { code: "21005", container: "velib-vincennes", name: "Vincennes - République" },
  { code: "12036", container: "velib-breuil", name: "Château de Vincennes - Breuil" }
  // Ajoutez d'autres stations au besoin
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
    // Si l'objet a une seule clé, retourne sa valeur
    const keys = Object.keys(val);
    if (keys.length === 1) return getValue(val[keys[0]]);
    return JSON.stringify(val);
  }
  return val ?? "";
}

// --- VELIB' --- (NOUVEL AFFICHAGE AVEC PICTOS)
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
    updateVelibCard(sta.container, {
      name: station.name,
      mechanical: station.mechanical ?? "?",
      ebike: station.ebike ?? "?",
      free_docks: station.numdocksavailable ?? "?"
    });
  }
}

// --- VELIB CARD AVEC PICTOS ---
function updateVelibCard(stationId, data) {
  const card = document.getElementById(stationId);
  card.innerHTML = `
    <span class="velib-station-name">${data.name}</span>
    <div class="velib-info">
      <span class="velib-picto">
        <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="7" cy="17" r="3" fill="#555"/><circle cx="17" cy="17" r="3" fill="#555"/><rect x="10" y="16" width="4" height="2" fill="#555"/><rect x="9" y="10" width="6" height="2" fill="#0a0"/></svg>
      </span>
      ${data.mechanical}
      <span class="velib-picto">
        <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="7" cy="17" r="3" fill="#555"/><circle cx="17" cy="17" r="3" fill="#555"/><polyline points="11,13 13,13 12,16" fill="none" stroke="#fc0" stroke-width="2"/><rect x="9" y="10" width="6" height="2" fill="#0af"/></svg>
      </span>
      ${data.ebike}
      <span class="velib-picto">
        <svg viewBox="0 0 24 24" width="22" height="22"><rect x="10" y="8" width="4" height="8" rx="1" fill="#aaa"/><rect x="11" y="10" width="2" height="4" fill="#fff"/></svg>
      </span>
      ${data.free_docks}
    </div>
  `;
}

// --- IDFM : TEMPS RÉEL --- (NE FAIT QUE LES PASSAGES, PAS PICTO/DIRECTIONS)
async function fetchIDFMRealtime(ref, containerId) {
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
    // Regrouper par direction
    const directionsMap = {};
    visits.forEach(v => {
      const dir = getValue(v.MonitoredVehicleJourney?.DirectionName) || getValue(v.MonitoredVehicleJourney?.DestinationName) || "Inconnu";
      if (!directionsMap[dir]) directionsMap[dir] = [];
      directionsMap[dir].push(v);
    });
    // Prendre les deux directions principales
    const directions = Object.keys(directionsMap).slice(0, 2).map(dirName => {
      const nextVisit = directionsMap[dirName][0];
      const aimed = nextVisit.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
      const dt = aimed ? new Date(aimed) : null;
      return {
        name: dirName,
        next: dt ? dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "?"
      };
    });
    // Rendu selon le type de card
    if (containerId === 'rer-content') {
      updateRERCard({
        stationName: "Vincennes",
        direction1: directions[0] || {name:"-", next:"-"},
        direction2: directions[1] || {name:"-", next:"-"}
      });
    } else if (containerId === 'bus77-content') {
      updateBusCard(77, {
        stationName: "Hippodrome",
        direction1: directions[0] || {name:"-", next:"-"},
        direction2: directions[1] || {name:"-", next:"-"}
      });
    } else if (containerId === 'bus201-content') {
      updateBusCard(201, {
        stationName: "Hippodrome",
        direction1: directions[0] || {name:"-", next:"-"},
        direction2: directions[1] || {name:"-", next:"-"}
      });
    }
  } catch (e) {
    el.innerHTML = `<div class="status warning">⛔ Temps réel IDFM indisponible (${e.message})</div>`;
  }
}

// --- RER CARD AVEC PICTO ---
function updateRERCard(data) {
  const card = document.getElementById('rer-content');
  card.innerHTML = `
    <span class="rer-station-name">${data.stationName}</span>
    <div class="rer-direction">
      <span class="rer-picto">
        <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#e2001a" stroke-width="3"/><text x="12" y="16" font-size="10" text-anchor="middle" fill="#e2001a" font-family="Arial" font-weight="bold">A</text></svg>
      </span>
      <span>${data.direction1.name} :</span> <b>${data.direction1.next}</b>
    </div>
    <div class="rer-direction">
      <span class="rer-picto">
        <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#e2001a" stroke-width="3"/><text x="12" y="16" font-size="10" text-anchor="middle" fill="#e2001a" font-family="Arial" font-weight="bold">A</text></svg>
      </span>
      <span>${data.direction2.name} :</span> <b>${data.direction2.next}</b>
    </div>
  `;
}

// --- BUS CARD AVEC PICTO ---
function updateBusCard(busId, data) {
  const card = document.getElementById(`bus${busId}-content`);
  card.innerHTML = `
    <span class="bus-station-name">${data.stationName}</span>
    <div class="bus-direction">
      <span class="bus-picto">
        <svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="7" width="18" height="8" rx="2" fill="#009f4d"/><circle cx="7" cy="17" r="2" fill="#222"/><circle cx="17" cy="17" r="2" fill="#222"/><text x="12" y="13" font-size="7" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">${busId}</text></svg>
      </span>
      <span>${data.direction1.name} :</span> <b>${data.direction1.next}</b>
    </div>
    <div class="bus-direction">
      <span class="bus-picto">
        <svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="7" width="18" height="8" rx="2" fill="#009f4d"/><circle cx="7" cy="17" r="2" fill="#222"/><circle cx="17" cy="17" r="2" fill="#222"/><text x="12" y="13" font-size="7" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">${busId}</text></svg>
      </span>
      <span>${data.direction2.name} :</span> <b>${data.direction2.next}</b>
    </div>
  `;
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
  // Les fetchIDFMRealtime vont eux-mêmes appeler l'affichage avec pictos/direction
  fetchIDFMRealtime("STIF:StopArea:SP:43135:", "rer-content");     // RER A Vincennes
  fetchIDFMRealtime("STIF:StopArea:SP:463641:", "bus77-content"); // Bus 77
  fetchIDFMRealtime("STIF:StopArea:SP:463644:", "bus201-content");// Bus 201
  updateLastUpdate();
}

// --- Lancements périodiques ---
refreshAll();
setInterval(refreshAll, 60000);
setInterval(updateDateTime, 1000);
