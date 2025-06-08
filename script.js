
async function fetchStopMonitoring(ref, containerId, label) {
  try {
    const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${ref}`;
    const response = await fetch(url);
    const data = await response.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ?? [];

    const now = new Date();
    let lastTime = "";
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

      lastTime = expected.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    });

    let html = "";
    for (const direction in grouped) {
      html += `<div><strong>→ ${direction}</strong></div>`;
      html += `<div class="departures">${grouped[direction].map(t => `<div class="badge-time">${t}</div>`).join("")}</div>`;
    }

    html += `<div class="status fluid">🟢 À l'heure</div>`;
    html += `<div class="small">Dernier départ affiché : ${lastTime}</div>`;

    document.getElementById(containerId).innerHTML += html;
  } catch (e) {
    document.getElementById(containerId).innerHTML += `<p>Erreur chargement ${label}</p>`;
  }
}

async function fetchVelib(stationId, containerId, label) {
  try {
    const response = await fetch("https://velib-proxy.hippodrome-proxy42.workers.dev/station_status.json");
    const data = await response.json();
    const station = data.data.stations.find(s => s.station_id === stationId);
    if (!station) throw new Error("Station introuvable");
    const dispo = station.num_bikes_available;
    const elec = station.num_ebikes_available;
    const docks = station.num_docks_available;
    document.getElementById(containerId).innerText = `${label} : ${dispo} vélos (${elec} électriques) — bornes : ${docks}`;
  } catch (e) {
    document.getElementById(containerId).innerText = `Données indisponibles pour ${label}`;
  }
}

async function fetchWeather() {
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true");
    const data = await response.json();
    const weather = data.current_weather;
    document.getElementById("weather-content").innerText = `Paris : ${weather.temperature}°C — Vent ${weather.windspeed} km/h`;
  } catch (e) {
    document.getElementById("weather-content").innerText = "Erreur météo";
  }
}

function updateTime() {
  const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("last-update").innerText = `Dernière mise à jour : ${now}`;
}

function refreshAll() {
  fetchStopMonitoring("STIF:StopArea:SP:43135:", "rer-content", "RER A — Joinville-le-Pont");
  fetchStopMonitoring("STIF:StopArea:SP:463641:", "bus77-content", "Bus 77 — Hippodrome de Vincennes");
  fetchStopMonitoring("STIF:StopArea:SP:463644:", "bus201-content", "Bus 201 — École du Breuil");
  fetchVelib("12163", "velib12163", "Hippodrome");
  fetchVelib("12128", "velib12128", "Pyramide");
  fetchWeather();
  updateTime();
}

refreshAll();
setInterval(refreshAll, 60000);
