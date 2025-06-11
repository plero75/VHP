// script.js

const RER_STOP_ID = "STIF:StopArea:SP:43135:";
const BUS77_STOP_ID = "STIF:StopArea:SP:463641:";
const BUS201_STOP_ID = "STIF:StopArea:SP:463644:";

const FIRST_LAST_ENDPOINTS = {
  rer: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/stop_area:IDFM:70640/route_schedules?line=line:IDFM:C01742&from_datetime=",
  bus77: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/stop_area:IDFM:463642/route_schedules?line=line:IDFM:C01756&from_datetime=",
  bus201: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/stop_area:IDFM:463645/route_schedules?line=line:IDFM:C01201&from_datetime="
};

const STOP_MONITORING_ENDPOINT = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=";

const STOP_IDS = {
  rer: RER_STOP_ID,
  bus77: BUS77_STOP_ID,
  bus201: BUS201_STOP_ID
};

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString();
  document.getElementById("current-time").textContent = now.toLocaleTimeString();
  document.getElementById("last-update").textContent = now.toLocaleString();
}

async function fetchRealtimeData(stopId) {
  try {
    const res = await fetch(`${STOP_MONITORING_ENDPOINT}${encodeURIComponent(stopId)}`);
    const data = await res.json();
    return data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;
  } catch (e) {
    console.error("Erreur requête temps réel:", e);
    return [];
  }
}

async function fetchFirstLast(lineType, dateStr) {
  try {
    const res = await fetch(`${FIRST_LAST_ENDPOINTS[lineType]}${dateStr}`);
    const data = await res.json();
    const schedules = data.route_schedules[0].table.rows.map(r => new Date(r.date_time));
    schedules.sort((a, b) => a - b);
    return {
      first: schedules[0]?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "-",
      last: schedules[schedules.length - 1]?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "-"
    };
  } catch (e) {
    console.error(`Erreur sur ${lineType}:`, e);
    return { first: "-", last: "-" };
  }
}

function displayDepartures(containerId, departures, title, firstLast = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `<h3>${title}</h3>` +
    (departures.length > 0 ?
      departures.slice(0, 4).map(d => {
        const aimed = new Date(d.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime);
        const direction = d.MonitoredVehicleJourney.DirectionName || "?";
        return `<p>▶ ${aimed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${direction}</p>`;
      }).join('')
      : '<p>Aucune donnée</p>') +
    `<p><strong>Premier départ :</strong> ${firstLast.first}</p>` +
    `<p><strong>Dernier départ :</strong> ${firstLast.last}</p>`;
}

async function refreshDashboard() {
  updateDateTime();

  const date = new Date();
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, '') + 'T000000';

  const [rerData, bus77Data, bus201Data] = await Promise.all([
    fetchRealtimeData(RER_STOP_ID),
    fetchRealtimeData(BUS77_STOP_ID),
    fetchRealtimeData(BUS201_STOP_ID)
  ]);

  const [rerTimes, bus77Times, bus201Times] = await Promise.all([
    fetchFirstLast("rer", dateStr),
    fetchFirstLast("bus77", dateStr),
    fetchFirstLast("bus201", dateStr)
  ]);

  displayDepartures("rer-content", rerData, "RER A", rerTimes);
  displayDepartures("bus77-content", bus77Data, "BUS 77", bus77Times);
  displayDepartures("bus201-content", bus201Data, "BUS 201", bus201Times);
}

setInterval(refreshDashboard, 60 * 1000);
refreshDashboard();
