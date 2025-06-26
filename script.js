// =============================
//  CONFIGURATION & CONSTANTES
// =============================

const API_PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev";
const STOP_POINTS = {
  rer: {
    monitoringRef: "STIF:StopArea:SP:475771:",
    lineRef: "STIF:Line::C01742:",
    name: "RER A Joinville-le-Pont",
    icon: "img/picto-rer-a.svg"
  },
  bus77E: {
    monitoringRef: "STIF:StopPoint:Q:417601:",
    lineRef: "STIF:Line::C02251:",
    name: "BUS 77 Hippodrome (Est)",
    icon: "img/picto-bus.svg"
  },
  bus77O: {
    monitoringRef: "STIF:StopPoint:Q:417602:",
    lineRef: "STIF:Line::C02251:",
    name: "BUS 77 Hippodrome (Ouest)",
    icon: "img/picto-bus.svg"
  },
  bus201A: {
    monitoringRef: "STIF:StopPoint:Q:423233:",
    lineRef: "STIF:Line::C01219:",
    name: "BUS 201 École du Breuil (A)",
    icon: "img/picto-bus.svg"
  },
  bus201B: {
    monitoringRef: "STIF:StopPoint:Q:423235:",
    lineRef: "STIF:Line::C01219:",
    name: "BUS 201 École du Breuil (B)",
    icon: "img/picto-bus.svg"
  }
};
const VELIB_IDS = {
  vincennes: "12163",
  breuil: "12128"
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

async function fetchRealTime(monitoringRef, lineRef) {
  try {
    const url = `${API_PROXY}/?url=${encodeURIComponent(
      `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}&LineRef=${lineRef}`
    )}`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
  } catch (error) {
    console.error("Erreur fetch realtime", error);
    return [];
  }
}

async function getExtremes(monitoringRef, lineRef) {
  // Option la plus fiable : GTFS local, sinon API PreviewInterval (risque de quota)
  try {
    const url = `${API_PROXY}/?url=${encodeURIComponent(
      `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}&LineRef=${lineRef}&PreviewInterval=PT24H`
    )}`;
    const response = await fetch(url);
    const data = await response.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    if (!visits.length) return { first: null, last: null };
    return {
      first: visits[0].MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime,
      last: visits.at(-1).MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime
    };
  } catch {
    return { first: null, last: null };
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
  try {
    const url = "https://opendata.paris.fr/api/records/1.0/search/?dataset=velib-disponibilite-en-temps-reel&q=stationcode=" + stationId;
    const data = await fetch(url).then(r => r.json());
    const station = data.records[0]?.fields;
    if (!station) throw new Error("Station Vélib non trouvée");
    const mechanical = station.mechanical ?? 0;
    const ebike = station.ebike ?? 0;
    const free = station.numdocksavailable ?? 0;
    const status = station.status === "OPEN" ? "🟢 Ouverte" : "🔴 Fermée";
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      🚲 Mécaniques : ${mechanical}<br>
      ⚡ Électriques : ${ebike}<br>
      🅿️ Places libres : ${free}<br>
      ${status}
    `;
  } catch (e) {
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

// ===================
//  ARRÊTS DESSERVIS (cache + fallback GTFS possible)
// ===================
const stopsCache = {};

async function fetchStopsForVehicleJourney(vehicleJourneyRef) {
  if (stopsCache[vehicleJourneyRef]) return stopsCache[vehicleJourneyRef];
  const proxy = API_PROXY + "/?url=";
  const url = `${proxy}${encodeURIComponent(
    `https://prim.iledefrance-mobilites.fr/marketplace/vehicle-journeys/${vehicleJourneyRef}/stop_points`
  )}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Erreur vehicle-journey stop_points");
    const data = await res.json();
    const stops = data?.stop_points?.map(p => p.name) || [];
    stopsCache[vehicleJourneyRef] = stops;
    setTimeout(() => delete stopsCache[vehicleJourneyRef], 120000);
    return stops;
  } catch (e) {
    return [];
  }
}

// ===================
//  RENDU DES HORAIRES
// ===================

async function renderDepartures(elementId, stopKey) {
  const { monitoringRef, lineRef, name, icon } = STOP_POINTS[stopKey];
  const visits = await fetchRealTime(monitoringRef, lineRef);
  const now = new Date();

  if (!visits.length) {
    const nextStartTime = null; // Option : getNextScheduledTime(monitoringRef);
    let message = "Aucun passage prévu actuellement";
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='${icon}' class='icon-inline'>${name}</div>
      <ul><li>${message}</li></ul>
      <div class='schedule-extremes'>Aucun passage en cours</div>
    `;
    return;
  }

  // Premier & dernier départ du jour (si quota API OK, sinon GTFS conseillé)
  const extremes = await getExtremes(monitoringRef, lineRef);

  const list = await Promise.all(
    visits.slice(0, 4).map(async v => {
      const t = v.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;
      const dest = v.MonitoredVehicleJourney.DestinationName || "Terminus";
      const vehicleJourneyRef = v.MonitoredVehicleJourney.VehicleJourneyRef;
      const aimed = v.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;
      const expected = v.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime;
      const delay = (expected && aimed) ? Math.round((new Date(expected) - new Date(aimed)) / 60000) : 0;
      const delayStr = delay > 1 ? `<span class="retard">+${delay} min</span>` : "";
      const stops = await fetchStopsForVehicleJourney(vehicleJourneyRef);
      const stopsStr = stops.length ? `<br><span class="defile-arrets">${stops.join(" – ")}</span>` : "";
      return `<li>${formatTime(t)} ${delayStr} → ${dest}${stopsStr}</li>`;
    })
  ).then(items => items.join(""));

  document.getElementById(elementId).innerHTML = `
    <div class='title-line'><img src='${icon}' class='icon-inline'>${name}</div>
    <ul>${list}</ul>
    <div class='schedule-extremes'>
      Premier départ : ${formatTime(extremes.first)}<br>
      Dernier départ : ${formatTime(extremes.last)}
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
  renderDepartures("bus77E-content", "bus77E");
  renderDepartures("bus77O-content", "bus77O");
  renderDepartures("bus201A-content", "bus201A");
  renderDepartures("bus201B-content", "bus201B");
}

refreshAll();
setInterval(refreshAll, 60000);

// ===================
//  CSS à ajouter dans ton fichier
// ===================
/*
.defile-arrets {
  font-size: 0.95em;
  color: #555;
  display: block;
  margin-top: 2px;
  white-space: normal;
}
.retard {
  color: #b00;
  font-weight: bold;
  margin-left: 6px;
}
*/
