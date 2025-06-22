// Décodage d'entités HTML
tĥfunction decodeEntities(encoded) {
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
    directionRef: null // Remplir pour filtrer un seul sens (ex: "IDFM:Direction:3-C")
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
  const el = document.getElementById(id);
  let iconsHtml = '';
  if (disruptions.length) {
    disruptions.slice(0, 4).forEach(d => {
      iconsHtml += `<img src="img/picto-${d.lineId}.svg" class="perturb-icon" title="${decodeEntities(d.messages[0]?.text||'')}">`;
    });
    if (disruptions.length > 4) iconsHtml += `<div class="perturb-more">+${disruptions.length - 4}</div>`;
  }
  let html = `<div class="title-line"><img src="${icon}" class="icon-inline">${name}</div>`;
  html += `<div class="perturb-header">${iconsHtml}</div><ul>`;
  visits.forEach(d => {
    const call = d.MonitoredVehicleJourney.MonitoredCall;
    html += `<li>▶ ${formatTime(call.AimedDepartureTime||call.ExpectedDepartureTime)} → ${getDestination(d.MonitoredVehicleJourney.DestinationName)}</li>`;
  });
  html += `</ul><div class="schedule-extremes">Premier départ : ${first}<br>Dernier départ : ${last}</div>`;
  html += `<div class="perturb-panel">${message?decodeEntities(message):'Pas de message'}</div>`;
  el.innerHTML = html;
  if (isRer) {
    const alertEl = document.getElementById("traffic-alert");
    if (message) { alertEl.innerHTML = decodeEntities(message); alertEl.classList.remove("hidden"); }
    else { alertEl.classList.add("hidden"); }
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  return res.json();
}

async function fetchTransportBlock(key, containerId) {
  try {
    const [realtime, traffic] = await Promise.all([
      fetchJSON(STOP_POINTS[key].realtimeUrl),
      fetchJSON(STOP_POINTS[key].trafficUrl)
    ]);
    let visits = realtime.Siri.ServiceDelivery[0].StopMonitoringDelivery[0].MonitoredStopVisit||[];
    console.log('Directions dispo', key, [...new Set(visits.map(v=>v.MonitoredVehicleJourney.DirectionRef))]);
    const cfg=STOP_POINTS[key];
    if(cfg.directionRef) visits=visits.filter(v=>v.MonitoredVehicleJourney.DirectionRef===cfg.directionRef);
    const disruptionsData=traffic.disruptions||[];
    const messageData=disruptionsData.map(d=>d.messages[0]?.text);
    const enrichedMsg=disruptionsData.map(d=>{
      const txt=d.messages[0]?.text||'';
      const stops=Array.isArray(d.affectedStopPoints)?d.affectedStopPoints.map(s=>s.name||s).join(', '):'';
      return stops?`${txt} (Arrêts : ${stops})`:txt;
    }).join("<br>");
    const disruptions=disruptionsData.map(d=>({lineId:d.line_id,messages:d.messages}));
    renderDepartures(
      containerId,
      cfg.name,
      visits,
      cfg.icon,
      localStorage.getItem(`${key}-first`)||"-",
      localStorage.getItem(`${key}-last`)||"-",
      enrichedMsg,
      key==="rer",
