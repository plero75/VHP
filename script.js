// Script sans API trafic, corrigé pour éviter les erreurs si les données ne sont pas disponibles

const STOP_POINTS = {
  rer: {
    name: "RER A",
    url: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:43135:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:monomodalStopPlace:43135/route_schedules?line=line:IDFM:C01742&from_datetime=",
    icon: "img/picto-rer-a.svg"
  },
  bus77: {
    name: "Bus 77",
    url: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463641:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463640/route_schedules?line=line:IDFM:C02251&from_datetime=",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "Bus 201",
    url: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463644:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463646/route_schedules?line=line:IDFM:C02119&from_datetime=",
    icon: "img/picto-bus.svg"
  }
};

const VELIB_IDS = {
  vincennes: "1074333296",
  breuil: "508042092"
};

function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Heure invalide";
  }
}

function getDestinationName(name) {
  if (typeof name === "string") return name;
  if (typeof name === "object" && name !== null) {
    for (let key in name) {
      if (name[key]) return name[key];
    }
  }
  return "Destination inconnue";
}

function isServiceTerminated(firstTime, lastTime, now) {
  const toDate = (t) => {
    const [h, m] = t.split(":");
    const date = new Date();
    date.setHours(parseInt(h), parseInt(m), 0, 0);
    return date;
  };
  if (!firstTime || !lastTime) return false;
  const first = toDate(firstTime);
  const last = toDate(lastTime);
  return now < first || now > last;
}

function renderDepartures(elementId, title, data, iconPath, first, last) {
  const container = document.getElementById(elementId);
  const now = new Date();
  let html = `<div class='title-line'><img src='${iconPath}' class='icon-inline'>${title}</div>`;

  if (isServiceTerminated(first, last, now)) {
    html += `<div class='error'>Service terminé pour aujourd’hui. Rendez-vous demain à ${first}</div>`;
  } else {
    html += "<ul>";
    if (first) html += `<li><strong>🕐 Premier départ : ${first}</strong></li>`;
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length && i < 4; i++) {
        const d = data[i];
        const time = formatTime(d.MonitoredVehicleJourney?.MonitoredCall?.AimedDepartureTime);
        const destination = getDestinationName(d.MonitoredVehicleJourney?.DestinationName);
        const isLast = time === last;
        html += `<li>${isLast ? "🛑" : "▶"} ${time} → ${destination}${isLast ? " (dernier départ)" : ""}</li>`;
      }
    } else {
      html += "<li>Aucune donnée disponible</li>";
    }
    if (last) html += `<li><strong>🕓 Dernier départ : ${last}</strong></li>`;
    html += "</ul>";
  }

  container.innerHTML = html;
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

async function fetchTransport(stopKey, elementId) {
  try {
    const data = await fetchJSON(STOP_POINTS[stopKey].url);
    const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery?.[0]?.MonitoredStopVisit;
    renderDepartures(
      elementId,
      STOP_POINTS[stopKey].name,
      visits,
      STOP_POINTS[stopKey].icon,
      localStorage.getItem(`${stopKey}-first`) || "?",
      localStorage.getItem(`${stopKey}-last`) || "?"
    );
  } catch (e) {
    console.error(`Erreur fetchTransport (${stopKey}):`, e);
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
      const datetime = now.toISOString().split("T")[0].replace(/-/g, "") + "T000000";
      const url = STOP_POINTS[key].scheduleUrl + datetime;
      const data = await fetchJSON(url);
      const rows = data?.route_schedules?.[0]?.table?.rows || [];
      const times = rows.flatMap(r => r.date_times?.map(dt => dt.departure_date_time?.slice(9, 13)).filter(Boolean) || []);
      if (times.length > 0) {
        const sorted = times.sort();
        const format = t => `${t.slice(0, 2)}:${t.slice(2, 4)}`;
        localStorage.setItem(`${key}-first`, format(sorted[0]));
        localStorage.setItem(`${key}-last`, format(sorted[sorted.length - 1]));
      }
    } catch (e) {
      console.error(`Erreur fetchSchedulesOncePerDay (${key}):`, e);
    }
  }

  localStorage.setItem("schedule-day", today);
}

async function fetchVelib(stationId, elementId) {
  try {
    const proxyUrl = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json`;
    const statusData = await fetchJSON(proxyUrl);
    const station = statusData.data?.stations?.find(s => s.station_id === stationId);
    if (!station) throw new Error("Station Vélib non trouvée");

    const mec = station.num_bikes_available_types?.find(b => b.ebike === 0)?.bikes || 0;
    const elec = station.num_bikes_available_types?.find(b => b.ebike === 1)?.bikes || 0;
    const free = station.num_docks_available || 0;

    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
       🚲 Mécaniques : ${mec}<br>⚡ Électriques : ${elec}<br>🅿️ Places libres : ${free}`;
  } catch (e) {
    console.error("Erreur fetchVelib:", e);
    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div><div class='error'>Erreur chargement</div>`;
  }
}

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR");
  document.getElementById("last-update").textContent = now.toLocaleString("fr-FR");
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



async function fetchTraffic(lineCode, elementId) {
  const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:${lineCode}`;
  try {
    const data = await fetchJSON(url);
    const report = data.line_reports?.[0];
    if (report && report.messages?.length) {
      const severity = report.severity?.name || "Info trafic";
      const message = report.messages[0]?.text || "Alerte trafic en cours";
      const container = document.getElementById(elementId);
      if (container) {
        container.innerHTML += `<div class="info-trafic">⚠️ <strong>${severity}</strong><br>${message}</div>`;
      }
    }
  } catch (e) {
    console.warn("Erreur info trafic :", e);
  }
}

// Appels spécifiques aux lignes
fetchTraffic("C01742", "rer-content");
fetchTraffic("C02251", "bus77-content");
fetchTraffic("C02119", "bus201-content");