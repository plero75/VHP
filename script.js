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

// --- IDFM : TEMPS RÉEL, GROUPÉ PAR SENS, 4 PASSAGES, AVEC TEMPS EN MINUTES ---
async function fetchIDFMRealtime(ref, containerId, options = {}) {
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
    // Grouper par sens (DestinationName)
    const byDirection = {};
    visits.forEach(v => {
      const dir = getValue(v.MonitoredVehicleJourney?.DirectionName) || getValue(v.MonitoredVehicleJourney?.DestinationName) || "Inconnu";
      if (!byDirection[dir]) byDirection[dir] = [];
      byDirection[dir].push(v);
    });
    const directions = Object.entries(byDirection).slice(0, 2);
    // Pour chaque direction, afficher les 4 prochains horaires et temps en min
    let html = "";
    directions.forEach(([dir, passList], idx) => {
      html += `<div class="${containerId.startsWith('rer') ? "rer-direction" : "bus-direction"}"><b>Direction ${dir}</b> :<ul>`;
      passList.slice(0, 4).forEach(v => {
        const aimed = v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
        const dt = aimed ? new Date(aimed) : null;
        const now = new Date();
        const mins = dt ? Math.round((dt - now) / 60000) : null;
        html += `<li>
          <span class="badge-time">${dt ? dt.toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"}) : "?"}</span>
          <span class="temps">${mins !== null ? (mins > 0 ? `dans ${mins} min` : "à l'instant") : ""}</span>
        </li>`;
      });
      html += `</ul></div>`;
    });

    // Heures de début/fin de service (sur la journée)
    const todayStr = new Date().toISOString().split("T")[0];
    const allToday = visits
      .map(v => v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime)
      .filter(t => t && t.startsWith(todayStr))
      .map(t => new Date(t))
      .sort((a, b) => a - b);
    if (allToday.length) {
      html += `<div class="service-hours">⏰ Début service : ${allToday[0].toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} · Fin service : ${allToday[allToday.length-1].toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>`;
    }
    // Trafic (retard, travaux)
    if (options.lineId) {
      html += await fetchIDFMDisruptions(options.lineId);
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="status warning">⛔ Temps réel IDFM indisponible (${e.message})</div>`;
  }
}

// --- INFOS TRAFIC ---
async function fetchIDFMDisruptions(lineId) {
  const url = `${PROXY_URL}?url=https://prim.iledefrance-mobilites.fr/marketplace/lines/${encodeURIComponent(lineId)}/disruptions`;
  try {
    const res = await fetch(url, {cache:"no-store"});
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    const disruptions = data.disruptions || [];
    if (disruptions.length) {
      // Prends la dernière ou la plus importante, ou affiche tout :
      return `<div class="status warning">🚧 ${disruptions[0].cause || disruptions[0].title || "Info trafic"}</div>`;
    }
    return `<div class="status">Trafic normal</div>`;
  } catch {
    return `<div class="status warning">Info trafic indisponible</div>`;
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
  // Les fetchIDFMRealtime vont eux-mêmes appeler l'affichage avec pictos/direction
fetchIDFMRealtime("STIF:StopArea:SP:43135:", "rer-content", { lineId: "STIF:Line::C01742:" });     // RER A Vincennes
fetchIDFMRealtime("STIF:StopArea:SP:463641:", "bus77-content", { lineId: "STIF:Line::C01777:" }); // Bus 77
fetchIDFMRealtime("STIF:StopArea:SP:463644:", "bus201-content", { lineId: "STIF:Line::C01201:" });// Bus 201
  updateLastUpdate();
}

// --- Lancements périodiques ---
refreshAll();
setInterval(refreshAll, 60000);
setInterval(updateDateTime, 1000);
