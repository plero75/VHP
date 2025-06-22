// Décodage d'entités HTML
function decodeEntities(encoded) {
  const txt = document.createElement('textarea');
  txt.innerHTML = encoded;
  return txt.value;
}

const STOP_POINTS = {
  rer: {
    name: "RER A",
    icon: "img/picto-rer-a.svg",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:43135:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:monomodalStopPlace:43135/route_schedules?line=line:IDFM:C01742&from_datetime=",
    trafficUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:C01742",
    directionRef: null // à renseigner si besoin de ne garder qu'un seul sens
  },
  bus77: {
    name: "BUS 77",
    icon: "img/picto-bus.svg",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463641:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463641/route_schedules?line=line:IDFM:C02251&from_datetime=",
    trafficUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:C02251"
  },
  bus201: {
    name: "BUS 201",
    icon: "img/picto-bus.svg",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:463644:",
    scheduleUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_points/stop_point:IDFM:463644/route_schedules?line=line:IDFM:C01219&from_datetime=",
    trafficUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:C01219"
  }
};

const VELIB_IDS = { vincennes: "1074333296", breuil: "508042092" };

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent = now.toLocaleDateString("fr-FR");
  document.getElementById("current-time").textContent = now.toLocaleTimeString("fr-FR");
  document.getElementById("last-update").textContent = now.toLocaleString("fr-FR");
}

function formatTime(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return isNaN(d) ? "–" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function getDestination(dest) {
  if (!dest) return "–";
  if (typeof dest === "string") return dest;
  if (Array.isArray(dest)) {
    const first = dest[0];
    return typeof first === "string" ? first : Object.values(first)[0] || "–";
  }
  return Object.values(dest)[0] || "–";
}

function renderDepartures(id, name, visits, icon, first, last, message, isRer, disruptions) {
  // ... (inchangé, conserve les perturbations et le filtrage RER) ...
}

// 🟢 NOUVELLE FONCTION fetchVelib adaptée à l’API Velib_Metropole
async function fetchVelib(stationId, containerId) {
  try {
    // Appel direct à l’open data Vélib’ Métropole
    const url = "https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json";
    const data = await fetchJSON(url);

    // On trouve la station par son station_id
    const station = data.data.stations.find(s => String(s.station_id) === String(stationId));
    if (!station) throw new Error("Station non trouvée");

    // Statuts opérationnels
    if (station.is_installed === 0) {
      throw new Error("Station en cours d'installation");
    }
    if (station.is_renting === 0) {
      throw new Error("Location de vélos indisponible");
    }
    if (station.is_returning === 0) {
      throw new Error("Retour de vélos indisponible");
    }

    // Séparation mécanique vs électrique
    const types = station.num_bikes_available_types[0] || {};
    const mech = types.mechanical || 0;
    const elec = types.ebike || 0;
    const free = station.num_docks_available;

    // Construction de l'affichage
    document.getElementById(containerId).innerHTML = `
      <div class='title-line'>
        <img src='img/picto-velib.svg' class='icon-inline'>Vélib'
      </div>
      <div class="velib-stats">
        <div class="velib-mechanical">
          <span class="velib-icon">🚲</span>
          <span class="velib-count">${mech}</span>
          <span class="velib-label">Mécaniques</span>
        </div>
        <div class="velib-electric">
          <span class="velib-icon">⚡</span>
          <span class="velib-count">${elec}</span>
          <span class="velib-label">Électriques</span>
        </div>
        <div class="velib-free">
          <span class="velib-icon">🅿️</span>
          <span class="velib-count">${free}</span>
          <span class="velib-label">Places libres</span>
        </div>
      </div>
      <div class="velib-last">${new Date(station.last_reported * 1000).toLocaleTimeString("fr-FR")}</div>
    `;
  } catch (e) {
    console.error("Erreur Vélib", e);
    document.getElementById(containerId).innerHTML = `
      <div class='title-line'>
        <img src='img/picto-velib.svg' class='icon-inline'>Vélib'
      </div>
      <div class='error'>${e.message}</div>`;
  }
}

// Le reste du script (fetchTransportBlock, fetchScheduleOncePerDay, refreshAll…) reste inchangé  

// Exemple minimal de fetchJSON pour mémoire
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  return res.json();
}
