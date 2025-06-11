
const stops = {
  rer: "STIF:StopArea:SP:43135:",
  bus77: "STIF:StopArea:SP:463641:",
  bus201: "STIF:StopArea:SP:463644:"
};
const endpoints = Object.entries(stops).map(([key, id]) => [
  key,
  `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${id}`
]);

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR");
  document.getElementById("last-update").textContent = now.toLocaleTimeString("fr-FR");
}

async function fetchAndRenderTransport() {
  for (const [key, url] of endpoints) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      const container = document.getElementById(`${key}-content`);
      container.innerHTML = `<h2>${key.toUpperCase()}</h2>`;
      json.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit.slice(0, 4).forEach((visit) => {
        const line = visit.MonitoredVehicleJourney.PublishedLineName;
        const dest = visit.MonitoredVehicleJourney.DestinationName;
        const aimed = visit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;
        const date = new Date(aimed);
        container.innerHTML += `<div><strong>Ligne ${line}</strong> → ${dest}<br/>Départ : ${date.toLocaleTimeString("fr-FR")}</div>`;
      });
      // Ajout fictif pour premiers/derniers horaires (à remplacer par données GTFS ensuite)
      container.innerHTML += `<div class="schedules"><em>Premier départ : 05:30</em><br/><em>Dernier départ : 23:45</em></div>`;
    } catch (e) {
      console.error("Erreur chargement : ", e);
    }
  }
}

updateDateTime();
fetchAndRenderTransport();
setInterval(updateDateTime, 60000);
setInterval(fetchAndRenderTransport, 60000);
