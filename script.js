// script.js - version finale pour dashboard VHP

const STOPS = {
  rer: {
    monitoringRef: "STIF:StopArea:SP:43135:",
    scheduleRef: "stop_area:IDFM:70640",
    lineRef: "line:IDFM:C01742",
    label: "RER A",
    containerId: "rer-content",
  },
  bus77: {
    monitoringRef: "STIF:StopArea:SP:463641:",
    scheduleRef: "stop_area:IDFM:463641",
    lineRef: "line:IDFM:C01756",
    label: "BUS 77",
    containerId: "bus77-content",
  },
  bus201: {
    monitoringRef: "STIF:StopArea:SP:463644:",
    scheduleRef: "stop_area:IDFM:463644",
    lineRef: "line:IDFM:C01810",
    label: "BUS 201",
    containerId: "bus201-content",
  },
};

const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";

function getFormattedTime(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

async function fetchMonitoringData(stop) {
  const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${encodeURIComponent(stop.monitoringRef)}`;
  const res = await fetch(url);
  const json = await res.json();
  return json?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
}

async function fetchScheduleData(stop) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "") + "T000000";
  const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/${stop.scheduleRef}/route_schedules?line=${stop.lineRef}&from_datetime=${dateStr}`;
  const res = await fetch(url);
  const json = await res.json();
  const schedules = json?.route_schedules?.[0]?.table?.rows || [];
  const departures = schedules.map(row => row.stop_date_times?.[0]?.departure_date_time).filter(Boolean);
  return departures;
}

async function updateBlock(stopKey) {
  const stop = STOPS[stopKey];
  const container = document.getElementById(stop.containerId);
  if (!container) return;

  const visits = await fetchMonitoringData(stop);
  const nextDepartures = visits.slice(0, 4).map(v => {
    const t = getFormattedTime(v.MonitoredVehicleJourney?.MonitoredCall?.AimedDepartureTime);
    const dest = v.MonitoredVehicleJourney?.DestinationName || "";
    return `▶ ${t} → ${dest}`;
  });

  const scheduled = await fetchScheduleData(stop);
  const firstTime = getFormattedTime(scheduled[0]);
  const lastTime = getFormattedTime(scheduled[scheduled.length - 1]);

  container.innerHTML = `
    <h2>${stop.label}</h2>
    <ul class="horaire-list">
      ${nextDepartures.map(d => `<li>${d}</li>`).join("")}
    </ul>
    <div class="horaire-extremes">
      <span>Premier départ : <strong>${firstTime}</strong></span><br>
      <span>Dernier départ : <strong>${lastTime}</strong></span>
    </div>
  `;
}

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString();
  document.getElementById("current-time").textContent = now.toLocaleTimeString();
  document.getElementById("last-update").textContent = now.toLocaleString();
}

async function refreshAll() {
  updateDateTime();
  for (const key of Object.keys(STOPS)) {
    await updateBlock(key);
  }
}

setInterval(refreshAll, 60000);
refreshAll();
