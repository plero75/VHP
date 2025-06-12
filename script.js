// script.js

const STOP_AREAS = {
  rer: "STIF:StopArea:SP:43135:",
  bus77: "STIF:StopArea:SP:463641:",
  bus201: "STIF:StopArea:SP:463644:"
};

const VELIB_IDS = {
  vincennes: "1074333296",
  breuil: "508042092"
};

const PROXY_URL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
const API_BASE = "https://prim.iledefrance-mobilites.fr/marketplace";
const PICTOS = {
  rer: "🚆",
  bus77: "🚌",
  bus201: "🚍"
};

const LINE_CODES = {
  rer: "line:IDFM:C01387",
  bus77: "line:IDFM:C01388",
  bus201: "line:IDFM:C01399"
};

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? "Invalid Date" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR");
  document.getElementById("last-update").textContent = now.toLocaleString("fr-FR");
}

async function fetchRealtime(stopArea, elementId, label, picto) {
  const url = `${PROXY_URL}${API_BASE}/stop-monitoring?MonitoringRef=${stopArea}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const journeys = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery[0]?.MonitoredStopVisit || [];

    let html = `<h2>${label}</h2>`;
    journeys.slice(0, 4).forEach(j => {
      const aimed = j.MonitoredVehicleJourney?.MonitoredCall?.AimedDepartureTime;
      html += `<div>▶ ${formatTime(aimed)} → ${picto}</div>`;
    });

    document.getElementById(elementId).innerHTML = html;
  } catch (e) {
    document.getElementById(elementId).innerHTML = `<h2>${label}</h2><p>Erreur chargement données</p>`;
  }
}

async function fetchVelib(stationId, elementId) {
  const url = `${API_BASE}/velib/station_status.json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const station = data.data.stations.find(s => s.station_id === stationId);
    if (!station) return;
    const html = `<h2>${station.name}</h2><p>Mécaniques : ${station.num_bikes_available_types.find(t => t.mechanical)?.count || 0}</p><p>Électriques : ${station.num_bikes_available_types.find(t => t.ebike)?.count || 0}</p><p>Places libres : ${station.num_docks_available}</p>`;
    document.getElementById(elementId).innerHTML = html;
  } catch {
    document.getElementById(elementId).innerHTML = `<h2>Vélib’</h2><p>Erreur chargement</p>`;
  }
}

async function fetchTrafficInfo(lineId, elementId) {
  const url = `${PROXY_URL}${API_BASE}/v2/navitia/lines/${lineId}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const disruptions = data.disruptions || [];
    const msg = disruptions.map(d => `<p>${d.message.text}</p>`).join('') || '<p>Aucune alerte</p>';
    document.getElementById(elementId).innerHTML += `<div class="disruptions">${msg}</div>`;
  } catch {
    document.getElementById(elementId).innerHTML += `<p>Infos trafic indisponibles</p>`;
  }
}

async function fetchFirstLastTimes(stopAreaId, lineId, elementId) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url = `${PROXY_URL}${API_BASE}/v2/navitia/stop_areas/stop_area:${stopAreaId}/route_schedules?line=${lineId}&from_datetime=${dateStr}T000000`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const schedules = data.route_schedules?.[0]?.table?.rows || [];
    const times = schedules.map(r => r.date_times[0]?.departure_date_time?.slice(-6)).filter(Boolean);
    if (times.length === 0) throw new Error();
    const first = times[0].slice(0, 2) + ":" + times[0].slice(2, 4);
    const last = times.at(-1).slice(0, 2) + ":" + times.at(-1).slice(2, 4);
    document.getElementById(elementId).innerHTML += `<p>Premier départ : ${first}</p><p>Dernier départ : ${last}</p>`;
  } catch {
    document.getElementById(elementId).innerHTML += `<p>Premier / Dernier : Inconnus</p>`;
  }
}

function refreshAll() {
  updateDateTime();
  fetchRealtime(STOP_AREAS.rer, "rer-content", "RER A", PICTOS.rer);
  fetchRealtime(STOP_AREAS.bus77, "bus77-content", "BUS 77", PICTOS.bus77);
  fetchRealtime(STOP_AREAS.bus201, "bus201-content", "BUS 201", PICTOS.bus201);
  fetchVelib(VELIB_IDS.vincennes, "velib-vincennes");
  fetchVelib(VELIB_IDS.breuil, "velib-breuil");
  fetchTrafficInfo(LINE_CODES.rer, "rer-content");
  fetchTrafficInfo(LINE_CODES.bus77, "bus77-content");
  fetchTrafficInfo(LINE_CODES.bus201, "bus201-content");
  fetchFirstLastTimes("IDFM:43135", LINE_CODES.rer, "rer-content");
  fetchFirstLastTimes("IDFM:463641", LINE_CODES.bus77, "bus77-content");
  fetchFirstLastTimes("IDFM:463644", LINE_CODES.bus201, "bus201-content");
}

setInterval(refreshAll, 60000);
refreshAll();
