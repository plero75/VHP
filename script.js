// === DASHBOARD TEMPS RÉEL VINCENNES ===

// --- CONFIG PROXY ---
const PROXY_URL = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/';

// --- Liste des stations Vélib à surveiller ---
const velibStations = [
  { code: "12163", container: "velib-vincennes", name: "Vincennes - République" },
  { code: "12128", container: "velib-breuil", name: "Château de Vincennes - Breuil" }
];

// --- Map des stop_area_id Navitia pour horaires théoriques ---
const stopAreaIdMap = {
  'rer-content': 'stop_area:IDFM:43135',
  'bus77-content': 'stop_area:IDFM:463641',
  'bus201-content': 'stop_area:IDFM:463644',
};

// --- Map des line_id Navitia pour disruptions ---
const lineIdMap = {
  'rer-content': 'line:IDFM:C01742',
  'bus77-content': 'line:IDFM:C01777',
  'bus201-content': 'line:IDFM:C01201',
};

// --- Normalisation de chaînes ---
function normalizeString(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getValue(val) {
  if (Array.isArray(val)) return getValue(val[0]);
  if (typeof val === "object" && val !== null) {
    if ("value" in val) return val.value;
    if ("Name" in val) return val.Name;
    if ("label" in val) return val.label;
    const keys = Object.keys(val);
    if (keys.length === 1) return getValue(val[keys[0]]);
    return JSON.stringify(val);
  }
  return val ?? "";
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
  const disruptionsUrl = `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/${lineId}/line_reports`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(disruptionsUrl)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    if (data.line_reports && data.line_reports.length > 0) {
      const messages = data.line_reports
        .map(report => {
          const disruption = report.disruption || {};
          return disruption.messages?.[0]?.text || disruption.cause || disruption.severity?.effect_name || "Perturbation";
        })
        .filter(Boolean);
      return `<div class="status warning" style="margin-top:10px;">🚧 ${messages.join('<br>')}</div>`;
    }
    return `<div class="status">Trafic normal</div>`;
  } catch (e) {
    return `<div class="status warning">Info trafic indisponible</div>`;
  }
}

// --- EXTRACTION HORAIRES DÉBUT / FIN SERVICE ---
async function fetchTheoreticalServiceHours(stopAreaId) {
  const today = new Date().toISOString().split("T")[0].replace(/-/g,"");
  const navitiaUrl = `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/coverage/fr-idf/stop_areas/${stopAreaId}/route_schedules?from_datetime=${today}T000000`;
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
