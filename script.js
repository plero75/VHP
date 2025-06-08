
async function fetchStopMonitoring(ref, containerId, label) {
  try {
    const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${ref}`;
    const response = await fetch(url);
    const data = await response.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ?? [];

    
    let lastTime = "";
    const output = visits.slice(0, 5).map(v => {

      const journey = v.MonitoredVehicleJourney;
      const call = journey.MonitoredCall;
      const dir = journey.DirectionName?.[0]?.value ?? "Direction inconnue";
      const name = journey.VehicleJourneyName?.[0]?.value ?? "";
      const aimed = new Date(call.AimedDepartureTime).toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"});
      const expected = new Date(call.ExpectedDepartureTime).toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"});
      const delay = (call.ExpectedDepartureTime !== call.AimedDepartureTime) ? `🕒 +${(new Date(call.ExpectedDepartureTime) - new Date(call.AimedDepartureTime))/60000} min` : "";
      const quai = call.DeparturePlatformName?.value ? ` — Quai ${call.DeparturePlatformName.value}` : "";
      
      lastTime = expected;
      return `<li><strong>${name}</strong> ${expected}${quai} → ${dir} ${delay}</li>`;

    }).join("");

    document.getElementById(containerId).innerHTML = `<h3>${label}</h3><ul>${output}</ul><div class="update">Dernier départ affiché : ${lastTime}</div>`;
  } catch (e) {
    document.getElementById(containerId).innerHTML = `<p>Erreur chargement ${label}</p>`;
  }
}

async function fetchVelib(stationId, containerId, label) {
  try {
    const response = await fetch("https://velib-proxy.hippodrome-proxy42.workers.dev/station_status.json");
    const data = await response.json();
    const station = data.data.stations.find(s => s.station_id === stationId);
    const dispo = station.num_bikes_available;
    const elec = station.num_ebikes_available;
    const docks = station.num_docks_available;
    document.getElementById(containerId).innerText = `${label} : ${dispo} vélos dont ${elec} électriques — bornes : ${docks}`;
  } catch (e) {
    document.getElementById(containerId).innerText = `Erreur Vélib : ${label}`;
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
  const now = new Date().toLocaleTimeString("fr-FR");
  document.getElementById("last-update").innerText = `Dernière mise à jour : ${now}`;
}

function refreshAll() {
  fetchStopMonitoring("STIF:StopArea:SP:43135:", "rer-content", "RER A — Joinville-le-Pont");
  fetchStopMonitoring("STIF:StopArea:SP:463641:", "bus77-content", "Bus 77 — Hippodrome de Vincennes");
  fetchStopMonitoring("STIF:StopArea:SP:463644:", "bus201-content", "Bus 201 — École du Breuil / Pyramides");
  fetchVelib("12163", "velib12163", "Hippodrome Paris-Vincennes");
  fetchVelib("12128", "velib12128", "Pyramide – École du Breuil");
  fetchWeather();
  updateTime();
}

refreshAll();
setInterval(refreshAll, 60000);
