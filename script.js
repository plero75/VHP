const STOP_POINTS = {
  rer: {
    name: "RER A Joinville-le-Pont",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:43135:",
    icon: "img/picto-rer-a.svg"
  },
  bus77: {
    name: "BUS 77 Hippodrome de Vincennes",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463641:",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "BUS 201 École du Breuil",
    realtimeUrl: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:463644:",
    icon: "img/picto-bus.svg"
  }
};

const VELIB_IDS = {
  vincennes: "1074333296", // stationCode: 12163
  breuil: "508042092"      // stationCode: 12128
};


async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function getDestinationName(d) {
  if (!d) return "Destination inconnue";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d[0]?.value || "Destination inconnue";
  if (typeof d === "object") return d.value || "Destination inconnue";
  return "Destination inconnue";
}

function formatTime(iso, withSeconds = false) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "-";
  const options = withSeconds ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : { hour: "2-digit", minute: "2-digit" };
  return date.toLocaleTimeString("fr-FR", options);
}

function minutesUntil(dateTimeStr) {
  const now = new Date();
  const target = new Date(dateTimeStr);
  const diff = (target - now) / 60000;
  if (isNaN(diff)) return "";
  if (diff < 1.5) return `<span class='imminent'>(passage imminent)</span>`;
  return `<span class='temps'> (${Math.round(diff)} min)</span>`;
}

function renderDepartures(id, title, data, icon) {
  const el = document.getElementById(id);
  if (!el) return;
  let html = `<div class='title-line'><img src='${icon}' class='icon-inline'>${title}</div>`;

  if (!data || data.length === 0) {
    html += `<ul><li>Aucun passage à venir</li></ul>`;
  } else {
    const grouped = {};
    data.forEach(d => {
      const dir = getDestinationName(d.MonitoredVehicleJourney.DirectionName);
      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push(d);
    });

    for (const dir in grouped) {
      html += `<h4 class='direction-title'>Direction ${dir}</h4><ul>`;
      grouped[dir].slice(0, 4).forEach(d => {
        const call = d.MonitoredVehicleJourney.MonitoredCall;
        const expected = call?.ExpectedDepartureTime;
        const aimed = call?.AimedDepartureTime;
        const isLast = d.MonitoredVehicleJourney.FirstOrLastJourney?.value === "LAST_SERVICE_OF_DAY";
        const mvjRef = d.MonitoredVehicleJourney.DatedVehicleJourneyRef;
        const liId = `dep-${mvjRef.replace(/[^a-z0-9]/gi, "")}`;
        html += `<li id="${liId}">
          ▶ ${formatTime(expected)}${minutesUntil(expected)} 
          ${expected !== aimed ? `<span class='delay'>(+${Math.round((new Date(expected) - new Date(aimed)) / 60000)} min)</span>` : ""}
          ${isLast ? "<span class='last-train'>(dernier train)</span>" : ""}
          <div class='defile-arrets'>Chargement...</div>
        </li>`;
      });
      html += "</ul>";
    }
  }

  el.innerHTML = html;

  data.forEach(d => {
    const mvjRef = d.MonitoredVehicleJourney.DatedVehicleJourneyRef;
    const liId = `dep-${mvjRef.replace(/[^a-z0-9]/gi, "")}`;
    const li = document.getElementById(liId);
    if (li) injectStopsDynamically(mvjRef, li);
  });
}

async function fetchTransport(stopKey, elementId) {
  try {
    const data = await fetchJSON(STOP_POINTS[stopKey].realtimeUrl);
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    renderDepartures(elementId, STOP_POINTS[stopKey].name, visits, STOP_POINTS[stopKey].icon);
  } catch (e) {
    console.error(`Erreur ${stopKey}`, e);
    document.getElementById(elementId).innerHTML =
      `<div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div><div class='error'>Données indisponibles</div>`;
  }
}

async function fetchStopsForVehicleJourney(vehicleJourneyRef) {
  const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
  const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/vehicle-journeys/${vehicleJourneyRef}/stop_points`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Échec requête vehicle-journey stop_points");
    const data = await res.json();
    return data?.stop_points?.map(p => p.name) || [];
  } catch (e) {
    console.warn("Fallback GTFS utilisé", e);
    return [];
  }
}

function injectStopsDynamically(mvjRef, liElement) {
  fetchStopsForVehicleJourney(mvjRef).then(stopList => {
    const html = stopList.length ? stopList.join(" – ") : "Liste non disponible";
    const div = liElement.querySelector(".defile-arrets");
    if (div) div.innerHTML = html;
  });
}

async function fetchVelib(stationId, elementId) {
  try {
    const url = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";
    const data = await fetchJSON(url);
    const station = data.data.stations.find(s => s.station_id == stationId);

    if (!station) throw new Error("Station non trouvée");

    const mechanical = station.num_bikes_available_types?.find(t => t.mechanical !== undefined)?.mechanical || 0;
    const ebike = station.num_bikes_available_types?.find(t => t.ebike !== undefined)?.ebike || 0;
    const docks = station.num_docks_available || 0;
    const isOpen = station.is_installed && station.is_renting && station.is_returning;

    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      🚲 Mécaniques : ${mechanical}<br>
      ⚡ Électriques : ${ebike}<br>
      🅿️ Places libres : ${docks}<br>
      ${isOpen ? "✅ Station : ouverte" : "⛔ Station fermée"}
    `;
  } catch (e) {
    console.error("Erreur Vélib :", e);
    document.getElementById(elementId).innerHTML = `
      <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
      ⚠️ Données Vélib' indisponibles
    `;
  }
}


async function fetchWeather() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=48.82&longitude=2.44&current_weather=true";
    const data = await fetchJSON(url);
    const w = data.current_weather;
    document.getElementById("weather-content").innerHTML = `
      <div class="title-line"><img src="img/picto-meteo.svg" class="icon-inline">Météo</div>
      🌡️ Température : <b>${w.temperature}°C</b><br>
      ☀️ Code météo : ${w.weathercode}<br>
      💨 Vent : ${w.windspeed} km/h`;
  } catch (e) {
    document.getElementById("weather-content").innerHTML = "<b>Météo indisponible</b>";
  }
}

async function fetchTrafficRoad() {
  try {
    const url = "https://data.cerema.fr/api/records/1.0/search/?dataset=etat-trafic-rn&rows=50&refine.zone_nom=Île-de-France";
    const data = await fetchJSON(url);
    const routes = data.records
      .filter(r => ["A86", "BP"].includes(r.fields.route_nom))
      .map(r => `<div><span style="color:${r.fields.couleur}">●</span> ${r.fields.libelle_troncon} : ${r.fields.etat_trafic}</div>`)
      .join("");
    document.getElementById("trafic-road").innerHTML = `<div class='title-line'><img src='img/picto-car.svg' class='icon-inline'>Trafic routier</div>${routes}`;
  } catch (e) {
    document.getElementById("trafic-road").innerHTML = "<b>Trafic routier indisponible</b>";
  }
}

function refreshAll() {
  fetchSchedulesOncePerDay();
  fetchTransport("rer", "rer-content");
  fetchTransport("bus77", "bus77-content");
  fetchTransport("bus201", "bus201-content");
  fetchVelib(VELIB_IDS.vincennes, "velib-vincennes");
  fetchVelib(VELIB_IDS.breuil, "velib-breuil");
  fetchWeather();
  fetchTrafficRoad();
}

setInterval(refreshAll, 60000);
refreshAll();



async function fetchSchedulesOncePerDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("schedule-day") === today) return;

  for (let key in STOP_POINTS) {
    if (!STOP_POINTS[key].scheduleUrl) continue;
    const url = STOP_POINTS[key].scheduleUrl + today.replace(/-/g, "") + "T000000";
    try {
      const data = await fetchJSON(url);
      const rows = data.route_schedules?.[0]?.table?.rows || [];
      const times = [];
      rows.forEach(row => {
        row.stop_date_times?.forEach(sdt => {
          if (sdt.departure_time) times.push(sdt.departure_time);
        });
      });
      times.sort();
      if (times.length) {
        const fmt = t => `${t.slice(0, 2)}:${t.slice(2, 4)}`;
        localStorage.setItem(`${key}-first`, fmt(times[0]));
        localStorage.setItem(`${key}-last`, fmt(times[times.length - 1]));
      }
    } catch (e) {
      console.error(`Erreur horaires ${key}`, e);
    }
  }
  localStorage.setItem("schedule-day", today);
}
