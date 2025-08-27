// On récupère la config globale
const CONFIG = window.CONFIG;

document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  setInterval(updateDateTime, 10000);

  // Charger horaires RER A
  fetchStopMonitoring(CONFIG.STOPS.RER_A_JOINVILLE_STOPAREA, "rerA");

  // Charger météo
  fetchWeather();

  // Charger actus
  fetchNews();

  // Charger Vélib
  loadVelib();

  // Charger courses
  fetchRaces();
});

// Horloge
function updateDateTime() {
  const el = document.getElementById("datetime");
  if (el) el.innerText = new Date().toLocaleString("fr-FR");
}

// Horaires en temps réel
async function fetchStopMonitoring(stopId, moduleId) {
  const url = `${CONFIG.PROXY}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("StopMonitoring data", data);

    const journeys = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const container = document.getElementById(`${moduleId}-traffic`);
    if (!container) return;

    container.innerHTML = "";

    journeys.slice(0, 4).forEach(journey => {
      const aimed = new Date(journey.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime);
      const expected = new Date(journey.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime);
      const delay = Math.round((expected - aimed) / 60000);
      const status = journey.MonitoredVehicleJourney.DatedVehicleJourneyRef?.includes("cancelled")
        ? "❌ Supprimé"
        : (delay > 0 ? `⚠️ +${delay} min` : "🟢 À l'heure");

      container.innerHTML += `<div>
        🕐 ${expected.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${status}
      </div>`;
    });
  } catch (e) {
    console.error("fetchStopMonitoring error:", e);
    const container = document.getElementById(`${moduleId}-traffic`);
    if (container) container.innerHTML = "Erreur chargement horaires";
  }
}

// Météo (exemple basique, à adapter selon API)
async function fetchWeather() {
  try {
    const res = await fetch(`${CONFIG.PROXY}https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.COORDS.lat}&longitude=${CONFIG.COORDS.lon}&current_weather=true`);
    const data = await res.json();
    console.log("Météo", data);
    const el = document.getElementById("weather");
    if (el && data.current_weather) {
      el.textContent = `🌡️ ${data.current_weather.temperature}°C — ${data.current_weather.weathercode}`;
    }
  } catch (e) {
    console.error("fetchWeather error:", e);
  }
}

// Actus locales (depuis news.json)
async function fetchNews() {
  try {
    const res = await fetch("./news.json");
    const data = await res.json();
    console.log("News", data);
    renderCarousel(data);
  } catch (e) {
    console.error("fetchNews error:", e);
  }
}

// Courses (depuis races.json)
async function fetchRaces() {
  try {
    const res = await fetch("./races.json");
    const data = await res.json();
    console.log("Courses", data);
    const el = document.getElementById("race-next");
    if (el && data.length) {
      el.textContent = `${data[0].date} — ${data[0].event}`;
    }
  } catch (e) {
    console.error("fetchRaces error:", e);
  }
}
