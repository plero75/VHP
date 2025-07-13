import { CONFIG } from './config.js';
import { fetchRERAStops } from './modules/fetchRERAStops.js';

document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  setInterval(updateDateTime, 10000);

  fetchStopMonitoring(CONFIG.STOPS.rerA_area, "rer-schedules");

fetchRERAStops({
  monitoringRef: CONFIG.STOPS.rerA_point,
  proxyURL: CONFIG.PROXY_BASE,
  targetElementId: "rer-a-stops"
});

  fetchWeather();
  fetchNews();
  fetchVelib(CONFIG.VELIB.vincennes, CONFIG.VELIB.breuil);
  fetchRaces();
});

// Horloge
function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").innerText = now.toLocaleString("fr-FR");
}

// Horaires en temps réel
async function fetchStopMonitoring(stopId, targetId) {
  const url = `${CONFIG.PROXY_BASE}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const journeys = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit || [];

    const container = document.getElementById(targetId);
    container.innerHTML = "";

    journeys.slice(0, 4).forEach(journey => {
      const aimed = new Date(journey.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime);
      const expected = new Date(journey.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime);
      const delay = Math.round((expected - aimed) / 60000);
      const status = journey.MonitoredVehicleJourney.DatedVehicleJourneyRef.includes("cancelled") ? "❌ Supprimé" : (delay > 0 ? `⚠️ +${delay} min` : "🟢 À l'heure");

      container.innerHTML += `<div>
        🕐 ${expected.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${status}
      </div>`;
    });

  } catch (e) {
    document.getElementById(targetId).innerHTML = "Erreur chargement horaires";
  }
}

// Météo
async function fetchWeather() {
  try {
    const res = await fetch(CONFIG.WEATHER_URL);
    const data = await res.json();
    const temp = data.current.temperature_2m;
    const code = data.current.weathercode;

    document.getElementById("weather").innerHTML = `Température : ${temp}°C<br>Météo : ${translateWeather(code)}`;
  } catch (e) {
    document.getElementById("weather").innerHTML = "Erreur météo";
  }
}

function translateWeather(code) {
  const map = {
    0: "☀️ Clair",
    1: "🌤 Peu nuageux",
    2: "⛅ Nuageux",
    3: "☁️ Couvert",
    45: "🌫 Brouillard",
    51: "🌦 Pluie légère",
    61: "🌧 Pluie",
    71: "🌨 Neige",
    80: "🌧 Averses"
  };
  return map[code] || "❓ Inconnu";
}

// Vélib
async function fetchVelib(st1, st2) {
  try {
    const [res1, res2] = await Promise.all([
      fetch(`https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json`),
      fetch(`https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json`)
    ]);

    const status = await res1.json();
    const info = await res2.json();

    const stations = [st1, st2].map(({ station_id }) => {
      const s = status.data.stations.find(x => x.station_id == station_id);
      const i = info.data.stations.find(x => x.station_id == station_id);
      return `${i.name} – 🚲 ${s.num_bikes_available} / 🅿️ ${s.num_docks_available}`;
    });

    document.getElementById("velib-info").innerHTML = stations.join("<br>");
  } catch (e) {
    document.getElementById("velib-info").innerHTML = "Erreur Vélib'";
  }
}

// News
async function fetchNews() {
  try {
    const res = await fetch(CONFIG.NEWS_URL);
    const data = await res.json();
    const html = data.slice(0, 3).map(n => `<div>📰 ${n.title}</div>`).join("");
    document.getElementById("news-banner-content").innerHTML = html;
  } catch (e) {
    document.getElementById("news-banner-content").innerHTML = "Erreur news";
  }
}

// Courses
async function fetchRaces() {
  try {
    const res = await fetch(CONFIG.RACES_URL);
    const data = await res.json();
    const html = data.slice(0, 3).map(r => `<div>🐎 ${r.date} – ${r.event}</div>`).join("");
    document.getElementById("races-content").innerHTML = html;
  } catch (e) {
    document.getElementById("races-content").innerHTML = "Erreur courses";
  }
}
