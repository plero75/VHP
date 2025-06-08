
function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR");
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
  document.getElementById("current-date").textContent = dateStr;
  document.getElementById("current-time").textContent = timeStr;
}

async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true");
    const data = await res.json();
    const w = data.current_weather;
    document.getElementById("current-weather").textContent = `${w.temperature}°C · Vent ${w.windspeed} km/h`;
  } catch {
    document.getElementById("current-weather").textContent = "Météo indisponible";
  }
}

async function fetchStopMonitoring(ref, containerId) {
  try {
    const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${ref}`;
    const res = await fetch(url);
    const data = await res.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ?? [];

    const now = new Date();
    let lastTime = null;
    const grouped = {};

    visits.forEach(v => {
      const journey = v.MonitoredVehicleJourney;
      const call = journey.MonitoredCall;
      const dir = journey.DirectionName?.[0]?.value ?? "Direction inconnue";
      const expected = new Date(call.ExpectedDepartureTime);
      const untilMin = Math.round((expected - now) / 60000);
      const labelTime = untilMin <= 1 ? "IMMINENT" : `${expected.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${untilMin} min`;

      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push(labelTime);

      if (!lastTime || expected > lastTime) {
        lastTime = expected;
      }
    });

    let html = "";
    if (lastTime && now > lastTime) {
      html = `<div class="status warning">🛑 Service terminé</div><div class="small">Prochains passages disponibles demain.</div>`;
    } else {
      for (const dir in grouped) {
        html += `<div><strong>→ ${dir}</strong></div>`;
        html += `<div class="departures">${grouped[dir].map(t => t === "IMMINENT" ? '<div class="badge-time" style="background:#ff4081">IMMINENT</div>' : `<div class="badge-time">${t}</div>`).join("")}</div>`;
      }
      html += `<div class="status fluid">🟢 À l'heure</div>`;
      if (lastTime) {
        html += `<div class="small">Dernier départ affiché : ${lastTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>`;
      }
    }

    document.getElementById(containerId).innerHTML = html;
  } catch {
    document.getElementById(containerId).innerHTML = "<p>Erreur chargement</p>";
  }
}

async function fetchVelib(stationId, containerId, label) {
  try {
    const res = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json");
    const data = await res.json();
    const station = data.data.stations.find(s => s.station_id === stationId);
    const dispo = station.num_bikes_available;
    const elec = station.num_ebikes_available;
    const docks = station.num_docks_available;
    document.getElementById(containerId).textContent = `${label} : ${dispo} vélos (${elec} électriques) — bornes : ${docks}`;
  } catch {
    document.getElementById(containerId).textContent = `Données indisponibles pour ${label}`;
  }
}

function refreshAll() {
  updateDateTime();
  fetchWeather();
  fetchStopMonitoring("STIF:StopArea:SP:43135:", "rer-content");
  fetchStopMonitoring("STIF:StopArea:SP:463641:", "bus77-content");
  fetchStopMonitoring("STIF:StopArea:SP:463644:", "bus201-content");
  fetchVelib("12163", "velib12163", "Hippodrome");
  fetchVelib("12128", "velib12128", "Pyramide");
}

refreshAll();
setInterval(refreshAll, 60000);
