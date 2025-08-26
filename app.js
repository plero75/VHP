(() => {
  const C = window.CONFIG;
  const q = sel => document.querySelector(sel);

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
      const resp = await fetch(C.PROXY + encodeURI(url));
      if (!resp.ok) throw new Error(resp.status + " " + resp.statusText);
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json') || ct.includes('application/vnd.geo+json')) return await resp.json();
      return await resp.text();
    } catch (e) {
      console.error("fetch error:", url, e);
      return null;
    }
  };

  // ---- Weather (Open-Meteo)
  async function loadWeather() {
    const url = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=${C.COORDS.lat}&longitude=${C.COORDS.lon}`
      + `&current_weather=true&hourly=temperature_2m,weathercode`
      + `&timezone=Europe%2FParis`;
    const data = await safeFetch(url);
    if (!data) return;
    const cur = data.current_weather;
    const icon = weatherIcon(cur.weathercode);
    q('#weather').textContent = `🌦 ${Math.round(cur.temperature)}°C • ${icon} • ${fmtTime(now())}`;
  }
  function weatherIcon(code){
    if ([0].includes(code)) return 'Ensoleillé';
    if ([1,2,3].includes(code)) return 'Nuageux';
    if ([45,48].includes(code)) return 'Brouillard';
    if ([51,53,55,61,63,65].includes(code)) return 'Pluie';
    if ([71,73,75].includes(code)) return 'Neige';
    return 'Temps variable';
  }

  // ---- News RSS
  async function loadNews(){
    const txt = await safeFetch('https://www.francetvinfo.fr/titres.rss');
    if (!txt) return;
    const doc = new DOMParser().parseFromString(txt, "text/xml");
    const items = Array.from(doc.querySelectorAll('item')).slice(0, 8);
    const titles = items.map(i => i.querySelector('title')?.textContent.trim()).filter(Boolean);
    const line = titles.join('  •  ');
    q('#news-ticker').innerHTML = `<span>${line}</span>`;
  }

  // ---- Velib (GBFS Smovengo)
  async function loadVelib() {
    const d2 = await safeFetch('https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json');
    if (d2 && d2.data && d2.data.stations) renderVelibStations(d2.data.stations);
  }
  function renderVelibStations(stations){
    const renderOne = (target, cfg) => {
      const s = stations.find(x => String(x.station_id) === String(cfg.station_id));
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
  async function loadStop(moduleId, monitoringRef){
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${encodeURIComponent(monitoringRef)}`;
    const data = await safeFetch(url);
    if (!data) return;
    const visits = (((data||{}).Siri||{}).ServiceDelivery||{}).StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const enriched = visits.map(v => enrichVisit(v)).filter(Boolean);

    // Split by DirectionRef / Destination
    const groups = {};
    for (const it of enriched) {
      const key = it.DirectionRef || 'NA';
      (groups[key] ||= []).push(it);
    }
    Object.values(groups).forEach(arr => arr.sort((a,b)=> a.when - b.when));

    const keys = Object.keys(groups).slice(0,2);
    const [A,B] = [keys[0], keys[1]];
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
    const items = (arr||[]).slice(0,4).map(x => {
      const mins = Math.max(0, minDiff(x.when, now()));
      const imminent = mins < 2;
      const time = fmtTime(x.when);
      const delay = x.delay>0 ? `<span class="delay">+${x.delay}′</span>` : '';
      const aimed = x.delay>0 ? `<span class="strike">${fmtTime(x.aimed)}</span>` : '';
      const badge = x.cancelled ? `<span class="badge cancel">supprimé</span>`
                   : imminent ? `<span class="badge imminent">imminent</span>` : '';
      const calls = x.calls ? `<small class="calls">${x.calls}</small>` : '';
      return `<li class="trip">
        <span class="time">${time}</span>
        <span class="meta">${aimed}${delay}${badge}</span>
      </li>${calls}`;
    }).join('');
    ul.innerHTML = items || `<li class="trip"><span>Aucun passage</span><span class="badge theory">mode théorique</span></li>`;
  }

  // ---- Traffic disruptions (PRIM general-message)
  async function loadTraffic(targetId, lineRefs=[]) {
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/general-message`;
    const data = await safeFetch(url);
    if (!data) return;
    const messages = (data?.messages || data?.generalMessages || data) || [];
    const relevant = Array.isArray(messages) ? messages.filter(m => {
      const lr = JSON.stringify(m).toLowerCase();
      return lineRefs.length ? lineRefs.some(x => lr.includes(String(x).toLowerCase())) : true;
    }) : [];
    const html = relevant.slice(0,3).map(m => {
      const txt = asLabel(m?.message?.text) || asLabel(m?.title) || asLabel(m?.summary) || 'Perturbation';
      return `<div>⚠️ ${txt}</div>`;
    }).join('') || '<div>Aucune perturbation signalée</div>';
    const el = q(`#${targetId}`);
    if (el) el.innerHTML = html;
  }

  // ---- Races (PMU offline + fallback local)
  async function loadRaces(){
    const today = new Date();
    const dd = String(today.getDate()).padStart(2,'0');
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}${mm}${yyyy}`;
    const url = `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${dateStr}?specialisation=INTERNET`;
    let data = await safeFetch(url);
    if (!data) data = await safeFetch('./data/races.json');

    let next = null;
    try{
      const races = [];
      function walk(obj){
        if (!obj) return;
        if (Array.isArray(obj)) { obj.forEach(walk); return; }
        if (typeof obj === 'object'){
          if (obj.heureDepart && (JSON.stringify(obj).toLowerCase().includes('vincennes'))) {
            races.push(obj);
          }
          Object.values(obj).forEach(walk);
        }
      }
      walk(data);
      races.sort((a,b)=> (a.heureDepart||'').localeCompare(b.heureDepart||''));
      next = races.find(r => {
        const [H,M] = (r.heureDepart||'00:00').split(':').map(Number);
        const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), H, M);
        return dt > now();
      }) || races[0];
    }catch(e){}
    const el = q('#race-next');
    if (!next) { el.textContent = "Pas de course aujourd’hui."; q('#race-ctdwn').textContent=''; return; }
    el.textContent = `${asLabel(next.libelle) || 'Course'} — départ ${next.heureDepart}`;
    const [H,M] = (next.heureDepart||'00:00').split(':').map(Number);
    const target = new Date(now().getFullYear(), now().getMonth(), now().getDate(), H, M);
    const tick = () => {
      const m = Math.max(0, minDiff(target, now()));
      q('#race-ctdwn').textContent = `⏳ dans ${m} min`;
    };
    tick(); setInterval(tick, 30000);
  }

  // ---- Kickoff
  function kickoff(){
    loadWeather(); setInterval(loadWeather, C.REFRESH_MS.WEATHER);
    loadNews(); setInterval(loadNews, C.REFRESH_MS.NEWS);

    loadVelib(); setInterval(loadVelib, C.REFRESH_MS.VELIB);

    loadStop('rerA', C.STOPS.RER_A_JOINVILLE);
    setInterval(()=>loadStop('rerA', C.STOPS.RER_A_JOINVILLE), C.REFRESH_MS.STOP_MONITORING);
    loadTraffic('rerA-traffic', C.LINE_FILTERS.RER_A);

    loadStop('bus77', C.STOPS.BUS_77_HIPPODROME);
    setInterval(()=>loadStop('bus77', C.STOPS.BUS_77_HIPPODROME), C.REFRESH_MS.STOP_MONITORING);
    loadTraffic('bus77-traffic', ['77']);

    loadStop('bus201', C.STOPS.BUS_201_BREUIL);
    setInterval(()=>loadStop('bus201', C.STOPS.BUS_201_BREUIL), C.REFRESH_MS.STOP_MONITORING);
    loadTraffic('bus201-traffic', ['201']);

    loadRaces(); setInterval(loadRaces, C.REFRESH_MS.RACES);

    q('#last-update').textContent = (new Date()).toISOString();
  }
  document.addEventListener('DOMContentLoaded', kickoff);
})();
