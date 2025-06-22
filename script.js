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
    directionRef: null // Remplir ex: "IDFM:Direction:3-C"
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
    message?alertEl.innerHTML=decodeEntities(message)&amp;&amp;alertEl.classList.remove("hidden"):alertEl.classList.add("hidden");
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
    const message=disruptionsData.map(d=>d.messages[0]?.text).join("<br>");
    const disruptions=disruptionsData.map(d=>({lineId:d.line_id,messages:d.messages,affected:d.affectedStopPoints||[]}));

    // Intégration arrêts affectés
    const enrichedMsg=disruptionsData.map(d=>{
      const txt=d.messages[0]?.text||'';
      const stops=Array.isArray(d.affectedStopPoints)?d.affectedStopPoints.map(s=>s.name||s).join(', '):'';
      return stops?`${txt} (Arrêts : ${stops})`:txt;
    }).join("<br>");

    renderDepartures(
      containerId,
      cfg.name,
      visits,
      cfg.icon,
      localStorage.getItem(`${key}-first`)||"-",
      localStorage.getItem(`${key}-last`)||"-",
      enrichedMsg,
      key==="rer",
      disruptions
    );

  } catch(err) {
    console.error("Erreur sur " + key, err);
    document.getElementById(containerId).innerHTML=`<div class="title-line"><img src="${STOP_POINTS[key].icon}" class="icon-inline">${STOP_POINTS[key].name}</div><div class="error">Données indisponibles</div>`;
  }
}

async function fetchVelib(stationId, containerId) {
  try {
    const proxy="https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
    const url=proxy+"https://prim.iledefrance-mobilites.fr/marketplace/velib/station_status.json";
    const data=await fetchJSON(url);
    const station=data.data.stations.find(s=>s.station_id==stationId);
    if(!station) throw Error("Station non trouvée");
    const mech=station.num_bikes_available_types.find(b=>b.ebike===0)?.bikes||0;
    const elec=station.num_bikes_available_types.find(b=>b.ebike===1)?.bikes||0;
    const free=station.num_docks_available;
    document.getElementById(containerId).innerHTML=`<div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div><div class="velib-stats"><div class="velib-mechanical"><span class="velib-icon">🚲</span><span class="velib-count">${mech}</span><span class="velib-label">Mécaniques</span></div><div class="velib-electric"><span class="velib-icon">⚡</span><span class="velib-count">${elec}</span><span class="velib-label">Électriques</span></div><div class="velib-free"><span class="velib-icon">🅿️</span><span class="velib-count">${free}</span><span class="velib-label">Places libres</span></div></div>`;
  } catch(e){
    console.error("Erreur Vélib",e);
    document.getElementById(containerId).innerHTML=`<div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div><div class='error'>Erreur chargement</div>`;
  }
}

async function fetchScheduleOncePerDay(){
  const today=new Date().toISOString().split("T")[0];
  if(localStorage.getItem("schedule-day")===today) return;
  for(const key in STOP_POINTS){
    try{
      const param=today.replace(/-/g,"")+"T000000";
      const data=await fetchJSON(STOP_POINTS[key].scheduleUrl+param);
      const times=(data.route_schedules?.[0]?.table?.rows||[])
        .flatMap(r=>r.date_times?.map(d=>d.departure_date_time.slice(9,13))||[]);
      if(times.length){
        const sorted=times.sort();
        const fmt=t=>`${t.slice(0,2)}:${t.slice(2)}`;
        localStorage.setItem(`${key}-first`,fmt(sorted[0]));
        localStorage.setItem(`${key}-last`,fmt(sorted[sorted.length-1]));
      }
    }catch(e){console.error("Erreur schedule "+key,e)}
  }
  localStorage.setItem("schedule-day",today);
}

function refreshAll(){
  updateDateTime();
  fetchScheduleOncePerDay();
  fetchTransportBlock("rer","rer-content");
  fetchTransportBlock("bus77","bus77-content");
  fetchTransportBlock("bus201","bus201-content");
  fetchVelib(VELIB_IDS.vincennes,"velib-vincennes");
  fetchVelib(VELIB_IDS.breuil,"velib-breuil");
}
setInterval(refreshAll,60000);
refreshAll();
