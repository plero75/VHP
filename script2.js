// =============================
//  CONFIGURATION & CONSTANTES
// =============================

// Clé API PRIM Navitia
const API_KEY = "pKjUX6JVy3uLQJXsT0cfkFbsPJZUsKob";
const PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
const VELIB_IDS = { vincennes: "1074333296", breuil: "508042092" };

// Références des points d'arrêt à afficher (adapter si tu changes)
const STOP_POINTS = {
  rer: {
    name: "RER A Joinville-le-Pont",
    realtimeUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:43135:",
    scheduleUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:monomodalStopPlace:43135/route_schedules?line=line:IDFM:C01742&from_datetime=",
    icon: "img/picto-rer-a.svg"
  },
  bus77: {
    name: "BUS 77 Hippodrome de Vincennes",
    realtimeUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463641:",
    scheduleUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463640/route_schedules?line=line:IDFM:C02251&from_datetime=",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "BUS 201 Ecole du Breuil",
    realtimeUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463644:",
    scheduleUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463646/route_schedules?line=line:IDFM:C01219&from_datetime=",
    icon: "img/picto-bus.svg"
  }
};

const VEHICLE_JOURNEY_CACHE = {}; // { [ref]: arrêts[] }

// ============ OUTILS ==============

// Appel fetch JSON générique (clé API si besoin)
async function fetchJSON(url, apiKey = false) {
  const options = apiKey ? { headers: { apikey: API_KEY } } : {};
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  return await res.json();
}

// Formattage des heures/minutes
function formatTime(iso, withSec = false) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "-";
  const opts = withSec ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : { hour: "2-digit", minute: "2-digit" };
  return date.toLocaleTimeString("fr-FR", opts);
}
function formatDateFr(d = new Date()) {
  return d.toLocaleDateString("fr-FR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function minutesUntil(iso) {
  const now = new Date();
  const target = new Date(iso);
  const diff = (target - now) / 60000;
  if (isNaN(diff)) return "";
  if (diff < 1.5) return `<span class='imminent'>(passage imminent)</span>`;
  return `<span class='temps'> (${Math.round(diff)} min)</span>`;
}
function getDestinationName(d) {
  if (!d) return "Inconnue";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d[0]?.value || "Inconnue";
  if (typeof d === "object") return d.value || "Inconnue";
  return "Inconnue";
}

// Récupère la liste des arrêts pour un train/bus (cache côté JS)
async function fetchStopsForJourney(vehicleJourneyRef) {
  if (VEHICLE_JOURNEY_CACHE[vehicleJourneyRef]) {
    return VEHICLE_JOURNEY_CACHE[vehicleJourneyRef];
  }
  const url = PROXY + `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${encodeURIComponent(vehicleJourneyRef)}/stop_points`;
  try {
    const data = await fetchJSON(url, true);
    const stops = (data.stop_points || []).map(sp => sp.name).filter(Boolean);
    VEHICLE_JOURNEY_CACHE[vehicleJourneyRef] = stops;
    return stops;
  } catch (e) {
    console.warn("Arrêts Navitia indisponibles pour", vehicleJourneyRef, e);
    return [];
  }
}

// ========== AFFICHAGE DES BLOCS ==========

// Affiche le bloc "disponibilités" date/heure
function updateDateBloc() {
  document.getElementById("date-bloc").innerHTML =
    `Nous sommes le <strong>${formatDateFr()}</strong> — il est <strong>${formatTime(new Date())}</strong>`;
}

// Affiche la météo (appel à compléter par la vraie API météo si besoin)
function updateWeatherBloc(temp = 32, condition = "Soleil") {
  document.getElementById("weather-bloc").innerHTML =
    `<div class='bloc-titre'><img src='img/picto-meteo.svg' class='icon-inline'>Météo</div>
     <div>🌡️ Température : <b>${temp}°C</b></div>
     <div>☀️ ${condition}</div>`;
}

// Affiche le bloc info trafic (personnalise ou auto)
function updateInfoTraficBloc(txt = "Travaux d'été RER A<br>Bus 77 : arrêt Hippodrome en service<br>Bus 201 : trafic normal") {
  document.getElementById("info-trafic-bloc").innerHTML =
    `<div class='bloc-titre'><img src='img/picto-info.svg' class='icon-inline'>Info trafic</div>
     <div>${txt}</div>`;
}

// Affiche les passages pour un arrêt, séparés par directions (4 passages/direction)
async function renderDepartures(elementId, stopKey, data, icon, first, last) {
  const el = document.getElementById(elementId);
  if (!data || data.length === 0) {
    el.innerHTML = `<div class='title-line'><img src='${icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div><ul><li>Aucun passage à venir</li></ul>`;
    return;
  }

  // Regroupement par direction
  const directions = {};
  for (let d of data) {
    const dir = getDestinationName(d.MonitoredVehicleJourney.DirectionName);
    if (!directions[dir]) directions[dir] = [];
    directions[dir].push(d);
  }

  let html = `<div class='title-line'><img src='${icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div>`;
  for (const dir in directions) {
    html += `<h4 class='direction-title'>Direction <b>${dir}</b></h4><ul>`;
    for (let d of directions[dir].slice(0, 4)) {
      const call = d.MonitoredVehicleJourney.MonitoredCall;
      const expected = call.ExpectedDepartureTime;
      const aimed = call.AimedDepartureTime;
      const delay = expected && aimed && expected !== aimed ?
        `<span class='delay'>(+${Math.round((new Date(expected) - new Date(aimed)) / 60000)} min)</span>` : "";
      const isLast = d.MonitoredVehicleJourney.FirstOrLastJourney?.value === "LAST_SERVICE_OF_DAY";
      // Arrêts desservis (asynchrone)
      let stopsList = "";
      const ref = d.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;
      if (ref) {
        const stops = await fetchStopsForJourney(ref);
        stopsList = stops.length ? `<div class='defile-arrets'>🛤️ ${stops.join(" — ")}</div>` : "";
      }
      html += `<li>
        ▶ ${formatTime(expected)}${minutesUntil(expected)} ${delay} ${isLast ? "<span class='last-train'>(dernier train)</span>" : ""}
        ${stopsList}
      </li>`;
    }
    html += `</ul>`;
  }
  html += `<div class='schedule-extremes'>Premier départ : ${first || "-"}<br>Dernier départ : ${last || "-"}</div>`;
  el.innerHTML = html;
}

// ========== FETCH TEMPS RÉEL ==========

// Rafraîchir tout l'affichage
async function refreshAll() {
  updateDateBloc();
  updateWeatherBloc();
  updateInfoTraficBloc();

  fetchVelib(VELIB_IDS.vincennes, "velib-vincennes");
  fetchVelib(VELIB_IDS.breuil, "velib-breuil");
  fetchSchedulesOncePerDay();

  for (const stopKey in STOP_POINTS) {
    try {
      const data = await fetchJSON(STOP_POINTS[stopKey].realtimeUrl, true);
      const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
      await renderDepartures(
        stopKey + "-content",
        stopKey,
        visits,
        STOP_POINTS[stopKey].icon,
        localStorage.getItem(`${stopKey}-first`),
        localStorage.getItem(`${stopKey}-last`)
      );
    } catch (e) {
      document.getElementById(stopKey + "-content").innerHTML =
        `<div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div><div class='error'>Données indisponibles</div>`;
      console.error(`Erreur fetchTransport ${stopKey}:`, e);
    }
  }
}

// Stocker les horaires premier/dernier départs une fois par jour
async function fetchSchedulesOncePerDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("schedule-day") === today) return;
  for (let key in STOP_POINTS) {
    try {
      const url = STOP_POINTS[key].scheduleUrl + today.replace(/-/g, "") + "T000000";
      const data = await fetchJSON(url, true);
      const rows = data.route_schedules?.[0]?.table?.rows || [];
      const times = [];
      rows.forEach(row => {
        row.stop_date_times?.forEach(sdt => {
          if (sdt.departure_time) times.push(sdt.departure_time);
        });
      });
      times.sort();
      if (times.length) {
        const fmt = t => `${t.slice(0, 2)}:${t.slice(2, 4)}`;
        localStorage.setItem(`${key}-first`, fmt(times[0]));
        localStorage.setItem(`${key}-last`, fmt(times[times.length - 1]));
      }
    } catch (e) {
      console.error(`Erreur fetchSchedulesOncePerDay ${key}:`, e);
    }
  }
  localStorage.setItem("schedule-day", today);
}

// Bloc Vélib
async function fetchVelib(stationId, elementId) {
  try {
    const url = PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";
    const data = await fetchJSON(url, true);
    const station = data.data.stations.find(s => s.station_id == stationId);
    if (!station) throw new Error("Station Vélib non trouvée");
    const mechanical = station.num_bikes_available_types.find(b => b.mechanical !== undefined)?.mechanical || 0;
    const ebike = station.num_bikes_available_types.find(b => b.ebike !== undefined)?.ebike || 0;
    const free = station.num_docks_available || 0;
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      🚲 Mécaniques : ${mechanical}<br>
      ⚡ Électriques : ${ebike}<br>
      🅿️ Places libres : ${free}
    `;
  } catch (e) {
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      <div class='error'>Erreur chargement</div>
    `;
  }
}

// Démarrage auto et rafraîchissement régulier
refreshAll();
setInterval(refreshAll, 60000);

    MonitoringRef=STIF:StopPoint:Q:463641:",
    scheduleUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463640/route_schedules?line=line:IDFM:C02251&from_datetime=",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "BUS 201 Ecole du Breuil",
    realtimeUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463644:",
    scheduleUrl: PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463646/route_schedules?line=line:IDFM:C01219&from_datetime=",
    icon: "img/picto-bus.svg"
  }
};

// =======================
//  UTILS & FETCH
// =======================

// Appel générique proxy (clé API ajoutée pour Navitia uniquement)
async function fetchJSON(url, needsApiKey = false) {
  const headers = needsApiKey ? { "apikey": API_KEY } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  return await res.json();
}

// Date/heure en français
function formatDateTimeFR(dt = new Date()) {
  return dt.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
}
function formatHourMin(dt) {
  if (!dt) return "-";
  const d = typeof dt === "string" ? new Date(dt) : dt;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function minutesUntil(dateTimeStr) {
  const now = new Date();
  const tgt = new Date(dateTimeStr);
  const diff = (tgt - now) / 60000;
  if (isNaN(diff)) return "";
  if (diff < 1.5) return "<span class='imminent'>(passage imminent)</span>";
  return `<span class='temps'>(${Math.round(diff)} min)</span>`;
}

// =======================
//  NAVITIA – Liste des arrêts desservis pour un train/bus
// =======================
async function fetchStopsForJourney(ref) {
  if (!ref) return [];
  if (VEHICLE_JOURNEY_CACHE[ref]) return VEHICLE_JOURNEY_CACHE[ref];

  const url = `${PROXY}https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${encodeURIComponent(ref)}/stop_points`;
  try {
    const data = await fetchJSON(url, true);
    const stops = (data.stop_points || []).map(sp => sp.name).filter(Boolean);
    VEHICLE_JOURNEY_CACHE[ref] = stops;
    return stops;
  } catch (e) {
    console.warn("Arrêts Navitia non trouvés :", e);
    VEHICLE_JOURNEY_CACHE[ref] = [];
    return [];
  }
}

// =======================
//  AFFICHAGE PASSAGES LIGNE (par directions, retards, arrêts, etc.)
// =======================
async function renderDepartures(id, title, data, icon, first, last) {
  const el = document.getElementById(id);
  let html = `<div class='title-line'><img src='${icon}' class='icon-inline'>${title}</div>`;

  if (!data || data.length === 0) {
    html += "<ul><li>Aucun passage à venir</li></ul>";
    el.innerHTML = html;
    return;
  }
  // Regroupe par direction
  const grouped = {};
  for (const d of data) {
    const mvj = d.MonitoredVehicleJourney;
    const dir = mvj.DirectionName?.[0]?.value || "Direction inconnue";
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(d);
  }
  for (const dir in grouped) {
    html += `<h4 class='direction-title'>Direction ${dir}</h4><ul>`;
    for (const d of grouped[dir].slice(0, 4)) {
      const mvj = d.MonitoredVehicleJourney;
      const call = mvj.MonitoredCall;
      const expected = call.ExpectedDepartureTime;
      const aimed = call.AimedDepartureTime;
      const isLast = mvj.FirstOrLastJourney?.value === "LAST_SERVICE_OF_DAY";
      const delay = expected && aimed && expected !== aimed
        ? `<span class='delay'>(+${Math.round((new Date(expected) - new Date(aimed)) / 60000)} min)</span>` : "";

      const ref = mvj.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;
      let stopsHtml = "";
      if (ref) {
        // Ajout d’un loader en attendant
        stopsHtml = `<div class='defile-arrets' id='arrets-${ref.replace(/[^a-zA-Z0-9]/g, "")}'>⏳ chargement arrêts…</div>`;
        // Appel asynchrone, mise à jour après
        fetchStopsForJourney(ref).then(stops => {
          const div = document.getElementById(`arrets-${ref.replace(/[^a-zA-Z0-9]/g, "")}`);
          if (div) div.innerHTML = stops.length ? stops.join(" • ") : "Arrêts indisponibles";
        });
      }
      html += `<li>
        ▶ ${formatHourMin(expected)} ${minutesUntil(expected)} ${delay} ${isLast ? "<span class='last-train'>(dernier train)</span>" : ""}
        ${stopsHtml}
      </li>`;
    }
    html += "</ul>";
  }
  html += `<div class='schedule-extremes'>Premier départ : ${first || "-"}<br>Dernier départ : ${last || "-"}</div>`;
  el.innerHTML = html;
}

// =======================
//  DATA & MISE À JOUR PÉRIODIQUE
// =======================
async function fetchTransport(stopKey, elementId) {
  try {
    const data = await fetchJSON(STOP_POINTS[stopKey].realtimeUrl);
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    renderDepartures(
      elementId,
      STOP_POINTS[stopKey].name,
      visits,
      STOP_POINTS[stopKey].icon,
      localStorage.getItem(`${stopKey}-first`),
      localStorage.getItem(`${stopKey}-last`)
    );
  } catch (e) {
    console.error("Erreur fetchTransport", stopKey, e);
    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div><div class='error'>Données indisponibles</div>`;
  }
}

async function fetchSchedulesOncePerDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("schedule-day") === today) return;
  for (let key in STOP_POINTS) {
    try {
      const url = STOP_POINTS[key].scheduleUrl + today.replace(/-/g, "") + "T000000";
      const data = await fetchJSON(url, true);
      const rows = data.route_schedules?.[0]?.table?.rows || [];
      const times = [];
      rows.forEach(row => {
        row.stop_date_times?.forEach(sdt => {
          if (sdt.departure_time) times.push(sdt.departure_time);
        });
      });
      times.sort();
      if (times.length) {
        const fmt = t => `${t.slice(0, 2)}:${t.slice(2, 4)}`;
        localStorage.setItem(`${key}-first`, fmt(times[0]));
        localStorage.setItem(`${key}-last`, fmt(times[times.length - 1]));
      }
    } catch (e) {
      console.error("Erreur fetchSchedulesOncePerDay", key, e);
    }
  }
  localStorage.setItem("schedule-day", today);
}

// =======================
//  VELIB (via proxy)
// =======================
async function fetchVelib(stationId, elementId) {
  try {
    const url = PROXY + "https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";
    const data = await fetchJSON(url, true);
    const station = data.data.stations.find(s => s.station_id == stationId);
    if (!station) throw new Error("Station Vélib non trouvée");
    const mechanical = station.num_bikes_available_types.find(b => b.mechanical !== undefined)?.mechanical || 0;
    const ebike = station.num_bikes_available_types.find(b => b.ebike !== undefined)?.ebike || 0;
    const free = station.num_docks_available || 0;
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      🚲 Mécaniques : ${mechanical}<br>
      ⚡ Électriques : ${ebike}<br>
      🅿️ Places libres : ${free}
    `;
  } catch (e) {
    console.error("Erreur Vélib:", e);
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      <div class='error'>Erreur chargement</div>
    `;
  }
}

// =======================
//  FONCTION DE RAFRAÎCHISSEMENT GLOBAL
// =======================
function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR", { dateStyle: "full" });
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("last-update").textContent = formatDateTimeFR(now);
}

function refreshAll() {
  updateDateTime();
  fetchSchedulesOncePerDay();
  fetchTransport("rer", "rer-content");
  fetchTransport("bus77", "bus77-content");
  fetchTransport("bus201", "bus201-content");
  fetchVelib(VELIB_IDS.vincennes, "velib-vincennes");
  fetchVelib(VELIB_IDS.breuil, "velib-breuil");
}

// Lancement périodique
setInterval(refreshAll, 60000);
refreshAll();
const stopsCache = {};
async function fetchStops(vehicleJourneyId) {
  if (stopsCache[vehicleJourneyId]) return stopsCache[vehicleJourneyId];

  const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${vehicleJourneyId}/stop_points`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur " + res.status);
  const data = await res.json();

  const stops = data.stop_points?.map(sp => sp.name) || [];
  stopsCache[vehicleJourneyId] = stops;
  return stops;
}
const stopsCache = {};
async function fetchStops(vehicleJourneyId) {
  if (stopsCache[vehicleJourneyId]) return stopsCache[vehicleJourneyId];

  const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${vehicleJourneyId}/stop_points`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur " + res.status);
  const data = await res.json();

  const stops = data.stop_points?.map(sp => sp.name) || [];
  stopsCache[vehicleJourneyId] = stops;
  return stops;
}

