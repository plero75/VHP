const RER_API_URL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:43135:";
const BUS77_API_URL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463641:";
const BUS201_API_URL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463644:";
const VELIB_API_URL = "https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";

const VELIB_STATION_CODES = {
  "velib-vincennes": "12163",
  "velib-breuil": "12128"
};

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', hour12: false });
  document.getElementById("last-update").textContent = now.toLocaleString("fr-FR");
}

function formatTime(str) {
  const date = new Date(str);
  return isNaN(date) ? "Invalid Date" : date.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', hour12: false });
}

function renderDepartures(id, data, label) {
  const container = document.getElementById(id);
  const times = [];

  try {
    const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;
    visits.slice(0, 4).forEach(visit => {
      const aimed = visit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;
      const direction = visit.MonitoredVehicleJourney.DirectionName || "Direction inconnue";
      times.push(new Date(aimed));
      container.innerHTML += `<p>▶ ${formatTime(aimed)} → ${direction}</p>`;
    });

    if (times.length > 0) {
      const sortedTimes = times.sort((a, b) => a - b);
      container.innerHTML += `<p><strong>Premier départ :</strong> ${formatTime(sortedTimes[0])}</p>`;
      container.innerHTML += `<p><strong>Dernier départ :</strong> ${formatTime(sortedTimes[times.length - 1])}</p>`;
    } else {
      container.innerHTML += `<p>Aucun passage à venir</p>`;
    }
  } catch (e) {
    container.innerHTML += `<p>Erreur de données</p>`;
    console.error(e);
  }
}

function renderVelibStations(data) {
  for (const [elementId, stationCode] of Object.entries(VELIB_STATION_CODES)) {
    const station = data.data.stations.find(s => s.stationCode === stationCode);
    const container = document.getElementById(elementId);

    if (station) {
      container.innerHTML += `
        <p>Vélos disponibles : <strong>${station.num_bikes_available}</strong></p>
        <p>Places libres : <strong>${station.num_docks_available}</strong></p>
      `;
    } else {
      container.innerHTML = `<p>Station non trouvée</p>`;
    }
  }
}

async function fetchAndDisplay() {
  updateDateTime();
  try {
    const [rerRes, bus77Res, bus201Res, velibRes] = await Promise.all([
      fetch(RER_API_URL),
      fetch(BUS77_API_URL),
      fetch(BUS201_API_URL),
      fetch(VELIB_API_URL)
    ]);

    const rerData = await rerRes.json();
    const bus77Data = await bus77Res.json();
    const bus201Data = await bus201Res.json();
    const velibData = await velibRes.json();

    renderDepartures("rer-content", rerData, "RER A");
    renderDepartures("bus77-content", bus77Data, "BUS 77");
    renderDepartures("bus201-content", bus201Data, "BUS 201");
    renderVelibStations(velibData);

  } catch (error) {
    console.error("Erreur dans fetchAndDisplay :", error);
  }
}

setInterval(fetchAndDisplay, 60000);
fetchAndDisplay();
