(() => {
  const C = window.CONFIG;
  const q = sel => document.querySelector(sel);
  const cacheBuster = () => { const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}`; };

  // Utils
  const fmtTime = d => d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
  const parseISO = s => new Date(s);
  const now = () => new Date();
  const minDiff = (a,b) => Math.round((a-b)/60000);

  // --- helper: transforme objets/arrays SIRI en libellé
  function asLabel(v){
    if (!v) return '';
    if (Array.isArray(v)) return asLabel(v[0]);
    if (typeof v === 'object') return asLabel(v.value || v.text || v.name || v.$ || v.label || v.id);
    return String(v);
  }

  const setTS = (id) => { const el = q(id); if (el) el.textContent = 'MAJ ' + fmtTime(now()); };

  const safeFetch = async (url) => {
  try {
    const full = C.PROXY + encodeURIComponent(url);
    const resp = await fetch(full);
    if (!resp.ok) throw new Error(resp.status + " " + resp.statusText);
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json') || ct.includes('application/vnd.geo+json')) return await resp.json();
    return await resp.text();
  } catch (e) {
    console.error("fetch error:", url, e);
    return null;
  }
}

function renderCarousel(news) {
  const container = document.getElementById("news-ticker");
  let index = 0;

  function showNext() {
    const n = news[index];
    container.innerHTML = `
      <div class="news-item">
        <h4>${n.title}</h4>
        <p>${n.desc}</p>
      </div>
    `;
    index = (index + 1) % news.length;
  }

  showNext();
  setInterval(showNext, 15000); // toutes les 15 secondes
}

  // ---- Velib (GBFS Smovengo)
  async function loadVelib() {
    const d2 = await safeFetch('https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json');
    if (d2 && d2.data && d2.data.stations) renderVelibStations(d2.data.stations);
  }
  function renderVelibStations(stations){
    const renderOne = (target, cfg) => {
      const s = stations.find(x => String(x.station_id) === (cfg.station_id ?? cfg.id));
      if (!s) { q(target).textContent = `${cfg.label}: —`; return; }
      const bikes = s.num_bikes_available, docks = s.num_docks_available;
      const cls = bikesRatioCls(bikes, docks);
      q(target).innerHTML = `<strong>${cfg.label}</strong>: <span class="${cls}">${bikes} vélos</span> • ${docks} places libres`;
    };
    renderOne('#velib-vincennes', C.VELIB.VINCENNES);
    renderOne('#velib-breuil', C.VELIB.BREUIL);
  }
  function bikesRatioCls(bikes, docks){
    const total = bikes + docks; if (!total) return '';
    const r = bikes/total;
    if (r > .6) return 'ok';
    if (r > .3) return 'warn';
    return 'danger';
  }

  // ---- Stop-Monitoring (SIRI)
  async const _firstLastCache = {};
  async function getFirstLast(stopArea, lineRef){
    const key = stopArea + '|' + lineRef;
    if (_firstLastCache[key]) return _firstLastCache[key];
    try{
      const resp = await fetch(`./data/first_last.json?v=${cacheBuster()}`);
      if (!resp.ok) return null;
      const json = await resp.json();
      const val = (json?.[stopArea]?.[lineRef]) || null;
      _firstLastCache[key] = val;
      return val;
    }catch(e){ return null; }
  }

  function loadStop(moduleId, monitoringRef){
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}`;
    const data = await safeFetch(url);
    if (!data) return;
    const visits = (((data||{}).Siri||{}).ServiceDelivery||{}).StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const enriched = visits.map(v => enrichVisit(v)).filter(Boolean);

    // Split by DirectionRef / Destination
    const groups = {};
    for (const it of enriched) {
      const dest = asLabel(it.DestinationName) || 'NA';
      const key = `${it.DirectionRef || 'NA'}|${dest}`;
      (groups[key] ||= []).push(it);
    }
    Object.values(groups).forEach(arr => arr.sort((a,b)=> a.when - b.when));

    const keys = Object.keys(groups).slice(0,2);
    const [A,B] = [keys[0], keys[1]];
    // fetch served stops for the next train/bus per direction
    if (groups[A] && groups[A][0] && groups[A][0].vehicleJourneyId) {
      const namesA = await fetchVehicleJourney(groups[A][0].vehicleJourneyId);
      if (namesA && namesA.length) groups[A][0].calls = namesA.join(' • ');
    }
    if (groups[B] && groups[B][0] && groups[B][0].vehicleJourneyId) {
      const namesB = await fetchVehicleJourney(groups[B][0].vehicleJourneyId);
      if (namesB && namesB.length) groups[B][0].calls = namesB.join(' • ');
    }
    renderTrips(`${moduleId}-list-A`, groups[A]);
    renderTrips(`${moduleId}-list-B`, groups[B]);

    q(`#${moduleId}-dirA`).textContent = asLabel(groups[A]?.[0]?.DestinationName) || 'Direction A';
    q(`#${moduleId}-dirB`).textContent = asLabel(groups[B]?.[0]?.DestinationName) || 'Direction B';
    setTS(`#${moduleId}-ts`);
  }

  function enrichVisit(v){
    try{
      const mvj  = v.MonitoredVehicleJourney || {};
      const call = mvj.MonitoredCall || {};
      const vjId = (mvj.FramedVehicleJourneyRef && (mvj.FramedVehicleJourneyRef.DatedVehicleJourneyRef || mvj.FramedVehicleJourneyRef.DatedVehicleJourney)) || mvj.VehicleJourneyRef || mvj.BlockRef || null;
      const aimed    = parseISO(call.AimedDepartureTime || call.AimedArrivalTime || call.AimedQuayTime || v.RecordedAtTime);
      const expected = parseISO(call.ExpectedDepartureTime || call.ExpectedArrivalTime || call.ExpectedQuayTime || call.AimedDepartureTime);
      const delay = minDiff(expected, aimed);
      const when  = expected;

      const dest =
        asLabel(mvj.DestinationName) ||
        asLabel(call.DestinationDisplay) ||
        asLabel(mvj.DirectionName) || '';

      const dirRef = asLabel(mvj.DirectionRef) || asLabel(mvj.DirectionName) || dest;

      const oc = (mvj?.OnwardCalls?.OnwardCall || [])
        .map(c => asLabel(c.StopPointName)).filter(Boolean).join(' · ');

      const cancelled =
        mvj?.Operational?.Monitored === false ||
        mvj?.ProgressStatus === 'cancelled' ||
        mvj?.Status === 'cancelled';

      return {
        DestinationName: dest,
        DirectionRef: dirRef,
        when, aimed, expected, delay, cancelled, calls: oc
      };
    }catch(e){ return null; }
  }

  function renderTrips(targetId, arr){
    const ul = q('#' + targetId);
    if (!ul) return;
    ul.innerHTML = '';
    let first = true;
    const items = (arr||[]).slice(0,4).map(x => {
      const mins = Math.max(0, minDiff(x.when, now()));
      const imminent = mins < 2;
      const time = fmtTime(x.when);
      const delay = x.delay>0 ? `<span class="delay">+${x.delay}′</span>` : '';
      const aimed = x.delay>0 ? `<span class="strike">${fmtTime(x.aimed)}</span>` : '';

      // Dernier passage (théorique) via first_last.json
      let lastBadge = '';
      try{
        const stopArea = monitoringRef;
        const lineRef  = (moduleId==='rerA' ? C.LINES.RER_A : (moduleId==='bus77' ? C.LINES.BUS_77 : C.LINES.BUS_201));
        const ff = _firstLastCache[stopArea + '|' + lineRef];
        if (ff){
          const hm = fmtTime(x.aimed);
          if (hm === ff.dirA_last || hm === ff.dirB_last){
            lastBadge = `<span class="badge last">dernier</span>`;
          }
        }
      }catch(e){}

      const badge = x.cancelled ? `<span class="badge cancel">supprimé</span>`
                   : (lastBadge || (imminent ? `<span class="badge imminent">imminent</span>` : ''));
      const calls = (first && x.calls) ? `<small class="calls">${x.calls}</small>` : '';
      first = false;
      return `<li class="trip">
        <span class="time">${time}</span>
        <span class="meta">${aimed}${delay}${badge}</span>
      </li>${calls}`;
    }).join('');
    ul.innerHTML = items || `<li class="trip"><span>Aucun passage</span><span class="badge theory">mode théorique</span></li>`;
  }

  
  // ---- Vehicle Journeys (to list served stops for the NEXT train per direction)
  async function fetchVehicleJourney(vjId) {
    if (!vjId) return null;
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/vehicle_journeys/${encodeURIComponent(vjId)}`;
    const data = await safeFetch(url);
    if (!data) return null;
    try {
      // Try to normalize known payload shapes
      const sj = (data.vehicle_journey || data) ;
      const times = sj.stop_times || sj.StopTimes || [];
      const names = times.map(t => asLabel(t.stop_name || t.StopPointName || t.name)).filter(Boolean);
      return names;
    } catch(e){ console.warn("vehicle_journey parse error", e); return null; }
  }

  // ---- Traffic disruptions (PRIM general-message)
  async async function loadTraffic(targetId, lineRefs=[]) {
  try{
    let base = "https://prim.iledefrance-mobilites.fr/marketplace/general-message";
    if (lineRefs && lineRefs.length){
      const qs = lineRefs.map(l => "line=" + encodeURIComponent(l)).join("&");
      base = base + "?" + qs;
    }
    const data = await safeFetch(base);
    const messages = (data?.messages || data?.generalMessages || data) || [];
    const relevant = Array.isArray(messages) ? messages.filter(m => {
      const lr = JSON.stringify(m).toLowerCase();
      return lineRefs.length ? lineRefs.some(x => lr.includes(String(x).toLowerCase())) : true;
    }) : [];
    const html = relevant.slice(0,3).map(m => {
      const txt = (m?.message?.text || m?.title || m?.summary || "Perturbation");
      return `<div>⚠️ ${txt}</div>`;
    }).join('') || '<div>Aucune perturbation signalée</div>';
    const el = document.querySelector(`#${targetId}`);
    if (el) el.innerHTML = html;
  }catch(e){
    const el = document.querySelector(`#${targetId}`);
    if (el) el.innerHTML = '<div>Aucune perturbation signalée</div>';
  }
})();
