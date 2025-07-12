/* =========================================================================
   CONFIGURATION – adapter les IDs si nécessaire
   ========================================================================= */
const PRIM_URL  = "https://prim.iledefrance-mobilites.fr/marketplace";
const LINES = [
  { id: "rer",   name: "RER A",  monitoringRef: "IDFM:70640", directionRef: "A" },
  { id: "bus77", name: "Bus 77", monitoringRef: "IDFM:463642", directionRef: "R" },
  { id: "bus201",name: "Bus 201",monitoringRef: "IDFM:463645", directionRef: "A" }
];

/* =========================================================================
   OUTILS
   ========================================================================= */
const fmtTime = d => d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

/* =========================================================================
   1. CHARGE les horaires théoriques (GTFS) pour premiers / derniers passages
   ========================================================================= */
let firstLastCache = {};
(async () => {
  try {
    firstLastCache = await fetchJSON("./static/gtfs-firstlast.json");
  } catch { /* première exécution : le fichier peut ne pas encore exister */ }
})();

/* =========================================================================
   2. RÉCUPÈRE ET AFFICHE les données temps réel PRIM (incl. OnwardCalls)
   ========================================================================= */
async function updateDepartures() {
  const tbody = document.querySelector("#departures-body");
  tbody.innerHTML = "";

  for (const line of LINES) {
    try {
      /* 2.1 Appel PRIM – StopMonitoring avec détail des OnwardCalls */
      const url = `${PRIM_URL}/stop-monitoring`
        + `?MonitoringRef=${line.monitoringRef}`
        + `&DirectionRef=${line.directionRef}`
        + `&MaximumStopVisits=1`
        + `&StopMonitoringDetailLevel=normal`
        + `&MaximumNumberOfCalls=20`;
      const json = await fetchJSON(url);

      const visit = json.Siri.ServiceDelivery?.StopMonitoringDelivery?.[0]
        ?.MonitoredStopVisit?.[0];
      if (!visit) continue;                                    // pas de donnée

      /* 2.2 – > prochain passage et liste d’arrêts OnwardCalls */
      const mvj       = visit.MonitoredVehicleJourney  || {};
      const call      = mvj.MonitoredCall             || {};
      const onward    = mvj.OnwardCalls?.OnwardCall    || [];

      const nextTime  = new Date(call.ExpectedDepartureTime || call.AimedDepartureTime);
      const stopsList = onward
        .map(c => (c.StopPointName?.value ?? c.StopPointName ?? "").trim())
        .filter(Boolean);

      /* 2.3 Premier / Dernier depuis le cache GTFS */
      const fl        = firstLastCache[line.id] || {};
      const firstLast = fl.first ? `♦️ ${fl.first} – ${fl.last}` : "…";

      /* 2.4 Ajoute une ligne au tableau */
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${line.name}</td>
        <td>${mvj.DirectionName?.value ?? ""}</td>
        <td>${fmtTime(nextTime)}</td>
        <td>${firstLast}</td>
        <td>${stopsList.join(" · ")}</td>
      `;
      tbody.appendChild(tr);

    } catch (e) {
      console.error("PRIM erreur :", e);
    }
  }
}

/* =========================================================================
   3. LANCE la boucle de rafraîchissement toutes les 30 s
   ========================================================================= */
updateDepartures();
setInterval(updateDepartures, 30_000);
