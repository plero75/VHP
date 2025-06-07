function classifyTime(min) {
  if (min <= 1) return 'urgent';
  if (min <= 10) return 'soon';
  return 'later';
}

function animateUpdate(container) {
  container.style.opacity = 0;
  setTimeout(() => container.style.opacity = 1, 200);
}

async function fetchStopMonitoring(ref, containerId, label) {
  const container = document.getElementById(containerId);
  try {
    const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${ref}`;
    const response = await fetch(url);
    const data = await response.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ?? [];

    const now = new Date();
    const grouped = {};

    visits.forEach(v => {
      const journey = v.MonitoredVehicleJourney;
      const call = journey.MonitoredCall;
      const dir = journey.DirectionName?.[0]?.value ?? "Direction inconnue";
      const expected = new Date(call.ExpectedDepartureTime);
      const untilMin = Math.round((expected - now) / 60000);
      const labelTime = untilMin <= 1 ? "IMMINENT" : `${expected.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${untilMin} min`;

      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push({ label: labelTime, min: untilMin });
    });

    let html = "";
    for (const dir in grouped) {
      html += `<div><strong>→ ${dir}</strong></div>`;
      html += `<div class="departures">${grouped[dir].map(t =>
        `<div class="badge-time ${classifyTime(t.min)}">${t.label}</div>`).join("")}</div>`;
    }

    html += `<div class="status fluid">🟢 À l'heure</div>`;
    html += `<div class="small">Dernière mise à jour : ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>`;
    container.innerHTML = html;
    animateUpdate(container);
  } catch (e) {
    container.innerHTML = `<p>⚠️ Erreur lors du chargement des horaires pour ${label}</p>`;
  }
}

async function fetchWeather() {
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true");
    const data = await response.json();
    const weather = data.current_weather;
    document.getElementById("current-weather").innerText = `Paris : ${weather.temperature}°C — Vent ${weather.windspeed} km/h`;
  } catch (e) {
    document.getElementById("current-weather").innerText = "Erreur météo";
  }
}

function updateTime() {
  const now = new Date();
  document.getElementById("current-time").innerText = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("current-date").innerText = now.toLocaleDateString("fr-FR");
}

function refreshAll() {
  fetchStopMonitoring("STIF:StopArea:SP:43135:", "rer-content", "RER A");
  fetchStopMonitoring("STIF:StopArea:SP:463641:", "bus77-content", "Bus 77");
  fetchStopMonitoring("STIF:StopArea:SP:463644:", "bus201-content", "Bus 201");
  fetchWeather();
  updateTime();
}

refreshAll();
setInterval(refreshAll, 60000);