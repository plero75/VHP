(() => {
try {
// Try to normalize known payload shapes
const sj = (data.vehicle_journey || data) ;
const times = sj.stop_times || sj.StopTimes || [];
const names = times.map(t => asLabel(t.stop_name || t.StopPointName || t.name)).filter(Boolean);
return names;
} catch(e){ console.warn("vehicle_journey parse error", e); return null; }
}


// ---- Traffic disruptions (PRIM general-message)
async function loadTraffic(targetId, lineRefs=[]) {
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
}


// ---- bootstrap
async function init(){
try {
// Carrousel actualités (local JSON)
try{
const res = await fetch('./news.json?v=' + cacheBuster());
if (res.ok) {
const news = await res.json();
if (Array.isArray(news) && news.length) renderCarousel(news);
}
}catch(e){}


// Velib
loadVelib();
setInterval(loadVelib, 60_000);


// RER A & Bus
await loadStop('rerA', C.STOPS.RER_A);
await loadStop('bus77', C.STOPS.BUS_77);
await loadStop('bus201', C.STOPS.BUS_201);
setInterval(() => {
loadStop('rerA', C.STOPS.RER_A);
loadStop('bus77', C.STOPS.BUS_77);
loadStop('bus201', C.STOPS.BUS_201);
}, 30_000);


// Perturbations
loadTraffic('traffic-A', [C.LINES.RER_A]);
loadTraffic('traffic-bus', [C.LINES.BUS_77, C.LINES.BUS_201]);
setInterval(() => {
loadTraffic('traffic-A', [C.LINES.RER_A]);
loadTraffic('traffic-bus', [C.LINES.BUS_77, C.LINES.BUS_201]);
}, 300_000);


setTS('#ts-global');
} catch(e){ console.error(e); }
}


init();
})();
