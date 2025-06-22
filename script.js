const STOP_POINTS = {
  rer: {
    name: "RER A",
    icon: "img/picto-rer-a.svg",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:43135:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:monomodalStopPlace:43135/route_schedules?line=line:IDFM:C01742&from_datetime=",
    trafficUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:C01742"
  },
  bus77: {
    name: "BUS 77",
    icon: "img/picto-bus.svg",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463641:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463641/route_schedules?line=line:IDFM:C02251&from_datetime=",
    trafficUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:C02251"
  },
  bus201: {
    name: "BUS 201",
    icon: "img/picto-bus.svg",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463644:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463644/route_schedules?line=line:IDFM:C01219&from_datetime=",
    trafficUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:C01219"
  }
};

const VELIB_IDS = {
  vincennes: "1074333296",
  breuil: "508042092"
};

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR");
  document.getElementById("last-update").textContent = now.toLocaleString("fr-FR");
}

function formatTime(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d)) return "–";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function getDestination(dest) {
  if (!dest) return "–";
  if (typeof dest === "string") return dest;
  if (Array.isArray(dest)) {
    const first = dest[0];
    return typeof first === "string"
      ? first
      : typeof first === "object"
      ? Object.values(first)[0]
      : "–";
  }
  return Object.values(dest)[0] || "–";
}

function renderDepartures(containerId, name, visits, icon, first, last, trafficMessage, isRer) {
  const el = document.getElementById(containerId);
  let html = `<div class="title-line"><img src="${icon}" class="icon-inline">${name}</div><ul>`;
  visits.slice(0, 4).forEach(d => {
    const call = d.MonitoredVehicleJourney.MonitoredCall;
    const time = formatTime(call.AimedDepartureTime || call.ExpectedDepartureTime);
    const dest = getDestination(d.MonitoredVehicleJourney.DestinationName);
    html += `<li>▶ ${time} → ${dest}</li>`;
  });
  html += `</ul><div class="schedule-extremes">Premier départ : ${first || "-"}<br>Dernier départ : ${last || "-"}</div>`;
  html += `<div class="traffic-info">${trafficMessage || "Infos trafic indisponibles"}</div>`;
  el.innerHTML = html;

  if (isRer) {
    const alertEl = document.getElementById("traffic-alert");
    if (trafficMessage) {
      alertEl.innerHTML = trafficMessage;
      alertEl.classList.remove("hidden");
    } else {
      alertEl.classList.add("hidden");
    }
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  return res.json();
}

async function fetchTransportBlock(key, containerId) {
  try {
    const [realtime, traffic] = await Promise.all([
      fetchJSON(STOP_POINTS[key].realtimeUrl),
      fetchJSON(STOP_POINTS[key].trafficUrl)
    ]);

    const visits = realtime.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit || [];
    const disruptions = traffic.disruptions || [];
    const message = disruptions.length
      ? disruptions.map(d => d.messages[0]?.text).join("<br>")
      : "";

    renderDepartures(
      containerId,
      STOP_POINTS[key].name,
      visits,
      STOP_POINTS[key].icon,
      localStorage.getItem(`${key}-first`) || "-",
      localStorage.getItem(`${key}-last`) || "-",
      message,
      key === "rer"
    );
  } catch (err) {
    console.error("Erreur sur " + key, err);
    document.getElementById(containerId).innerHTML = `
      <div class="title-line"><img src="${STOP_POINTS[key].icon}" class="icon-inline">${STOP_POINTS[key].name}</div>
      <div class="error">Données indisponibles</div>`;
  }
}

async function fetchVelib(stationId, containerId) {
  try {
    const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
    const url = proxy + "https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";
    const data = await fetchJSON(url);
    const station = data.data.stations.find(s => s.station_id == stationId);
    if (!station) throw new Error("Station non trouvée");

    const mech = station.num_bikes_available_types.find(b => b.ebike === 0)?.bikes || 0;
    const elec = station.num_bikes_available_types.find(b => b.ebike === 1)?.bikes || 0;
    const free = station.num_docks_available;

    document.getElementById(containerId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      🚲 Mécaniques : ${mech}<br>
      ⚡ Électriques : ${elec}<br>
      🅿️ Places libres : ${free}`;
  } catch (e) {
    console.error("Erreur Vélib", e);
    document.getElementById(containerId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      <div class='error'>Erreur chargement</div>`;
  }
}

async function fetchScheduleOncePerDay() {
  const today = new Date().toISOString().split("T")[0];
  if (localStorage.getItem("schedule-day") === today) return;
  for (const key in STOP_POINTS) {
    try {
      const dateParam = today.replace(/-/g, "") + "T000000";
      const data = await fetchJSON(STOP_POINTS[key].scheduleUrl + dateParam);
      const times = (data.route_schedules?.[0]?.table?.rows || [])
        .flatMap(r => r.date_times?.map(d => d.departure_date_time.slice(9, 13)) || []);
      if (times.length) {
        const sorted = times.sort();
        const fmt = t => `${t.slice(0, 2)}:${t.slice(2)}`;
        localStorage.setItem(`${key}-first`, fmt(sorted[0]));
        localStorage.setItem(`${key}-last`, fmt(sorted[sorted.length - 1]));
      }
    } catch (e) {
      console.error("Erreur schedule " + key, e);
    }
  }
  localStorage.setItem("schedule-day", today);
}

function refreshAll() {
  updateDateTime();
  fetchScheduleOncePerDay();
  fetchTransportBlock("rer", "rer-content");
  fetchTransportBlock("bus77", "bus77-content");
  fetchTransportBlock("bus201", "bus201-content");
  fetchVelib(VELIB_IDS.vincennes, "velib-vincennes");
  fetchVelib(VELIB_IDS.breuil, "velib-breuil");
}

setInterval(refreshAll, 60000);
refreshAll();
```
