// script.js complet et fonctionnel pour VHP

const stopsConfig = [
  {
    name: "RER A",
    containerId: "rer-content",
    stopAreaId: "stop_area:IDFM:70640",
    lineId: "line:IDFM:C01742",
    monitoringRef: "STIF:StopArea:SP:43135:"
  },
  {
    name: "BUS 77",
    containerId: "bus77-content",
    stopAreaId: "stop_area:IDFM:463641",
    lineId: "line:IDFM:C01756",
    monitoringRef: "STIF:StopArea:SP:463641:"
  },
  {
    name: "BUS 201",
    containerId: "bus201-content",
    stopAreaId: "stop_area:IDFM:463644",
    lineId: "line:IDFM:C01810",
    monitoringRef: "STIF:StopArea:SP:463644:"
  }
];

const proxyURL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
const primBase = "https://prim.iledefrance-mobilites.fr/marketplace";

function formatDateTime(isoString) {
  const date = new Date(isoString);
  if (isNaN(date)) return "Invalid Date";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function displayData(containerId, label, times, first, last) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <h2>${label}</h2>
    <ul>
      ${times.map(t => `<li>▶ ${formatDateTime(t.departure)} → ${t.direction}</li>`).join("")}
    </ul>
    <p>Premier départ : ${formatDateTime(first)}</p>
    <p>Dernier départ : ${formatDateTime(last)}</p>
  `;
}

async function fetchRealtimeDepartures(ref) {
  const url = `${proxyURL}${primBase}/stop-monitoring?MonitoringRef=${ref}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit?.slice(0, 4).map(item => ({
      departure: item.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime,
      direction: item.MonitoredVehicleJourney.DirectionName || "?"
    })) || [];
  } catch {
    return [];
  }
}

async function fetchScheduledTimes(stopAreaId, lineId) {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const url = `${proxyURL}${primBase}/v2/navitia/stop_areas/${stopAreaId}/route_schedules?line=${lineId}&from_datetime=${today}T000000`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const times = data?.route_schedules?.[0]?.table?.rows?.[0]?.stop_date_times?.map(e => e.departure_date_time);
    const parsed = times.map(dt => dt ? dt.slice(0, 4) + '-' + dt.slice(4, 6) + '-' + dt.slice(6, 8) + 'T' + dt.slice(9, 11) + ':' + dt.slice(11, 13) + ':' + dt.slice(13, 15) : null);
    return {
      first: parsed[0] || null,
      last: parsed[parsed.length - 1] || null
    };
  } catch {
    return { first: null, last: null };
  }
}

async function refreshAll() {
  const now = new Date();
  document.getElementById("last-update").textContent = now.toLocaleString("fr-FR");

  for (const stop of stopsConfig) {
    const [realTime, schedule] = await Promise.all([
      fetchRealtimeDepartures(stop.monitoringRef),
      fetchScheduledTimes(stop.stopAreaId, stop.lineId)
    ]);

    displayData(stop.containerId, stop.name, realTime, schedule.first, schedule.last);
  }
}

refreshAll();
setInterval(refreshAll, 60000);
