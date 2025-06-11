// === DASHBOARD TEMPS RÉEL JOINVILLE/VINCENNES (IDFM 2024) ===

// --- CONFIG PROXY ---
const PROXY_URL = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/';

// --- Liste des stations Vélib à surveiller ---
const velibStations = [
  { code: "12163", container: "velib-vincennes", name: "Vincennes - République" },
  { code: "12128", container: "velib-breuil", name: "Château de Vincennes - Breuil" }
];

// --- Map des stop_area_id Navitia pour horaires théoriques ---
const stopAreaIdMap = {
  'rer-joinville-content': 'stop_area:IDFM:43134',   // Joinville-le-Pont (RER A)
  'bus77-content':         'stop_area:IDFM:463641',  // Bus 77
  'bus201-content':        'stop_area:IDFM:463644',  // Bus 201
};

// --- Map des line_id Navitia pour disruptions et horaires ---
const lineIdMap = {
  'rer-joinville-content': 'line:IDFM:C01742', // RER A
  'bus77-content':         'line:IDFM:C01777', // Bus 77
  'bus201-content':        'line:IDFM:C01201', // Bus 201
};

// --- Normalisation de chaînes ---
function normalizeString(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// --- AFFICHAGE STATIONS VELIB ---
async function fetchAndDisplayAllVelibStations() {
  const url = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json";
  let stations;
  try {
    const res = await fetch(url, { cache: "no-store" });
    stations = await res.json();
    if (!Array.isArray(stations)) throw new Error("Réponse Vélib' inattendue");
  } catch (e) {
    velibStations.forEach(sta => {
      const el = document.getElementById(sta.container);
      if (el) el.innerHTML = `<div class="status warning">Erreur Vélib (Paris) : ${e.message}</div>`;
    });
    return;
  }
  for (const sta of velibStations) {
    const el = document.getElementById(sta.container);
    if (!el) continue;
    let station = stations.find(s => s.stationcode === sta.code || normalizeString(s.name) === normalizeString(sta.name));
    if (!station) {
      el.innerHTML = `<div class="status warning">Station Vélib’ non trouvée.</div>`;
      continue;
    }
    updateVelibCard(sta.container, {
      name: station.name,
      mechanical: station.mechanical ?? "?",
      ebike: station.ebike ?? "?",
      free_docks: station.numdocksavailable ?? "?",
      status: station.status
    });
  }
}

// --- CARTE VELIB ---
function updateVelibCard(stationId, data) {
  const card = document.getElementById(stationId);
  if (!card) return;
  card.innerHTML = `
    <span class="velib-station-name">${data.name}</span>
    <div style="display: flex; gap: 22px; align-items: center; margin-top: 6px;">
      <span title="Vélos mécaniques">${data.mechanical}</span>
      <span title="Vélos électriques">${data.ebike}</span>
      <span title="Bornes libres">${data.free_docks}</span>
    </div>
    <div style="margin-top:6px; font-size:0.98em;">
      <span style="color:#ffd900;">Total dispo : ${parseInt(data.mechanical) + parseInt(data.ebike)}</span> · 
      <span style="color:${data.status === "OPEN" ? "#0c0" : "#f00"};">${data.status === "OPEN" ? "Ouverte" : "Fermée"}</span>
    </div>
  `;
}

// --- INFO TRAFIC (NOUVEL ENDPOINT) ---
async function fetchNavitiaDisruptions(lineId) {
  const disruptionsUrl = `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/lines/${lineId}/disruptions`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(disruptionsUrl)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    if (data.disruptions && data.disruptions.length > 0) {
      const messages = data.disruptions
        .map(d => d.cause || d.messages?.[0]?.text || d.severity?.effect_name || d.severity?.name || "Perturbation")
        .filter(Boolean);
      return `<div class="status warning" style="margin-top:10px;">🚧 ${messages.join('<br>')}</div>`;
    }
    return `<div class="status">Trafic normal</div>`;
  } catch (e) {
    return `<div class="status warning">Info trafic indisponible</div>`;
  }
}

// --- EXTRACTION HORAIRES DÉBUT / FIN SERVICE (NOUVEL ENDPOINT, AVEC line= OBLIGATOIRE) ---
async function fetchTheoreticalServiceHours(stopAreaId, lineId) {
  const today = new Date().toISOString().split("T")[0].replace(/-/g,"");
  const navitiaUrl = `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/${stopAreaId}/route_schedules?from_datetime=${today}T000000&line=${lineId}`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(navitiaUrl)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    let allTimes = [];
    for (const rs of data.route_schedules || []) {
      for (const row of rs.table?.rows || []) {
        for (const stopTime of row.stop_date_times || []) {
          if (stopTime.arrival_time) allTimes.push(stopTime.arrival_time);
        }
      }
    }
    allTimes = allTimes.sort();
    if (allTimes.length) {
      return {
        start: allTimes[0].slice(0,5),
        end: allTimes[allTimes.length - 1].slice(0,5)
      };
    }
    return null;
  } catch {
    return null;
  }
}

// --- HORLOGE EN TEMPS RÉEL ---
function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById("current-date");
  const timeEl = document.getElementById("current-time");
  if (dateEl) dateEl.textContent = now.toLocaleDateString("fr-FR");
  if (timeEl) timeEl.textContent = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

// --- MISE À JOUR MÉTÉO ---
async function updateWeather() {
  const el = document.getElementById("weather-content");
  if (!el) return;
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true", { cache: "no-store" });
    const data = await res.json();
    const w = data.current_weather;
    el.textContent = `🌤 ${w.temperature}°C · Vent ${w.windspeed} km/h`;
  } catch {
    el.textContent = "🌤 Météo indisponible";
  }
}

// --- ACTUALISATION DE L’HEURE DE MISE À JOUR ---
function updateLastUpdate() {
  const el = document.getElementById("last-update");
  if (el) {
    el.textContent = new Date().toLocaleString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
}

// --- RÉINITIALISATION DES BLOCS ---
function clearAllBlocks() {
  ["bus77-content", "bus201-content", "rer-joinville-content", "velib-breuil", "velib-vincennes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

// --- APPEL GLOBAL DE MISE À JOUR ---
async function refreshAll() {
  clearAllBlocks();
  updateDateTime();
  updateWeather();
  fetchAndDisplayAllVelibStations();

  // RER A Joinville-le-Pont
  const rerContent = document.getElementById("rer-joinville-content");
  if (rerContent) {
    const [disrupt, hours] = await Promise.all([
      fetchNavitiaDisruptions(lineIdMap["rer-joinville-content"]),
      fetchTheoreticalServiceHours(stopAreaIdMap["rer-joinville-content"], lineIdMap["rer-joinville-content"])
    ]);
    rerContent.innerHTML = "";
    if (disrupt) rerContent.innerHTML += disrupt;
    if (hours) rerContent.innerHTML += `<div class="status">Service de ${hours.start} à ${hours.end}</div>`;
  }

  // Bus 77
  const bus77Content = document.getElementById("bus77-content");
  if (bus77Content) {
    const [disrupt, hours] = await Promise.all([
      fetchNavitiaDisruptions(lineIdMap["bus77-content"]),
      fetchTheoreticalServiceHours(stopAreaIdMap["bus77-content"], lineIdMap["bus77-content"])
    ]);
    bus77Content.innerHTML = "";
    if (disrupt) bus77Content.innerHTML += disrupt;
    if (hours) bus77Content.innerHTML += `<div class="status">Service de ${hours.start} à ${hours.end}</div>`;
  }

  // Bus 201
  const bus201Content = document.getElementById("bus201-content");
  if (bus201Content) {
    const [disrupt, hours] = await Promise.all([
      fetchNavitiaDisruptions(lineIdMap["bus201-content"]),
      fetchTheoreticalServiceHours(stopAreaIdMap["bus201-content"], lineIdMap["bus201-content"])
    ]);
    bus201Content.innerHTML = "";
    if (disrupt) bus201Content.innerHTML += disrupt;
    if (hours) bus201Content.innerHTML += `<div class="status">Service de ${hours.start} à ${hours.end}</div>`;
  }

  updateLastUpdate();
}

// --- INIT ---
refreshAll();
setInterval(refreshAll, 60000); // Rafraîchit toutes les 60 secondes
setInterval(updateDateTime, 1000); // Mise à jour de l’horloge chaque seconde
