// script.js corrigé avec les bons stop_points et les bons line_id

const STOP_POINTS = {
  rer: {
    name: "RER A",
    url: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:43135:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:monomodalStopPlace:43135/route_schedules?line=line:IDFM:C01742&from_datetime=",
    icon: "img/picto-rer-a.svg"
  },
  bus77: {
    name: "BUS 77",
    url: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463641:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463640/route_schedules?line=line:IDFM:C02251&from_datetime=",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "BUS 201",
    url: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463644:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463646/route_schedules?line=line:IDFM:C02119&from_datetime=",
    icon: "img/picto-bus.svg"
  }
};

const VELIB_IDS = {
  vincennes: "1074333296",
  breuil: "508042092"
};

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR");
  document.getElementById("last-update").textContent = now.toLocaleString("fr-FR");
}

function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Invalid Date";
  }
}

function getDestinationName(name) {
  if (typeof name === "string") return name;
  if (typeof name === "object") return Object.values(name)[0];
  return "Destination inconnue";
}

function renderDepartures(elementId, title, data, iconPath, first, last) {
  const container = document.getElementById(elementId);
  let html = `<div class='title-line'><img src='${iconPath}' class='icon-inline'>${title}</div><ul>`;
  for (let d of data.slice(0, 4)) {
    const time = formatTime(d.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime);
    const destination = getDestinationName(d.MonitoredVehicleJourney.DestinationName);
    html += `<li>▶ ${time} → ${destination}</li>`;
  }
  html += `</ul><div class='schedule-extremes'>Premier départ : ${first || "-"} <br>Dernier départ : ${last || "-"}</div>`;
  container.innerHTML = html;
}

async function fetchTransport(stopKey, elementId) {
  try {
    const response = await fetchJSON(STOP_POINTS[stopKey].url);
    const visits = response.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;
    renderDepartures(
      elementId,
      STOP_POINTS[stopKey].name,
      visits,
      STOP_POINTS[stopKey].icon,
      localStorage.getItem(`${stopKey}-first`) || "?",
      localStorage.getItem(`${stopKey}-last`) || "?"
    );
  } catch (e) {
    console.error("Erreur fetchTransport:", stopKey, e);
    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div><div class='error'>Données indisponibles</div>`;
  }
}

async function fetchSchedulesOncePerDay() {
  const today = new Date().toISOString().split("T")[0];
  const savedDay = localStorage.getItem("schedule-day");
  if (savedDay === today) return;

  for (const key in STOP_POINTS) {
    try {
      const now = new Date();
      const url = STOP_POINTS[key].scheduleUrl + `${now.toISOString().split("T")[0].replace(/-/g, "")}T000000`;
      const data = await fetchJSON(url);
      const schedules = (data.route_schedules?.[0]?.table?.rows || [])
        .flatMap(r => r.date_times?.map(dt => dt.departure_date_time) || []);
      if (schedules?.length > 0) {
        const times = schedules.map(t => t.slice(9,13)).sort();
        const format = t => `${t.slice(0,2)}:${t.slice(2,4)}`;
        localStorage.setItem(`${key}-first`, format(times[0]));
        localStorage.setItem(`${key}-last`, format(times[times.length - 1]));
      }
    } catch (e) {
      console.error("Erreur fetchSchedulesOncePerDay", key, e);
    }
  }
  localStorage.setItem("schedule-day", today);
}

async function fetchVelib(stationId, elementId) {
  try {
    const proxyUrl = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json`;
    const statusData = await fetchJSON(proxyUrl);
    const station = statusData.data.stations.find(s => s.station_id == stationId);
    if (!station) throw new Error("Station non trouvée");
    const mec = station.num_bikes_available_types.find(b => b.ebike === 0)?.bikes || 0;
    const elec = station.num_bikes_available_types.find(b => b.ebike === 1)?.bikes || 0;
    const free = station.num_docks_available;

    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
       🚲 Mécaniques : ${mec}<br>⚡ Électriques : ${elec}<br>🅿️ Places libres : ${free}`;
  } catch (e) {
    console.error("Erreur Vélib:", elementId, e);
    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div><div class='error'>Erreur chargement</div>`;
  }
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

setInterval(refreshAll, 60000);
refreshAll();
