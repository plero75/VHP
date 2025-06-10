// --- CONFIG PROXY ---
const PROXY_URL = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/';

// --- Liste des stations Vélib à surveiller ---
const velibStations = [
  { code: "12163", container: "velib-vincennes", name: "Vincennes - République" },
  { code: "12128", container: "velib-breuil", name: "Château de Vincennes - Breuil" }
];

// --- Map des stop_area_id Navitia pour affichage horaires théoriques ---
const stopAreaIdMap = {
  'rer-content': 'stop_area:IDFM:43135',     // RER A Vincennes
  'bus77-content': 'stop_area:IDFM:463641',  // Bus 77
  'bus201-content': 'stop_area:IDFM:463644', // Bus 201
};

// --- Map des line_id Navitia ---
const lineIdMap = {
  'rer-content': 'line:IDFM:C01742',    // RER A
  'bus77-content': 'line:IDFM:C01777',  // Bus 77
  'bus201-content': 'line:IDFM:C01201', // Bus 201
};

// --- Utilitaires ---
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
    updateVelibCard(sta.container, {
      name: station.name,
      mechanical: station.mechanical ?? "?",
      ebike: station.ebike ?? "?",
      free_docks: station.numdocksavailable ?? "?",
      status: station.status
    });
  }
}

// --- PICTOS LISIBLES VELIB ---
function updateVelibCard(stationId, data) {
  const card = document.getElementById(stationId);
  card.innerHTML = `
    <span class="velib-station-name">${data.name}</span>
    <div style="display: flex; flex-direction: row; gap: 22px; align-items: center; margin-top: 6px;">
      <span title="Vélos mécaniques" style="display:flex;align-items:center;gap:6px;">
        <svg width="28" height="28" viewBox="0 0 28 28" style="background:#fff;border-radius:50%">
          <circle cx="8" cy="20" r="5" fill="#fff" stroke="#2ecc40" stroke-width="2"/>
          <rect x="12" y="15" width="8" height="2" fill="#2ecc40" rx="1"/>
          <rect x="17" y="12" width="2" height="8" fill="#2ecc40" rx="1"/>
        </svg>
        <span style="font-size:1.2em;font-weight:bold;">${data.mechanical}</span>
      </span>
      <span title="Vélos électriques" style="display:flex;align-items:center;gap:6px;">
        <svg width="28" height="28" viewBox="0 0 28 28" style="background:#fff;border-radius:50%">
          <circle cx="8" cy="20" r="5" fill="#fff" stroke="#0074d9" stroke-width="2"/>
          <rect x="12" y="15" width="8" height="2" fill="#0074d9" rx="1"/>
          <rect x="17" y="12" width="2" height="8" fill="#0074d9" rx="1"/>
          <polyline points="13,14 15,18 11,18" fill="none" stroke="#f4d03f" stroke-width="2"/>
        </svg>
        <span style="font-size:1.2em;font-weight:bold;">${data.ebike}</span>
      </span>
      <span title="Bornes libres" style="display:flex;align-items:center;gap:6px;">
        <svg width="28" height="28" viewBox="0 0 28 28" style="background:#fff;border-radius:50%">
          <rect x="11" y="7" width="6" height="14" rx="2" fill="#aaa" stroke="#555" stroke-width="1"/>
          <rect x="13" y="11" width="2" height="6" fill="#fff"/>
        </svg>
        <span style="font-size:1.2em;font-weight:bold;">${data.free_docks}</span>
      </span>
    </div>
    <div style="margin-top:6px; font-size:0.98em;">
      <span style="color:#ffd900;">Total dispo : ${parseInt(data.mechanical) + parseInt(data.ebike)}</span> · 
      <span style="color:${data.status === "OPEN" ? "#0c0" : "#f00"};">${data.status === "OPEN" ? "Ouverte" : "Fermée"}</span>
    </div>
  `;
}

// --- INFOS TRAFIC NAVITIA (RER/BUS) ---
async function fetchNavitiaDisruptions(lineId) {
  const navitiaDisruptionsUrl = `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/coverage/fr-idf/lines/${lineId}/disruptions`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(navitiaDisruptionsUrl)}`;
  try {
    const res = await fetch(url, {cache:"no-store"});
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    if (data.disruptions && data.disruptions.length) {
      return `<div class="status warning" style="margin-top:10px;">🚧 ${data.disruptions.map(
        d => d.cause || d.messages?.[0]?.text || d.severity?.effect_name || d.severity?.name || "Perturbation"
      ).join('<br>')}</div>`;
    }
    return `<div class="status">Trafic normal</div>`;
  } catch {
    return `<div class="status warning">Info trafic indisponible</div>`;
  }
}

// --- HORAIRES THÉORIQUES NAVITIA ---
async function fetchTheoreticalServiceHours(stopAreaId) {
  const today = new Date().toISOString().split("T")[0].replace(/-/g,"");
  const navitiaUrl = `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/coverage/fr-idf/stop_areas/${stopAreaId}/route_schedules?from_datetime=${today}T000000`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(navitiaUrl)}`;
  try {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    let allTimes = [];
    for (const rs of data.route_schedules || []) {
      for (const row of rs.table?.rows || []) {
        for (const stopTime of row.stop_date_times || []) {
          if (stopTime.arrival_time) allTimes.push(stopTime.arrival_time);
        }
      }
    }
    allTimes = allTimes.sort();
    if (allTimes.length) {
      return {
        start: allTimes[0].slice(0,5), // "HH:MM"
        end: allTimes[allTimes.length-1].slice(0,5)
      };
    }
    return null;
  } catch (e) {
    return null;
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

    // Horaires théoriques début/fin de service (Navitia)
    const stopAreaId = stopAreaIdMap[containerId];
    if (stopAreaId) {
      const serviceHours = await fetchTheoreticalServiceHours(stopAreaId);
      if (serviceHours) {
        html += `<div class="service-hours">⏰ Service théorique : ${serviceHours.start} - ${serviceHours.end}</div>`;
      }
    }

    // Info trafic via Navitia
    const lineId = lineIdMap[containerId];
    if (lineId) {
      html += await fetchNavitiaDisruptions(lineId);
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
  fetchIDFMRealtime("STIF:StopArea:SP:43135:", "rer-content");
  fetchIDFMRealtime("STIF:StopArea:SP:463641:", "bus77-content");
  fetchIDFMRealtime("STIF:StopArea:SP:463644:", "bus201-content");
  updateLastUpdate();
}

// --- Lancements périodiques ---
refreshAll();
setInterval(refreshAll, 60000);
setInterval(updateDateTime, 1000);
