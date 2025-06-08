function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
}

async function updateWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true");
    const data = await res.json();
    const w = data.current_weather;
    document.getElementById("weather-content").textContent =   `🌤 ${w.temperature}°C · Vent ${w.windspeed} km/h`;
  } catch {
    document.getElementById("weather-conten").textContent = "🌤 Météo indisponible";
  }
}

function clearAllBlocks() {
  ["bus77-content", "bus201-content", "rer-content", "velib12128", "velib12163"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

async function fetchStopMonitoring(ref, containerId) {
  try {
    const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${ref}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2)); // <-- Ajoute cette ligne

    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ?? [];

    const now = new Date();
    const grouped = {};
    let lastScheduled = null;
    let firstScheduled = null;

    visits.forEach(v => {
      const journey = v.MonitoredVehicleJourney;
      const call = journey.MonitoredCall;
      const dir = journey.DirectionName?.[0]?.value ?? "Direction inconnue";
      const expected = new Date(call.ExpectedDepartureTime);
      if (!lastScheduled || expected > lastScheduled) lastScheduled = expected;
      if (!firstScheduled || expected < firstScheduled) firstScheduled = expected;

      const untilMin = Math.round((expected - now) / 60000);
      const labelTime = untilMin <= 1 ? "IMMINENT" : `${expected.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${untilMin} min`;

      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push(labelTime);
    });

    const container = document.getElementById(containerId);
    container.innerHTML = "";

    if (firstScheduled && now < firstScheduled) {
      const minsToStart = Math.round((firstScheduled - now) / 60000);
      container.innerHTML = `
        <div class="status warning">🕓 Service non commencé</div>
        <div class="small">Premier passage dans ${minsToStart} min</div>`;
      return;
    }

    if (lastScheduled && now > lastScheduled) {
      const minsToNext = visits.length > 0 ? Math.round((new Date(visits[0].MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) - now) / 60000) : "--";
      container.innerHTML = `
        <div class="status warning">🛑 Service terminé</div>
        <div class="small">Prochain passage estimé dans ${minsToNext} min</div>`;
      return;
    }

    for (const dir in grouped) {
      container.innerHTML += `<div><strong>→ ${dir}</strong></div>`;
      container.innerHTML += `<div class="departures">${grouped[dir].map(t =>
        t === "IMMINENT"
          ? '<div class="badge-time" style="background:#ff4081">IMMINENT</div>'
          : `<div class="badge-time">${t}</div>`
      ).join("")}</div>`;
    }

    container.innerHTML += `<div class="status fluid">🟢 À l'heure</div>`;
    if (lastScheduled) {
      container.innerHTML += `<div class="small">Dernier départ prévu à ${lastScheduled.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>`;
    }

  } catch {
    document.getElementById(containerId).innerHTML = "<p>Erreur de chargement</p>";
  }
}

async function updateVelib() {
  try {
    const res = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json");
    const data = await res.json();
    const station1 = data.data.stations.find(s => s.station_id === "12163");
    const station2 = data.data.stations.find(s => s.station_id === "12128");
    document.getElementById("velib12163").textContent =
      `Hippodrome : ${station1.num_bikes_available} vélos (${station1.num_ebikes_available} électriques) — bornes : ${station1.num_docks_available}`;
    document.getElementById("velib12128").textContent =
      `Pyramide : ${station2.num_bikes_available} vélos (${station2.num_ebikes_available} électriques) — bornes : ${station2.num_docks_available}`;
  } catch {
    document.getElementById("velib12163").textContent = "Erreur Vélib Hippodrome";
    document.getElementById("velib12128").textContent = "Erreur Vélib Pyramide";
  }
}

function refreshAll() {
  clearAllBlocks();
  updateDateTime();
  updateWeather();
  fetchStopMonitoring("STIF:StopArea:SP:43135:", "rer-content");
  fetchStopMonitoring("STIF:StopArea:SP:463641:", "bus77-content");
  fetchStopMonitoring("STIF:StopArea:SP:463644:", "bus201-content");
  updateVelib();
}

refreshAll();
setInterval(refreshAll, 60000);
