
// =============================
//  CONFIGURATION & CONSTANTES
// =============================

const API_PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev";
const STOP_AREAS = {
  rer: "STIF:StopArea:SP:43135:",
  bus77: "STIF:StopArea:SP:463641:",
  bus201: "STIF:StopArea:SP:463644:"
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
      `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}&PreviewInterval=PT12H`
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

function updateWeatherBloc(temp = 32, condition = "Soleil") {
  document.getElementById("weather-bloc").innerHTML =
    `<div class='bloc-titre'><img src='img/picto-meteo.svg' class='icon-inline'>Météo</div>
     <div>🌡️ Température : <b>${temp}°C</b></div>
     <div>☀️ ${condition}</div>`;
}

function updateInfoTraficBloc() {
  document.getElementById("info-trafic-bloc").innerHTML =
    `<div class='bloc-titre'><img src='img/picto-info.svg' class='icon-inline'>Info trafic autour de l’hippodrome</div>
     <div style="margin-top:10px">
        Consultez en temps réel les conditions de circulation autour de l’hippodrome via :
        <ul>
          <li><a href="https://www.sytadin.fr/" target="_blank" rel="noopener">Sytadin</a></li>
          <li><a href="https://www.bison-fute.gouv.fr/paris-ile-de-france.html" target="_blank" rel="noopener">Bison Futé</a></li>
        </ul>
     </div>
     <div style="margin-top:10px">
        <a href="https://www.sytadin.fr/" target="_blank" rel="noopener">
          <button style="padding:8px 16px;font-size:1em;">Voir la carte trafic Sytadin</button>
        </a>
     </div>`;
}

function updateVelibBloc(elementId, mechanical = 8, ebike = 2, free = 6) {
  document.getElementById(elementId).innerHTML = `
    <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
    🚲 Mécaniques : ${mechanical}<br>
    ⚡ Électriques : ${ebike}<br>
    🅿️ Places libres : ${free}
  `;
}

async function renderDepartures(elementId, stopKey) {
  const visits = await fetchRealTime(STOP_AREAS[stopKey]);
  const now = new Date();

  if (!visits.length) {
    const nextStartTime = await getNextScheduledTime(STOP_AREAS[stopKey]);

    let message = "Aucun passage prévu actuellement";
    if (nextStartTime) {
      const nextDate = new Date(nextStartTime);
      message = (nextDate > now)
        ? `⏳ Service non commencé – reprise prévue à ${formatTime(nextDate)}`
        : `✅ Service terminé – prochain départ demain à ${formatTime(nextDate)}`;
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
//  Rafraîchissement global
// ===================

function refreshAll() {
  updateDateBloc();
  updateWeatherBloc();
  updateInfoTraficBloc();
  updateVelibBloc("velib-vincennes");
  updateVelibBloc("velib-breuil");
  renderDepartures("rer-content", "rer");
  renderDepartures("bus77-content", "bus77");
  renderDepartures("bus201-content", "bus201");
}

refreshAll();
setInterval(refreshAll, 60000);
