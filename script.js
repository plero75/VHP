// =============================
//  CONFIGURATION & CONSTANTES
// =============================

const STOP_POINTS = {
  rer: {
    name: "RER A Joinville-le-Pont",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:43135:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:monomodalStopPlace:43135/route_schedules?line=line:IDFM:C01742&from_datetime=",
    icon: "img/picto-rer-a.svg"
  },
  bus77: {
    name: "BUS 77 Hippodrome de Vincennes",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463641:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463640/route_schedules?line=line:IDFM:C02251&from_datetime=",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "BUS 201 Ecole du Breuil",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463644:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463646/route_schedules?line=line:IDFM:C01219&from_datetime=",
    icon: "img/picto-bus.svg"
  }
};

const VELIB_IDS = {
  vincennes: "1074333296",
  breuil: "508042092"
};

// ===================
//   UTILS
// ===================

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  return await res.json();
}

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR", {weekday:"long", year:"numeric", month:"long", day:"numeric"});
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"});
}

function formatTime(iso, withSeconds = false) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "-";
  const options = withSeconds
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" };
  return date.toLocaleTimeString("fr-FR", options);
}

function minutesUntil(dateTimeStr) {
  const now = new Date();
  const target = new Date(dateTimeStr);
  const diff = (target - now) / 60000;
  if (isNaN(diff)) return "";
  if (diff < 1.5) return `<span class='imminent'>(passage imminent)</span>`;
  return `<span class='temps'> (${Math.round(diff)} min)</span>`;
}

function getDestinationName(d) {
  if (!d) return "Destination inconnue";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d[0]?.value || "Destination inconnue";
  if (typeof d === "object") return d.value || "Destination inconnue";
  return "Destination inconnue";
}

// ===================
//   MÉTÉO DYNAMIQUE (Open-Meteo)
// ===================

async function fetchWeather() {
  // Paris-Vincennes
  const lat = 48.8327, lon = 2.4382;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Europe%2FParis`;
  let html = `<div class='bloc-titre'><img src='img/picto-meteo.svg' class='icon-inline'>Météo</div>`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.current_weather) {
      html += `<div>🌡️ Température : <b>${Math.round(data.current_weather.temperature)}°C</b></div>`;
      html += `<div>💨 Vent : ${data.current_weather.windspeed} km/h</div>`;
      html += `<div>🌤️ Temps : ${weatherCodeToString(data.current_weather.weathercode)}</div>`;
    } else {
      html += "<div>Météo indisponible</div>";
    }
  } catch (e) {
    html += "<div>Erreur météo</div>";
  }
  document.getElementById("weather-bloc").innerHTML = html;
}

// Traduction code météo Open-Meteo
function weatherCodeToString(code) {
  const mapping = {
    0: "Ciel dégagé", 1: "Principalement dégagé", 2: "Partiellement nuageux", 3: "Couvert",
    45: "Brouillard", 48: "Brouillard givrant", 51: "Bruine légère", 53: "Bruine modérée",
    55: "Bruine dense", 56: "Bruine verglaçante légère", 57: "Bruine verglaçante dense",
    61: "Pluie faible", 63: "Pluie modérée", 65: "Pluie forte", 66: "Pluie verglaçante légère",
    67: "Pluie verglaçante forte", 71: "Neige faible", 73: "Neige modérée", 75: "Neige forte",
    77: "Grains de neige", 80: "Averses faibles", 81: "Averses modérées", 82: "Averses violentes",
    85: "Averses de neige faibles", 86: "Averses de neige fortes", 95: "Orage",
    96: "Orage avec grêle légère", 99: "Orage avec grêle forte"
  };
  return mapping[code] || "Inconnu";
}

// ===================
//   SYTADIN (Info Trafic)
// ===================

function renderSytadin() {
  document.getElementById("info-trafic-bloc").innerHTML =
    `<div class='bloc-titre'><img src='img/picto-info.svg' class='icon-inline'>Info trafic</div>
     <div>
       <a href="https://www.sytadin.fr/" target="_blank" rel="noopener">
         <button style="padding:8px 16px;font-size:1em;">Voir la carte trafic Sytadin</button>
       </a>
       <br>
       <a href="https://www.bison-fute.gouv.fr/paris-ile-de-france.html" target="_blank" rel="noopener">
         Bison Futé Paris/Île-de-France
       </a>
     </div>`;
}

// ===================
//   VELIB (avec fallback OpenData Paris)
// ===================

async function fetchVelib(stationId, elementId) {
  // Essai PRIM IDFM
  try {
    const url = "https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";
    const data = await fetchJSON(url);
    const station = data?.data?.stations?.find(s => s.station_id == stationId);
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
    return;
  } catch (e) {
    // Fallback OpenData Paris
    try {
      const url = "https://opendata.paris.fr/api/v2/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json";
      const data = await fetchJSON(url);
      const station = data.find(s => s.stationcode == stationId);
      if (!station) throw new Error("Station Vélib non trouvée (OpenData)");
      const mechanical = station.mechanical || 0;
      const ebike = station.ebike || 0;
      const free = station.numdocksavailable || 0;
      document.getElementById(elementId).innerHTML = `
        <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
        🚲 Mécaniques : ${mechanical}<br>
        ⚡ Électriques : ${ebike}<br>
        🅿️ Places libres : ${free}
      `;
      return;
    } catch (e2) {
      document.getElementById(elementId).innerHTML = `
        <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
        <div class='error'>Erreur chargement Vélib</div>
      `;
    }
  }
}

// ===================
//   HORAIRES TRANSPORTS
// ===================

// CACHE D'ARRETS POUR CHAQUE TRAIN/JOURNEY
async function fetchStopsForJourney(vehicleJourneyId, lineId) {
  if (!vehicleJourneyId || !lineId) return [];
  const cacheKey = `stops-${vehicleJourneyId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const today = new Date().toISOString().split("T")[0].replace(/-/g,"") + "T000000";
    const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/journeys?from_datetime=${today}&max_nb_journeys=1&line=${encodeURIComponent(lineId)}&vehicle_journey_id=${encodeURIComponent(vehicleJourneyId)}`;
    const data = await fetchJSON(url);
    const stops = data.journeys?.[0]?.sections?.[0]?.stop_date_times?.map(s => s.stop_point?.name).filter(Boolean) || [];
    if (stops.length) localStorage.setItem(cacheKey, JSON.stringify(stops));
    return stops;
  } catch (e) {
    localStorage.setItem(cacheKey, "[]");
    return [];
  }
}

// RENDU DES PASSAGES (par direction)
async function renderDepartures(id, title, data, icon, first, last) {
  const el = document.getElementById(id);
  let html = `<div class='title-line'><img src='${icon}' class='icon-inline'>${title}</div>`;
  if (!data || data.length === 0) {
    html += `<ul><li>Aucun passage à venir</li></ul>`;
  } else {
    // Regroupe par direction
    const grouped = {};
    for (let d of data) {
      const dir = getDestinationName(d.MonitoredVehicleJourney.DirectionName);
      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push(d);
    }
    for (const dir in grouped) {
      html += `<h4 class='direction-title'>Direction ${dir}</h4><ul>`;
      for (let d of grouped[dir].slice(0, 4)) {
        const call = d.MonitoredVehicleJourney.MonitoredCall;
        const expected = call.ExpectedDepartureTime || call.AimedDepartureTime;
        const aimed = call.AimedDepartureTime;
        const isLast = d.MonitoredVehicleJourney.FirstOrLastJourney?.value === "LAST_SERVICE_OF_DAY";
        const delay = expected && aimed && expected !== aimed ?
          `<span class='delay'>(+${Math.round((new Date(expected) - new Date(aimed)) / 60000)} min)</span>` : "";

        // 1. Récupération de la liste d'arrêts pour ce train/bus (en cache ou API)
        const journeyId = d.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;
        const lineRef = d.MonitoredVehicleJourney.LineRef?.value?.split("::")[2]?.replace(":", "");
        const lineId = lineRef ? "line:IDFM:" + lineRef : "";
        let stopsText = "";
        if (journeyId && lineId) {
          let stops = await fetchStopsForJourney(journeyId, lineId);
          stopsText = stops.length ? stops.join(" – ") : "(arrêts non dispo)";
        }

        html += `<li>
          ▶ ${formatTime(expected)}${minutesUntil(expected)} ${delay} ${isLast ? "<span class='last-train'>(dernier passage)</span>" : ""}
          <div class='defile-arrets'>${stopsText}</div>
        </li>`;
      }
      html += `</ul>`;
    }
  }
  html += `<div class='schedule-extremes'>Premier départ : ${first || "-"}<br>Dernier départ : ${last || "-"}</div>`;
  el.innerHTML = html;
}

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
    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div>
      <div class='error'>Erreur horaires : données non disponibles</div>`;
  }
}

// --- PREMIER ET DERNIER DEPART DU JOUR ---
async function fetchSchedulesOncePerDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("schedule-day") === today) return;

  for (let key in STOP_POINTS) {
    try {
      const url = STOP_POINTS[key].scheduleUrl + today.replace(/-/g, "") + "T000000";
      const data = await fetchJSON(url);
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
      // Silencieux, gardera les anciens en cache ou "-"
    }
  }
  localStorage.setItem("schedule-day", today);
}

// ===================
//   RAFFRAICHISSEMENT GLOBAL
// ===================

function refreshAll() {
  updateDateTime();
  fetchSchedulesOncePerDay();
  fetchWeather(); // météo dynamique
  renderSytadin(); // info trafic Sytadin
  fetchTransport("rer", "rer-content");
  fetchTransport("bus77", "bus77-content");
  fetchTransport("bus201", "bus201-content");
  fetchVelib(VELIB_IDS.vincennes, "velib-vincennes");
  fetchVelib(VELIB_IDS.breuil, "velib-breuil");
}

setInterval(refreshAll, 60000);
refreshAll();
