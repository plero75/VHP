const STOP_POINTS = {
  rer: {
    name: "RER A Joinville-le-Pont",
    directions: {},
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:43135:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:monomodalStopPlace:43135/route_schedules?line=line:IDFM:C01742&from_datetime=",
    lineId: "line:IDFM:C01742",
    icon: "img/picto-rer-a.svg"
  },
  bus77: {
    name: "BUS 77 Hippodrome de Vincennes",
    directions: {},
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463641:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463640/route_schedules?line=line:IDFM:C02251&from_datetime=",
    lineId: "line:IDFM:C02251",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "BUS 201 Ecole du Breuil",
    directions: {},
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463644:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463646/route_schedules?line=line:IDFM:C01219&from_datetime=",
    lineId: "line:IDFM:C01219",
    icon: "img/picto-bus.svg"
  }
};

const VELIB_IDS = {
  vincennes: "1074333296",
  breuil: "508042092"
};

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR", {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"});
  document.getElementById("last-update").textContent = "Dernière mise à jour : " + now.toLocaleString("fr-FR");
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

// --- Mémorisation des arrêts par "id unique" de train/bus ---
const stopsCache = {};
async function fetchAndCacheStopsForTrain(lineId, journeyId, journeyDate, callback) {
  // Key: line+journeyId+date
  const cacheKey = `${lineId}_${journeyId}_${journeyDate}`;
  if (stopsCache[cacheKey]) {
    callback(stopsCache[cacheKey]);
    return;
  }

  // Récupération depuis Navitia du pattern (à n'appeler qu'une fois par train/bus)
  try {
    // Pour Navitia il faut la date en format YYYYMMDDTHHmmss
    const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/journeys?from_datetime=${journeyDate}T000000&max_nb_journeys=1&line=${lineId}&vehicle_journey_id=${journeyId}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      // Analyse des arrêts
      const stops = [];
      const journeys = data.journeys || [];
      if (journeys.length) {
        const sections = journeys[0].sections || [];
        sections.forEach(sec => {
          if (sec.display_informations && sec.stop_date_times) {
            stops.push(...sec.stop_date_times.map(sd => sd.stop_point.label));
          }
        });
      }
      stopsCache[cacheKey] = stops.length ? stops : null;
      callback(stops.length ? stops : null);
    } else {
      callback(null);
    }
  } catch {
    callback(null);
  }
}

function makeDefileArretsHTML(arr) {
  if (!arr || !arr.length) return "";
  return `<span class="defile-arrets">${arr.join(" – ")}</span>`;
}

function renderDepartures(id, title, data, icon, first, last, infoTrafic) {
  const el = document.getElementById(id);
  let html = `<div class='title-line'><img src='${icon}' class='icon-inline'>${title}</div>`;
  if (!data || data.length === 0) {
    html += `<ul><li>Aucun passage à venir</li></ul>`;
  } else {
    // Groupement par direction
    const grouped = {};
    data.forEach(d => {
      const dir = getDestinationName(d.MonitoredVehicleJourney.DirectionName);
      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push(d);
    });
    for (const dir in grouped) {
      html += `<div class='direction-title'>Direction : ${dir}</div><ul>`;
      grouped[dir].slice(0, 4).forEach((d, idx) => {
        const call = d.MonitoredVehicleJourney.MonitoredCall;
        const expected = call.ExpectedDepartureTime || call.AimedDepartureTime;
        const aimed = call.AimedDepartureTime;
        const journeyId = d.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef || "";
        const lineId = d.MonitoredVehicleJourney.LineRef?.value?.split(":").pop();
        const journeyDate = (expected || aimed || "").slice(0,10).replace(/-/g,"");

        // Délai éventuel
        const delay = expected && aimed && expected !== aimed
          ? `<span class='delay'>(+${Math.round((new Date(expected) - new Date(aimed)) / 60000)} min)</span>`
          : "";

        // Marqueur dernier train
        const isLast = d.MonitoredVehicleJourney.FirstOrLastJourney?.value === "LAST_SERVICE_OF_DAY";

        // Arrêts défiler dynamiques via cache ou async fetch (affiché après)
        let stopsHtml = "";
        const uniqueKey = (journeyId && journeyDate) ? `${journeyId}_${journeyDate}` : null;
        if (uniqueKey && stopsCache[uniqueKey]) {
          stopsHtml = makeDefileArretsHTML(stopsCache[uniqueKey]);
        } else if (uniqueKey && !stopsCache[uniqueKey]) {
          fetchAndCacheStopsForTrain(lineId, journeyId, journeyDate, stops => {
            if (stops) {
              stopsCache[uniqueKey] = stops;
              setTimeout(() => refreshAll(), 300); // Relance le refresh pour affichage
            }
          });
        }

        html += `<li>▶ ${formatTime(expected)}${minutesUntil(expected)} ${delay} ${isLast ? "<span class='last-train'>(dernier train)</span>" : ""}
        ${stopsHtml}
        </li>`;
      });
      html += `</ul>`;
    }
  }
  html += `<div class='schedule-extremes'>Premier départ : ${first || "-"}<br>Dernier départ : ${last || "-"}</div>`;
  if(infoTrafic) html += `<div class='info-trafic-ligne'>${infoTrafic}</div>`;
  el.innerHTML = html;
}

async function fetchTransport(stopKey, elementId) {
  try {
    const data = await fetchJSON(STOP_POINTS[stopKey].realtimeUrl);
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    // Optionnel : info trafic de la ligne (à adapter selon structure)
    let infoTrafic = '';
    try {
      const info = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.StopLineNotice;
      if (info && info.length) infoTrafic = "<b>Trafic :</b> " + info.map(n => n.Message?.[0]?.value).join("<br>");
    } catch{}
    renderDepartures(
      elementId,
      STOP_POINTS[stopKey].name,
      visits,
      STOP_POINTS[stopKey].icon,
      localStorage.getItem(`${stopKey}-first`),
      localStorage.getItem(`${stopKey}-last`),
      infoTrafic
    );
  } catch (e) {
    console.error(`Erreur fetchTransport ${stopKey}:`, e);
    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div><div class='error'>Données indisponibles</div>`;
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  return await res.json();
}

async function fetchSchedulesOncePerDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("schedule-day") === today) return;

  for (let key in STOP_POINTS) {
    try {
      const url = STOP_POINTS[key].scheduleUrl + today.replace(/-/g,"") + "T000000";
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
      console.error(`Erreur fetchSchedulesOncePerDay ${key}:`, e);
    }
  }
  localStorage.setItem("schedule-day", today);
}

// --- Vélib ---
async function fetchVelib(stationId, elementId) {
  try {
    const url = "https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";
    const data = await fetchJSON(url);
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

// --- Météo ---
async function fetchWeather() {
  try {
    // Coordonnées Hippodrome
    const lat = 48.8227, lon = 2.4351;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`;
    const data = await fetchJSON(url);
    const w = data.current_weather;
    document.getElementById("weather-content").innerHTML =
      `🌤 <b>${w.temperature}°C</b> <span style="opacity:.7;">Vent ${w.windspeed} km/h</span>`;
  } catch {
    document.getElementById("weather-content").textContent = "🌤 Météo indisponible";
  }
}

// --- Info Trafic Petit Futé (à adapter selon source réelle) ---
async function fetchInfoFute() {
  // Placeholder, à remplacer par vraie source ou API si tu as
  document.getElementById("infofute-content").innerHTML =
    "ℹ️ Aucun incident notable signalé aux abords de l’hippodrome aujourd’hui.";
}

function refreshAll() {
  updateDateTime();
  fetchSchedulesOncePerDay();
  fetchWeather();
  fetchInfoFute();
  fetchTransport("rer", "rer-content");
  fetchTransport("bus77", "bus77-content");
  fetchTransport("bus201", "bus201-content");
  fetchVelib(VELIB_IDS.vincennes, "velib-vincennes");
  fetchVelib(VELIB_IDS.breuil, "velib-breuil");
}

setInterval(refreshAll, 60000);
refreshAll();
