// =============================
//  CONFIGURATION & CONSTANTES
// =============================

const API_PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev";
const STOP_POINTS_IDFM = {
  rer: "STIF:StopPoint:Q:43135:",
  bus77: "STIF:StopPoint:Q:463641:",
  bus201: "STIF:StopPoint:Q:463644:"
};
const VELIB_IDS = { vincennes: "1074333296", breuil: "508042092" };

const STOP_POINTS = {
  rer: {
    name: "RER A Joinville-le-Pont",
    icon: "img/picto-rer-a.svg"
  },
  bus77: {
    name: "BUS 77 Hippodrome de Vincennes",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "BUS 201 Ecole du Breuil",
    icon: "img/picto-bus.svg"
  }
};

// ===================
//   UTILS
// ===================

function formatTime(d, withSec = false) {
  if (!d) return "-";
  let date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "-";
  const opts = withSec ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : { hour: "2-digit", minute: "2-digit" };
  return date.toLocaleTimeString("fr-FR", opts);
}

function formatDateFr(d = new Date()) {
  return d.toLocaleDateString("fr-FR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ===================
//  API REALTIME
// ===================

async function fetchRealTime(monitoringRef) {
  try {
    const url = `${API_PROXY}/?url=${encodeURIComponent(
      `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}`
    )}`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
  } catch (error) {
    console.error("Erreur fetch realtime", error);
    return [];
  }
}

async function getNextScheduledTime(monitoringRef) {
  try {
    const url = `${API_PROXY}/?url=${encodeURIComponent(
      `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}`
    )}`;
    const res = await fetch(url);
    const data = await res.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    return visits[0]?.MonitoredVehicleJourney?.MonitoredCall?.AimedDepartureTime || null;
  } catch {
    return null;
  }
}

// ===================
//  AFFICHAGE DES BLOCS
// ===================

function updateDateBloc() {
  document.getElementById("current-date").textContent = formatDateFr();
  document.getElementById("current-time").textContent = formatTime(new Date());
}

// Vélib' dynamique
async function updateVelibBloc(elementId, stationId) {
  // 1er essai : API IDFM (plus fiable)
  try {
    const url = "https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";
    const data = await fetch(url).then(r => r.json());
    const station = data?.data?.stations?.find(s => s.station_id == stationId);
    if (!station) throw new Error("Station Vélib non trouvée");
    const mechanical = station.num_bikes_available_types?.find(b => b.mechanical !== undefined)?.mechanical ?? 0;
    const ebike = station.num_bikes_available_types?.find(b => b.ebike !== undefined)?.ebike ?? 0;
    const free = station.num_docks_available ?? 0;
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      🚲 Mécaniques : ${mechanical}<br>
      ⚡ Électriques : ${ebike}<br>
      🅿️ Places libres : ${free}
    `;
    return;
  } catch (e) {
    // fallback
  }

  // 2e essai : OpenData Paris
  try {
    const url = "https://opendata.paris.fr/api/v2/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json";
    const data = await fetch(url).then(r => r.json());
    const station = data.find(s => s.stationcode == stationId);
    if (!station) throw new Error("Station Vélib non trouvée (OpenData)");
    const mechanical = station.mechanical ?? 0;
    const ebike = station.ebike ?? 0;
    const free = station.numdocksavailable ?? 0;
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      🚲 Mécaniques : ${mechanical}<br>
      ⚡ Électriques : ${ebike}<br>
      🅿️ Places libres : ${free}
    `;
    return;
  } catch (e2) {
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      <div class='error'>Erreur chargement Vélib</div>
    `;
  }
}

// Bloc trafic routier Sytadin (lien uniquement)
function updateTrafficBloc() {
  document.getElementById("info-trafic-bloc").innerHTML = `
    <div class='bloc-titre'><img src='img/picto-info.svg' class='icon-inline'>Info trafic routier autour de l’hippodrome</div>
    <div style="margin-top:10px">
      <a href="https://www.sytadin.fr/" target="_blank" rel="noopener">
        <button style="padding:8px 16px;font-size:1em;">Voir la carte Sytadin</button>
      </a>
    </div>`;
}

async function renderDepartures(elementId, stopKey) {
  const visits = await fetchRealTime(STOP_POINTS_IDFM[stopKey]);
  const now = new Date();

  if (!visits.length) {
    const nextStartTime = await getNextScheduledTime(STOP_POINTS_IDFM[stopKey]);
  
    let message = "Aucun passage prévu actuellement";
    if (nextStartTime) {
      const nextDate = new Date(nextStartTime);
      const label = stopKey === "rer" ? "train" : "bus";
      message = (nextDate > now)
        ? `⏳ Service non commencé – premier ${label} prévu à ${formatTime(nextDate)}`
        : `✅ Service terminé – prochain ${label} demain à ${formatTime(nextDate)}`;
    }

    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div>
      <ul><li>${message}</li></ul>
      <div class='schedule-extremes'>Aucun passage en cours</div>
    `;
    return;
  }

  const list = visits.slice(0, 4).map(v => {
    const t = v.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;
    const dest = v.MonitoredVehicleJourney.DestinationName || "Terminus";
    return `<li>${formatTime(t)} → ${dest}</li>`;
  }).join("");

  const first = visits[0].MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;
  const last = visits.at(-1).MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;

  document.getElementById(elementId).innerHTML = `
    <div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div>
    <ul>${list}</ul>
    <div class='schedule-extremes'>
      Premier départ : ${formatTime(first)}<br>
      Dernier départ : ${formatTime(last)}
    </div>`;
}

// ===================
//  METEO DYNAMIQUE (Open-Meteo)
// ===================

async function fetchWeather() {
  const lat = 48.8327, lon = 2.4382;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Europe%2FParis`;

  let html = `<div class='bloc-titre'><img src='img/picto-meteo.svg' class='icon-inline'>Météo</div>`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.current_weather) {
      const temp = Math.round(data.current_weather.temperature);
      const wind = Math.round(data.current_weather.windspeed);
      const code = data.current_weather.weathercode;
      const label = weatherCodeToString(code);
      const icon = `img/${code}.png`;

      html += `<div style="display:flex;align-items:center;gap:10px;">
                 <img src="${icon}" style="height:48px;" alt="${label}">
                 <div>
                   <div>🌡️ <b>${temp}°C</b></div>
                   <div>💨 ${wind} km/h</div>
                   <div>🌤️ ${label}</div>
                 </div>
               </div>`;
    } else {
      html += "<div>Météo indisponible</div>";
    }
  } catch (e) {
    html += "<div>Erreur météo</div>";
  }

  document.getElementById("weather-bloc").innerHTML = html;
}

function weatherCodeToString(code) {
  const mapping = {
    0: "Ciel dégagé", 1: "Principalement dégagé", 2: "Partiellement nuageux", 3: "Couvert",
    45: "Brouillard", 48: "Brouillard givrant", 51: "Bruine légère", 53: "Bruine modérée",
    55: "Bruine dense", 56: "Bruine verglaçante légère", 57: "Bruine verglaçante dense",
    61: "Pluie faible", 63: "Pluie modérée", 65: "Pluie forte", 66: "Pluie verglaçante légère",
    67: "Pluie verglaçante forte", 71: "Neige faible", 73: "Neige modérée", 75: "Neige forte",
    77: "Grains de neige", 80: "Averses faibles", 81: "Averses modérées", 82: "Averses violentes",
    85: "Averses de neige faibles", 86: "Averses de neige fortes", 95: "Orage",
    96: "Orage avec grêle légère", 99: "Orage avec grêle forte"
  };
  return mapping[code] || "Inconnu";
}

// ===================
//  Rafraîchissement global
// ===================

function refreshAll() {
  updateDateBloc();
  fetchWeather();
  updateTrafficBloc();
  updateVelibBloc("velib-vincennes", VELIB_IDS.vincennes);
  updateVelibBloc("velib-breuil", VELIB_IDS.breuil);
  renderDepartures("rer-content", "rer");
  renderDepartures("bus77-content", "bus77");
  renderDepartures("bus201-content", "bus201");
}

refreshAll();
setInterval(refreshAll, 60000);
