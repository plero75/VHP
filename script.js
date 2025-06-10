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

function getValue(val) {
  if (Array.isArray(val)) return getValue(val[0]);
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

// --- VELIB' avec pictos ---
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

function updateVelibCard(stationId, data) {
  const card = document.getElementById(stationId);
  card.innerHTML = `
    <span class="velib-station-name">${data.name}</span>
    <div style="display: flex; flex-direction: row; gap: 22px; align-items: center; margin-top: 6px;">
      <span title="Vélos mécaniques" style="display:flex;align-items:center;gap:6px;">
        <svg viewBox="0 0 24 24" width="24" height="24" class="velib-picto"><circle cx="7" cy="17" r="3" fill="#555"/><circle cx="17" cy="17" r="3" fill="#555"/><rect x="10" y="16" width="4" height="2" fill="#555"/><rect x="9" y="10" width="6" height="2" fill="#0a0"/></svg>
        <span>${data.mechanical}</span>
      </span>
      <span title="Vélos électriques" style="display:flex;align-items:center;gap:6px;">
        <svg viewBox="0 0 24 24" width="24" height="24" class="velib-picto"><circle cx="7" cy="17" r="3" fill="#555"/><circle cx="17" cy="17" r="3" fill="#555"/><polyline points="11,13 13,13 12,16" fill="none" stroke="#fc0" stroke-width="2"/><rect x="9" y="10" width="6" height="2" fill="#0af"/></svg>
        <span>${data.ebike}</span>
      </span>
      <span title="Bornes libres" style="display:flex;align-items:center;gap:6px;">
        <svg viewBox="0 0 24 24" width="24" height="24" class="velib-picto"><rect x="10" y="8" width="4" height="8" rx="1" fill="#aaa"/><rect x="11" y="10" width="2" height="4" fill="#fff"/></svg>
        <span>${data.free_docks}</span>
      </span>
    </div>
    <div style="margin-top:6px; font-size:0.98em;">
      <span style="color:#ffd900;">Total dispo : ${data.mechanical + data.ebike}</span> · 
      <span style="color:${data.status === "OPEN" ? "#0c0" : "#f00"};">${data.status === "OPEN" ? "Ouverte" : "Fermée"}</span>
    </div>
  `;
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
      return `<div class="status warning" style="margin-top:10px;">🚧 ${disruptions.map(d => d.cause || d.title).join('<br>')}</div>`;
    }
    return `<div class="status">Trafic normal</div>`;
  } catch {
    return `<div class="status warning">Info trafic indisponible</div>`;
  }
}

// --- TEMPS RÉEL RER/BUS AVEC PICTOS, PASSAGES SUR UNE LIGNE ET INFOS TRAFIC ---
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

    // Pictos
    const rerPicto = `
      <svg class="rer-picto" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#e2001a" stroke-width="3"/><text x="12" y="16" font-size="10" text-anchor="middle" fill="#e2001a" font-family="Arial" font-weight="bold">A</text></svg>
    `;
    const makeBusPicto = (lineNum) => `
      <svg class="bus-picto" viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="7" width="18" height="8" rx="2" fill="#009f4d"/><circle cx="7" cy="17" r="2" fill="#222"/><circle cx="17" cy="17" r="2" fill="#222"/><text x="12" y="13" font-size="7" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">${lineNum}</text></svg>
    `;

    let html = "";
    directions.forEach(([dir, passList]) => {
      const picto = containerId.startsWith('rer') ? rerPicto :
                    containerId.startsWith('bus77') ? makeBusPicto(77) :
                    containerId.startsWith('bus201') ? makeBusPicto(201) : '';
      html += `<div class="${containerId.startsWith('rer') ? "rer-direction" : "bus-direction"}">
        <span style="display:inline-flex;align-items:center;gap:6px;">
          ${picto}
          <b>Direction ${dir}</b>
        </span>
        <br>
        <div style="display:flex;gap:16px;margin-bottom:8px;">`;
      passList.slice(0, 4).forEach(v => {
        const aimed = v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
        const dt = aimed ? new Date(aimed) : null;
        const now = new Date();
        const mins = dt ? Math.round((dt - now) / 60000) : null;
        html += `<span class="badge-time" style="display:inline-block;min-width:55px;text-align:center;">
          ${dt ? dt.toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"}) : "?"}
          <span class="temps" style="font-size:0.95em;color:#ffd900;">${mins !== null ? (mins > 0 ? `(${mins} min)` : "(à l'instant)") : ""}</span>
        </span>`;
      });
      html += `</div></div>`;
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
  // Les fetchIDFMRealtime vont eux-mêmes appeler l'affichage avec pictos/direction/trafic
  fetchIDFMRealtime("STIF:StopArea:SP:43135:", "rer-content", { lineId: "STIF:Line::C01742:" });     // RER A Vincennes
  fetchIDFMRealtime("STIF:StopArea:SP:463641:", "bus77-content", { lineId: "STIF:Line::C01777:" }); // Bus 77
  fetchIDFMRealtime("STIF:StopArea:SP:463644:", "bus201-content", { lineId: "STIF:Line::C01201:" });// Bus 201
  updateLastUpdate();
}

// --- Lancements périodiques ---
refreshAll();
setInterval(refreshAll, 60000);
setInterval(updateDateTime, 1000);
