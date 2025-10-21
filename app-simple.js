// Version simplifiée et robuste pour VHP3
const CONFIG = window.CONFIG;
const $ = (sel) => document.querySelector(sel);

let newsIndex = 0;
let newsData = [
  { title: "RER A : Trafic normal", description: "Circulation fluide" },
  { title: "Bus 77 : Nouveaux horaires", description: "Renforts en soirée" },
  { title: "Vélib' disponible", description: "Stations rechargées" },
  { title: "Météo clémente", description: "Conditions favorables" }
];

// Utilitaires
function updateClock() {
  const el = $("#clock");
  if (el) el.textContent = new Date().toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"});
}

function updateDateTime() {
  const el = $("#datetime");
  if (el) el.textContent = new Date().toLocaleString("fr-FR");
}

function setLastUpdate() {
  const el = $("#lastUpdate");
  if (el) el.textContent = "MAJ " + new Date().toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"});
}

// Fetch sécurisé
async function safeFetch(url, options = {}) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      ...options
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (e) {
    console.warn(`Fetch failed: ${url.substring(0, 60)}...`, e.message);
    return null;
  }
}

// Fetch PRIM avec mode direct/proxy
async function fetchPRIM(endpoint, params = {}) {
  let url;
  let options = {};
  
  if (CONFIG.PRIM?.APIKEY) {
    // Mode direct avec clé API
    url = new URL(endpoint, CONFIG.PRIM.BASE);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    options.headers = { 'apikey': CONFIG.PRIM.APIKEY };
  } else {
    // Mode proxy (fallback)
    url = new URL(endpoint, "https://prim.iledefrance-mobilites.fr/marketplace");
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url = CONFIG.PROXY + encodeURIComponent(url.toString());
  }
  
  const response = await safeFetch(url.toString(), options);
  return response ? response.json() : null;
}

// Parseur de données transport
function parseTransport(data) {
  const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
  return visits.map(v => {
    const journey = v.MonitoredVehicleJourney || {};
    const call = journey.MonitoredCall || {};
    const departure = call.ExpectedDepartureTime;
    let minutes = null;
    if (departure) {
      minutes = Math.max(0, Math.round((new Date(departure).getTime() - Date.now()) / 60000));
    }
    return {
      destination: journey.DestinationName?.[0]?.value || "?",
      line: (journey.LineRef?.value || "").replace(/.*:/, ""),
      minutes: minutes,
      valid: minutes !== null
    };
  }).filter(t => t.valid);
}

// Rendu des horaires
function renderSchedule(containerId, trips, emptyMessage = "Aucun passage prévu") {
  const container = $(containerId);
  if (!container) return;
  
  container.innerHTML = "";
  
  if (!trips || trips.length === 0) {
    container.innerHTML = `<li style="color: #999; padding: 10px;">${emptyMessage}</li>`;
    return;
  }
  
  // Grouper par destination
  const destinations = {};
  trips.forEach(trip => {
    if (!destinations[trip.destination]) {
      destinations[trip.destination] = [];
    }
    destinations[trip.destination].push(trip.minutes);
  });
  
  // Afficher chaque destination
  Object.entries(destinations).slice(0, 4).forEach(([dest, times]) => {
    times.sort((a, b) => a - b);
    const item = document.createElement("li");
    item.className = "trip";
    
    const info = document.createElement("div");
    info.innerHTML = `<strong>${dest}</strong>`;
    
    const timeContainer = document.createElement("div");
    timeContainer.className = "times";
    
    times.slice(0, 3).forEach(minutes => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = minutes + "min";
      if (minutes <= 1) chip.style.backgroundColor = "var(--ok)";
      timeContainer.appendChild(chip);
    });
    
    item.appendChild(info);
    item.appendChild(timeContainer);
    container.appendChild(item);
  });
}

// Météo
async function updateWeather() {
  const el = $("#weather");
  if (!el) return;
  
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.COORDS.lat}&longitude=${CONFIG.COORDS.lon}&current_weather=true`;
    const response = await safeFetch(url);
    
    if (response) {
      const data = await response.json();
      if (data.current_weather) {
        const temp = Math.round(data.current_weather.temperature);
        const wind = data.current_weather.windspeed;
        el.textContent = `🌡️ ${temp}°C — Vent ${wind} km/h`;
        return;
      }
    }
  } catch (e) {
    console.warn("Météo error:", e);
  }
  
  el.textContent = "🌦️ Météo indisponible";
}

// News
function updateNews() {
  const container = $("#news-content");
  const counter = $("#news-counter");
  
  if (!container) return;
  
  if (container.children.length === 0) {
    // Première initialisation
    newsData.forEach((item, i) => {
      const div = document.createElement("div");
      div.className = "news-item" + (i === 0 ? " active" : "");
      div.innerHTML = `<h4>${item.title}</h4><p>${item.description}</p>`;
      container.appendChild(div);
    });
  }
  
  // Rotation
  document.querySelector(".news-item.active")?.classList.remove("active");
  newsIndex = (newsIndex + 1) % newsData.length;
  const items = document.querySelectorAll(".news-item");
  if (items[newsIndex]) items[newsIndex].classList.add("active");
  
  if (counter) counter.textContent = `${newsIndex + 1}/${newsData.length}`;
}

// Vélib
async function updateVelib() {
  const container = $("#velib-list");
  if (!container) return;
  
  container.innerHTML = "<div>Chargement Vélib...</div>";
  
  try {
    const data = await fetchPRIM('/v2/navitia/coverage/fr-idf/equipment/poi_types/amenity:bicycle_rental/pois', {
      distance: '2000',
      coord: '48.8350;2.4400'
    });
    
    if (data?.pois) {
      container.innerHTML = "";
      let found = 0;
      
      data.pois.forEach(poi => {
        const name = poi.name || "";
        if ((name.match(/hippodrome|vincennes|breuil|école/i)) && found < 3) {
          const props = poi.properties || {};
          const div = document.createElement("div");
          div.style.marginBottom = "10px";
          div.innerHTML = `
            <div style="font-weight: bold;">${name.substring(0, 30)}</div>
            <div style="font-size: 12px; color: #ccc;">
              🚲 ${parseInt(props.available_bikes) || 0} vélos • 
              ⚡ ${parseInt(props.available_ebikes) || 0} électriques • 
              📍 ${parseInt(props.available_bike_stands) || 0} places
            </div>
          `;
          container.appendChild(div);
          found++;
        }
      });
      
      if (found === 0) {
        container.innerHTML = '<div style="color: #999;">Aucune station Vélib trouvée</div>';
      }
    } else {
      container.innerHTML = '<div style="color: #f44;">Vélib indisponible</div>';
    }
  } catch (e) {
    console.warn("Vélib error:", e);
    container.innerHTML = '<div style="color: #f44;">Vélib indisponible</div>';
  }
}

// Courses (données statiques pour l'instant)
function updateRaces() {
  const container = $("#courses-list");
  if (!container) return;
  
  const races = [
    { heure: "14:30", nom: "Prix de Vincennes", distance: "2100m", discipline: "Attelé", dotation: "18k€" },
    { heure: "15:05", nom: "Prix du Bois", distance: "2700m", discipline: "Monté", dotation: "22k€" },
    { heure: "15:40", nom: "Prix de l'Hippodrome", distance: "2100m", discipline: "Attelé", dotation: "16k€" }
  ];
  
  container.innerHTML = "";
  races.forEach(race => {
    const div = document.createElement("div");
    div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #333;";
    div.innerHTML = `
      <div>
        <div style="font-weight: bold;">${race.heure} - ${race.nom}</div>
        <div style="font-size: 12px; color: #ccc;">${race.distance} • ${race.discipline}</div>
      </div>
      <div style="font-weight: bold; color: var(--accent);">${race.dotation}</div>
    `;
    container.appendChild(div);
  });
}

// Fonction principale de mise à jour
async function refresh() {
  console.log("🔄 Refresh");
  
  try {
    // Transport en parallèle
    const [rerData, bus77Data, bus201Data] = await Promise.all([
      fetchPRIM('stop-monitoring', { MonitoringRef: CONFIG.STOPS.RER_A_JOINVILLE }),
      fetchPRIM('stop-monitoring', { MonitoringRef: CONFIG.STOPS.BUS_77_HIPPODROME }),
      fetchPRIM('stop-monitoring', { MonitoringRef: CONFIG.STOPS.BUS_201_BREUIL })
    ]);
    
    // RER A
    if (rerData) {
      const trips = parseTransport(rerData);
      const toParis = trips.filter(t => /paris|défense|châtelet|auber/i.test(t.destination));
      const toBoissy = trips.filter(t => /boissy|marne|val|torcy/i.test(t.destination));
      
      renderSchedule("#rer-paris", toParis, "Aucun RER vers Paris");
      renderSchedule("#rer-boissy", toBoissy, "Aucun RER vers Boissy");
    } else {
      renderSchedule("#rer-paris", [], "RER A indisponible");
      renderSchedule("#rer-boissy", [], "RER A indisponible");
    }
    
    // Bus
    renderSchedule("#bus-hippodrome-list", bus77Data ? parseTransport(bus77Data) : [], "Bus 77 indisponible");
    renderSchedule("#bus-breuil-list", bus201Data ? parseTransport(bus201Data) : [], "Bus 201 indisponible");
    
    // Autres données
    await updateWeather();
    updateVelib();
    updateRaces();
    
  } catch (e) {
    console.error("Refresh error:", e);
  }
  
  setLastUpdate();
}

// Initialisation
setInterval(updateClock, 1000);
setInterval(updateDateTime, 30000);
setInterval(updateNews, 15000);
setInterval(refresh, CONFIG.REFRESH_MS?.STOP_MONITORING || 30000);

// Démarrage
updateClock();
updateDateTime();
updateNews();
refresh();