// ====================
// Date/Heure dynamique
// ====================
function updateDateTime() {
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  document.getElementById('current-date').textContent = now.toLocaleDateString('fr-FR', options);
  document.getElementById('current-time').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('last-update').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateDateTime, 1000);
updateDateTime();

// ====================
// Alerte trafic dynamique
// ====================
function showTrafficAlert(msg) {
  const alert = document.getElementById('traffic-alert');
  if(alert) {
    alert.textContent = msg;
    alert.classList.remove('hidden');
    document.getElementById('datetime').classList.remove('datetime-big');
    document.getElementById('datetime').classList.add('datetime-small');
  }
}
function hideTrafficAlert() {
  const alert = document.getElementById('traffic-alert');
  if(alert) {
    alert.textContent = '';
    alert.classList.add('hidden');
    document.getElementById('datetime').classList.add('datetime-big');
    document.getElementById('datetime').classList.remove('datetime-small');
  }
}

// ====================
// DATA DYNAMIQUE (AVEC FETCH/API)
// ====================

// -----------
// Vélib (OpenData Paris)
// -----------
async function fetchVelibCard() {
  // Ex: station 21005 "Pyramide - École du Breuil"
  const stationCode = "21005";
  try {
    const res = await fetch("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode='" + stationCode + "'");
    const data = await res.json();
    const sta = data.results && data.results[0];
    if (!sta) throw new Error('Aucune donnée station');
    updateVelibCard({
      station: sta.name,
      code: sta.stationcode,
      mechanical: sta.mechanical,
      ebike: sta.ebike,
      docks: sta.numdocksavailable,
      alert: sta.status !== "OPEN" ? "Station fermée" : ""
    });
  } catch (e) {
    updateVelibCard({
      station: "Erreur Vélib",
      code: stationCode,
      mechanical: "?",
      ebike: "?",
      docks: "?",
      alert: "Erreur données Vélib"
    });
  }
}

// -----------
// RER & BUS (IDFM/prim API via proxy)
// -----------
const PROXY_URL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/";

async function fetchIDFMStop(ref) {
  const apiBase = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring";
  const apiUrl = `${apiBase}?MonitoringRef=${encodeURIComponent(ref)}`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(apiUrl)}`;
  try {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    const visits = (data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit) || [];
    return visits;
  } catch (e) {
    return null;
  }
}

async function fetchRERCard() {
  // Vincennes (STIF:StopArea:SP:43135:)
  const ref = "STIF:StopArea:SP:43135:";
  const visits = await fetchIDFMStop(ref);
  if (!visits) {
    updateRERCard({
      code: ref, direction: "?", next: [], alert: "Données indisponibles"
    });
    return;
  }
  const direction = visits[0]?.MonitoredVehicleJourney?.DirectionName || "Inconnu";
  const next = visits.slice(0, 4).map(v => {
    const time = v.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime || v.MonitoredVehicleJourney.MonitoredCall.AimedArrivalTime;
    const dt = time ? new Date(time) : null;
    const now = new Date();
    const mins = dt ? Math.round((dt - now) / 60000) : "?";
    return {
      time: dt ? dt.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}) : "--:--",
      wait: mins !== "?" ? (mins > 0 ? `${mins} min` : "à l'instant") : "?"
    };
  });
  // Simple check for alert on RER
  const alert = visits.find(v =>
    v.MonitoredVehicleJourney?.MonitoredCall?.ArrivalStatus === "delayed") ? "Perturbation" : "";
  updateRERCard({code: ref, direction, next, alert});
}

async function fetchBusCard(line, ref, cardId) {
  const visits = await fetchIDFMStop(ref);
  if (!visits) {
    updateBusCard({
      line, code: ref, direction: "?", next: [], alert: "Données indisponibles"
    }, cardId);
    return;
  }
  const direction = visits[0]?.MonitoredVehicleJourney?.DirectionName || "Inconnu";
  const next = visits.slice(0, 4).map(v => {
    const time = v.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime || v.MonitoredVehicleJourney.MonitoredCall.AimedArrivalTime;
    const dt = time ? new Date(time) : null;
    const now = new Date();
    const mins = dt ? Math.round((dt - now) / 60000) : "?";
    return {
      time: dt ? dt.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}) : "--:--",
      wait: mins !== "?" ? (mins > 0 ? `${mins} min` : "à l'instant") : "?"
    };
  });
  // Simple check for alert on bus
  const alert = visits.find(v =>
    v.MonitoredVehicleJourney?.MonitoredCall?.ArrivalStatus === "delayed") ? "Perturbation" : "";
  updateBusCard({line, code: ref, direction, next, alert}, cardId);
}

// -----------
// Météo (Open-Meteo)
// -----------
async function fetchMeteoCard() {
  try {
    // Paris - Vincennes
    const lat = 48.841; const lon = 2.441;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url);
    const data = await res.json();
    const cur = data.current_weather;
    let emoji = "☀️", status = "Ensoleillé";
    if (cur.weathercode >= 1 && cur.weathercode <= 3) { emoji = "🌤️"; status = "Partiellement ensoleillé"; }
    if (cur.weathercode >= 45 && cur.weathercode <= 49) { emoji = "🌫️"; status = "Brouillard"; }
    if (cur.weathercode >= 51 && cur.weathercode <= 67) { emoji = "🌦️"; status = "Pluie faible"; }
    if (cur.weathercode >= 80 && cur.weathercode <= 82) { emoji = "🌧️"; status = "Averses"; }
    if (cur.weathercode >= 95) { emoji = "⛈️"; status = "Orages"; }
    updateMeteoCard({
      emoji,
      temp: cur.temperature,
      status,
      wind: cur.windspeed
    });
  } catch (e) {
    updateMeteoCard({
      emoji: "❓",
      temp: "?",
      status: "Indispo",
      wind: "?"
    });
  }
}

async function fetchMeteoHoursCard() {
  try {
    // Paris - Vincennes
    const lat = 48.841; const lon = 2.441;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&forecast_days=1&timezone=Europe%2FParis`;
    const res = await fetch(url);
    const data = await res.json();
    const now = new Date();
    const hours = [];
    for(let i=0; i<6; ++i) {
      const idx = i + now.getHours();
      if (!data.hourly || !data.hourly.time[idx]) continue;
      // ex: 2025-06-08T15:00
      const hourStr = data.hourly.time[idx].split("T")[1].slice(0, 2) + "h";
      const temp = Math.round(data.hourly.temperature_2m[idx]);
      const code = data.hourly.weathercode[idx];
      let picto = "☀️";
      if (code >= 1 && code <= 3) picto = "🌤️";
      if (code >= 45 && code <= 49) picto = "🌫️";
      if (code >= 51 && code <= 67) picto = "🌦️";
      if (code >= 80 && code <= 82) picto = "🌧️";
      if (code >= 95) picto = "⛈️";
      hours.push({time: hourStr, picto, temp});
    }
    updateMeteoHoursCard({hours});
  } catch (e) {
    updateMeteoHoursCard({hours: [
      {time: "?", picto: "❓", temp: "?"}
    ]});
  }
}

// ====================
// UPDATE ALL
// ====================
async function updateAll() {
  fetchVelibCard();
  fetchRERCard();
  fetchBusCard("77", "STIF:StopArea:SP:463641:", "bus77-card");
  fetchBusCard("201", "STIF:StopArea:SP:463644:", "bus201-card");
  fetchMeteoCard();
  fetchMeteoHoursCard();
}
updateAll();
setInterval(updateAll, 60000);

// ====================
// HTML RENDERING (inchangé)
// ====================

function updateVelibCard(data) {
  document.getElementById('velib-card').innerHTML = `
    <h2>
      <span class="velib-picto">🚲</span>Vélib'
    </h2>
    <div>
      <b>${data.station}</b> <span class="ratp-badge">${data.code}</span><br>
      mécaniques : <b>${data.mechanical}</b> &nbsp;&nbsp; électriques : <b>${data.ebike}</b><br>
      bornes libres : <b>${data.docks}</b>
      <div style="margin-top:0.6em;">
        ${data.alert ? `<span class="status warning">${data.alert}</span>` : ""}
      </div>
    </div>
  `;
}
function updateRERCard(data) {
  document.getElementById('rer-card').innerHTML = `
    <h2>
      <img src="img/picto-rer-a.svg" alt="RER A" style="height:1.2em;vertical-align:middle;">
      RER A
      <span class="ratp-badge">${data.code}</span>
    </h2>
    <div>
      <div><span class="rer-line-idfm">A</span> ${data.direction}</div>
      <ul style="margin:0;padding:0 0 0 1em;">
        ${data.next.map(t => `<li>${t.time} <span class="temps">${t.wait}</span></li>`).join('')}
      </ul>
      <div style="margin-top:0.6em;">
        ${data.alert ? `<span class="status warning">${data.alert}</span>` : ""}
      </div>
    </div>
  `;
}
function updateBusCard(data, id) {
  document.getElementById(id).innerHTML = `
    <h2>
      <img src="img/picto-bus.svg" alt="Bus" style="height:1.2em;vertical-align:middle;">
      Bus ${data.line}
      <span class="ratp-badge">${data.code}</span>
    </h2>
    <div>
      <div><span class="bus-line-idfm">${data.line}</span> ${data.direction}</div>
      <ul style="margin:0;padding:0 0 0 1em;">
        ${data.next.map(t => `<li>${t.time} <span class="temps">${t.wait}</span></li>`).join('')}
      </ul>
      <div style="margin-top:0.6em;">
        ${data.alert ? `<span class="status warning">${data.alert}</span>` : ""}
      </div>
    </div>
  `;
}
function updateMeteoCard(data) {
  document.getElementById('meteo-card').innerHTML = `
    <h2>
      <span class="meteo-icon">${data.emoji}</span>Météo
    </h2>
    <div>
      <b>${data.temp}°C</b> — ${data.status} <br>
      Vent : ${data.wind} km/h
    </div>
  `;
}
function updateMeteoHoursCard(data) {
  document.getElementById('meteo-hours-card').innerHTML = `
    <h2>
      <span class="meteo-icon">⏰</span>Prochaines heures
    </h2>
    <div>
      ${data.hours.map(h => `
        <div class="meteo-hour-block">
          <span>${h.time}</span><br>
          <span class="hour-picto">${h.picto}</span><br>
          <span class="hour-temp">${h.temp}°</span>
        </div>
      `).join('')}
    </div>
  `;
}

// Pour test alerte :
// showTrafficAlert("Trafic perturbé sur la ligne A");
// hideTrafficAlert();
