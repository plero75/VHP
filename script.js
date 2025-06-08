let gtfsStopTimesCache = null;

async function loadGtfsStopTimes() {
  if (gtfsStopTimesCache) return gtfsStopTimesCache;
  const url = "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/offre-horaires-tc-gtfs-idfm/exports/json";
  const res = await fetch(url);
  const data = await res.json();
  gtfsStopTimesCache = data.stop_times;
  return gtfsStopTimesCache;
}

/**
 * Retourne les horaires (Date JS) de départ pour un stop_id un jour donné
 * @param {Array} stop_times - stop_times du GTFS (JSON)
 * @param {String} stop_id - ex: "STIF:StopArea:SP:43135:"
 * @param {String} dateStr - ex: "2025-06-08"
 * @returns {Array<Date>} - horaires dans la journée
 */
function getDeparturesForStopToday(stop_times, stop_id, dateStr) {
  // Correspondance souple (GTFS peut avoir juste "43135" au lieu de "STIF:StopArea:SP:43135:")
  let normalizedId = stop_id.replace(/^STIF:StopArea:SP:/, '').replace(/:$/, '');
  const todayTrips = stop_times
    .filter(st => st.stop_id === stop_id || st.stop_id === normalizedId)
    .map(st => st.departure_time)
    .filter(Boolean);

  return todayTrips.map(time => {
    let [h, m, s] = time.split(":").map(Number);
    let d = new Date(dateStr + "T00:00:00");
    d.setHours(h, m, s || 0);
    // Cas > 24h (bus de nuit)
    if (h >= 24) {
      d.setDate(d.getDate() + Math.floor(h / 24));
      d.setHours(h % 24);
    }
    return d;
  }).sort((a, b) => a - b);
}

function updateDateTime() {
  // Ces IDs n'existent pas dans ton HTML actuellement :
  // document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  // document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
  // Soit tu ajoutes les divs correspondantes dans index.html, soit tu retires cette fonction
}

async function updateWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true");
    const data = await res.json();
    const w = data.current_weather;
    document.getElementById("weather-content").textContent =   `🌤 ${w.temperature}°C · Vent ${w.windspeed} km/h`;
  } catch {
    document.getElementById("weather-content").textContent = "🌤 Météo indisponible";
  }
}

function clearAllBlocks() {
  ["bus77-content", "bus201-content", "rer-content", "velib12128", "velib12163"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

 async function fetchStopMonitoringWithGtfs(ref, containerId, stop_id) {
  // On charge GTFS si besoin
  const stop_times = await loadGtfsStopTimes();
  const todayStr = new Date().toISOString().slice(0, 10);
  const departures = getDeparturesForStopToday(stop_times, stop_id, todayStr);
  const now = new Date();

  if (!departures.length) {
    document.getElementById(containerId).innerHTML =
      `<div class="status warning">🛑 Pas d'horaire théorique disponible pour cet arrêt aujourd'hui</div>`;
    return;
  }

  const premier = departures[0];
  const dernier = departures[departures.length - 1];

  if (now < premier) {
    document.getElementById(containerId).innerHTML = `
      <div class="status warning">🕓 Service pas encore commencée</div>
      <div class="small">Premier passage à ${premier.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>`;
    return;
  }

  if (now > dernier) {
    document.getElementById(containerId).innerHTML = `
      <div class="status warning">🛑 Service de la journée terminée</div>
      <div class="small">Dernier passage à ${dernier.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>`;
    return;
  }

  // Sinon, on affiche les prochains passages temps réel
  await fetchStopMonitoring(ref, containerId);
}

// Liste des stations à afficher (nom exact ou code station)
const velibStations = [
  { name: "Pyramide - Ecole du Breuil", container: "velib-breuil" },
  { code: "12163", container: "velib-vincennes" }
];

// Fonction utilitaire de normalisation des noms (ignore accents et casse)
function normalizeString(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Fonction d'affichage d'une station Vélib depuis open data Paris
async function fetchAndDisplayAllVelibStations() {
  const url = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json";
  let stations;
  try {
    const res = await fetch(url);
    stations = await res.json();
  } catch (e) {
    velibStations.forEach(sta => {
      document.getElementById(sta.container).innerHTML = "Erreur Vélib (Paris) : " + e.message;
    });
    return;
  }

  for (const sta of velibStations) {
    let station;
    if (sta.code) {
      // Recherche par code station
      station = stations.find(s => s.stationcode === sta.code);
    } else if (sta.name) {
      // Recherche par nom, tolérante aux accents/casse
      station = stations.find(s => normalizeString(s.name) === normalizeString(sta.name));
    }
    if (!station) {
      document.getElementById(sta.container).innerHTML = "Station Vélib’ non trouvée.";
      continue;
    }
    document.getElementById(sta.container).innerHTML = `
      <b>${station.name}</b><br>
      Vélos mécaniques dispo : ${station.mechanical}<br>
      Vélos électriques dispo : ${station.ebike}<br>
      Bornes libres : ${station.numdocksavailable}<br>
      Vélos totaux disponibles : ${station.numbikesavailable}<br>
      État : ${station.status === "OPEN" ? "Ouverte" : "Fermée"}
    `;
  }
}

// Appel initial et rafraîchissement toutes les minutes
fetchAndDisplayAllVelibStations();
setInterval(fetchAndDisplayAllVelibStations, 60000);

// === MODIFIE refreshAll POUR UTILISER LA NOUVELLE FONCTION ===

function refreshAll() {
  clearAllBlocks();
  updateDateTime && updateDateTime();
  updateWeather();
  fetchStopMonitoringWithGtfs("STIF:StopArea:SP:43135:", "rer-content", "STIF:StopArea:SP:43135:");
  fetchStopMonitoringWithGtfs("STIF:StopArea:SP:463641:", "bus77-content", "STIF:StopArea:SP:463641:");
  fetchStopMonitoringWithGtfs("STIF:StopArea:SP:463644:", "bus201-content", "STIF:StopArea:SP:463644:");
  updateVelib();




refreshAll();
setInterval(refreshAll, 60000);
