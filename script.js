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
// Helper pour normaliser les libellés (RER directions)
function normalize(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ====================
// Vélib (OpenData Paris) : 2 stations dans la même card
async function fetchVelibCard() {
  // Hippodrome = 12163, Pyramide - École du Breuil = 12128
  const stationCodes = ["12163", "12128"];
  try {
    const res = await fetch("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode in ('12163','12128')");
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error('Aucune donnée station');
    // On trie pour toujours avoir Hippodrome puis Pyramide dans l'affichage
    const staHippo = data.results.find(s => s.stationcode === "12163");
    const staBreuil = data.results.find(s => s.stationcode === "12128");
    updateVelibCard({
      hippo: staHippo
        ? {
            station: staHippo.name,
            code: staHippo.stationcode,
            mechanical: staHippo.mechanical,
            ebike: staHippo.ebike,
            docks: staHippo.numdocksavailable,
            alert: staHippo.status !== "OPEN" ? "Station fermée" : ""
          }
        : null,
      breuil: staBreuil
        ? {
            station: staBreuil.name,
            code: staBreuil.stationcode,
            mechanical: staBreuil.mechanical,
            ebike: staBreuil.ebike,
            docks: staBreuil.numdocksavailable,
            alert: staBreuil.status !== "OPEN" ? "Station fermée" : ""
          }
        : null
    });
  } catch (e) {
    updateVelibCard({
      hippo: null,
      breuil: null,
      error: "Erreur données Vélib"
    });
  }
}

function updateVelibCard(data) {
  document.getElementById('velib-card').innerHTML = `
    <h2>
      <span class="velib-picto">🚲</span>Vélib'
    </h2>
    <div>
      ${data.hippo ? `
        <b>${data.hippo.station} <span style="font-size:0.8em;color:#ffd900;">(Hippodrome)</span></b> <span class="ratp-badge">${data.hippo.code}</span><br>
        mécaniques : <b>${data.hippo.mechanical}</b> &nbsp;&nbsp; électriques : <b>${data.hippo.ebike}</b><br>
        bornes libres : <b>${data.hippo.docks}</b>
        <div style="margin-top:0.4em;">
          ${data.hippo.alert ? `<span class="status warning">${data.hippo.alert}</span>` : ""}
        </div>
        <hr style="border:0;border-top:1px solid #222;margin:0.7em 0;">
      ` : `<b>Station Hippodrome indisponible</b><hr style="border:0;border-top:1px solid #222;margin:0.7em 0;">`}
      ${data.breuil ? `
        <b>${data.breuil.station} <span style="font-size:0.8em;color:#ffd900;">(Pyramide - École du Breuil)</span></b> <span class="ratp-badge">${data.breuil.code}</span><br>
        mécaniques : <b>${data.breuil.mechanical}</b> &nbsp;&nbsp; électriques : <b>${data.breuil.ebike}</b><br>
        bornes libres : <b>${data.breuil.docks}</b>
        <div style="margin-top:0.4em;">
          ${data.breuil.alert ? `<span class="status warning">${data.breuil.alert}</span>` : ""}
        </div>
      ` : `<b>Station Pyramide - École du Breuil indisponible</b>`}
      ${data.error ? `<div style="color:#b91c1c;font-weight:bold;">${data.error}</div>` : ""}
    </div>
  `;
}
// ====================
// RER & BUS (IDFM/prim API via proxy)
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

// ====================
// RER A : directions réelles, label Paris en parenthèses, affichage sur 2 lignes
async function fetchRERCard() {
  // Joinville-le-Pont (STIF:StopArea:SP:43839:)
  const ref = "STIF:StopArea:SP:43839:"; // Joinville-le-Pont
  const visits = await fetchIDFMStop(ref);
  if (!visits) {
    updateRERCard({ nextSaintGermain: [], nextBoissy: [], alert: "Données indisponibles", trafic: "Trafic inconnu" });
    return;
  }

  // Directions réelles depuis Joinville-le-Pont
  const destSaintGermain = ["saint-germain", "la defense", "nanterre", "cergy", "poissy"];
  const destBoissy = ["boissy", "marne-la-vallee", "torcy"];

  let nextSaintGermain = [], nextBoissy = [];
  let traficStatus = "Trafic normal";

  for (const v of visits) {
    const dest = (
      v.MonitoredVehicleJourney?.DestinationName?.[0]?.value ||
      v.MonitoredVehicleJourney?.DestinationName ||
      ""
    );
    const aimed = v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
    const dt = aimed ? new Date(aimed) : null;
    const now = new Date();
    const mins = dt ? Math.round((dt - now) / 60000) : null;
    const info = {
      time: dt ? dt.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}) : "--:--",
      wait: mins !== null ? (mins > 0 ? `${mins} min` : "à l'instant") : "?"
    };
    if (destSaintGermain.some(dp => normalize(dest).includes(dp))) nextSaintGermain.push(info);
    else if (destBoissy.some(db => normalize(dest).includes(db))) nextBoissy.push(info);

    // Récupération état trafic (ArrivalStatus)
    if (
      v.MonitoredVehicleJourney?.MonitoredCall?.ArrivalStatus === "delayed"
      && traficStatus === "Trafic normal"
    ) {
      traficStatus = "Perturbation sur la ligne";
    }
  }

  updateRERCard({
    nextSaintGermain,
    nextBoissy,
    alert: "",
    trafic: traficStatus
  });
}

// Affichage RER A avec Paris en parenthèses
function updateRERCard({nextSaintGermain, nextBoissy, alert, trafic}) {
  document.getElementById('rer-card').innerHTML = `
    <h2>
      <img src="img/picto-rer-a.svg" alt="RER A" style="height:1.2em;vertical-align:middle;">
      Prochains RER à la gare de Joinville-le-Pont :
    </h2>
    <div>
      <div style="font-weight:bold;margin-bottom:0.4em;display:flex;gap:2em;">
        <span style="color:#e2001a;">Vers Saint-Germain-en-Laye <span style="font-weight:normal;">(Paris)</span></span>
        <span style="margin-left:2em;color:#e2001a;">Vers Boissy-St-Léger</span>
      </div>
      <div style="display:flex;gap:2em;">
        <ul style="margin:0;padding:0 1em 0 1em;list-style:none;">
          ${nextSaintGermain.slice(0, 4).map(t => `<li><span>${t.time}</span><br><span class="temps">${t.wait}</span></li>`).join('') || "<li>—</li>"}
        </ul>
        <ul style="margin:0;padding:0 1em 0 1em;list-style:none;">
          ${nextBoissy.slice(0, 4).map(t => `<li><span>${t.time}</span><br><span class="temps">${t.wait}</span></li>`).join('') || "<li>—</li>"}
        </ul>
      </div>
      <div style="margin-top:1em;font-size:1.1em;">
        <b>État du trafic RER A :</b> <span>${trafic}</span>
      </div>
      <div style="margin-top:0.6em;">
        ${alert ? `<span class="status warning">${alert}</span>` : ""}
      </div>
    </div>
  `;
}

// ====================
// BUS : plus de code d’arrêt, bug fix, dernier passage si possible
async function fetchBusCard(line, ref, cardId) {
  const visits = await fetchIDFMStop(ref);
  if (!visits) {
    updateBusCard({
      line, direction: "?", next: [], alert: "Données indisponibles", last: ""
    }, cardId);
    return;
  }
  const direction = visits[0]?.MonitoredVehicleJourney?.DirectionName || "Inconnu";
  const next = visits.slice(0, 4).map(v => {
    const aimed = v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
    const dt = aimed ? new Date(aimed) : null;
    const now = new Date();
    const mins = dt ? Math.round((dt - now) / 60000) : null;
    return {
      time: dt ? dt.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}) : "--:--",
      wait: mins !== null ? (mins > 0 ? `${mins} min` : "à l'instant") : "?"
    };
  });
  // Dernier passage du jour (si data dispo dans visites)
  let last = "";
  if (visits.length > 0) {
    const aimed = visits[visits.length-1].MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
    if (aimed) {
      const dt = new Date(aimed);
      last = dt.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
    }
  }
  const alert = visits.find(v => v.MonitoredVehicleJourney?.MonitoredCall?.ArrivalStatus === "delayed") ? "Perturbation" : "";
  updateBusCard({line, direction, next, alert, last}, cardId);
}

// Affichage BUS
function updateBusCard(data, id) {
  document.getElementById(id).innerHTML = `
    <h2>
      <img src="img/picto-bus.svg" alt="Bus" style="height:1.2em;vertical-align:middle;">
      Bus ${data.line}
    </h2>
    <div>
      <div><span class="bus-line-idfm">${data.line}</span> ${data.direction}</div>
      <ul style="margin:0;padding:0 0 0 1em;">
        ${data.next.map(t => `<li>${t.time} <span class="temps">${t.wait}</span></li>`).join('') || "<li>—</li>"}
      </ul>
      <div style="margin-top:0.6em;">
        ${data.alert ? `<span class="status warning">${data.alert}</span>` : ""}
        ${data.last ? `<div style="margin-top:0.5em;font-size:0.95em;color:#ffd900;">Dernier passage du jour prévu : ${data.last}</div>` : ""}
      </div>
    </div>
  `;
}

// ====================
// Météo (Open-Meteo)
async function fetchMeteoCard() {
  try {
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
    const lat = 48.841; const lon = 2.441;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&forecast_days=1&timezone=Europe%2FParis`;
    const res = await fetch(url);
    const data = await res.json();
    const now = new Date();
    const hours = [];
    for(let i=0; i<6; ++i) {
      const idx = i + now.getHours();
      if (!data.hourly || !data.hourly.time[idx]) continue;
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
// Bloc "Mot du jour"
const motsDuJour = [ 
  // ... (ton JSON complet ici, tronqué pour lisibilité)
  {"Mot":"À cheval","Définition":"C’est jouer à la fois Gagnant et Placé en Simple ou en Couplé. Exemple : Couplé Gagnant 4-6 et Couplé Placé 4-6."},
  {"Mot":"Action","Définition":"Expression qualifiant les foulées du cheval. Elle peut être bonne, grande, mauvaise, raccourcie, petite, etc."},
  // ... etc ...
  {"Mot":"Groupe 1","Définition":"Niveau le plus prestigieux des courses, réservé aux grandes épreuves comme le Prix d'Amérique."}
];
function pickMotDuJour() {
  const d = new Date();
  const idx = d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
  const motIdx = idx % motsDuJour.length;
  return motsDuJour[motIdx];
}
function updateMotDuJourCard() {
  const mot = pickMotDuJour();
  document.getElementById('motjour-card').innerHTML = `
    <h2>📖 Mot du jour</h2>
    <div>
      <span style="font-weight:bold; font-size:1.08em; color:#ffd900;">${mot.Mot}</span>
      <br>
      <span style="font-size:0.98em; color:#fff;">${mot.Définition}</span>
    </div>
  `;
}

// ====================
// Affichage des blocs météo et Vélib (inchangé)
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

// ====================
// UPDATE ALL
async function updateAll() {
  fetchVelibCard();
  fetchRERCard();
  fetchBusCard("77", "STIF:StopArea:SP:463641:", "bus77-card");
  fetchBusCard("201", "STIF:StopArea:SP:463644:", "bus201-card");
  fetchMeteoCard();
  fetchMeteoHoursCard();
  updateMotDuJourCard();
}
updateAll();
setInterval(updateAll, 60000);

// ====================
// Pour test alerte :
// showTrafficAlert("Trafic perturbé sur la ligne A");
// hideTrafficAlert();
