// ... (autres fonctions inchangées)

async function fetchIDFMRealtime(ref, containerId) {
  const apiBase = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring";
  const apiUrl = `${apiBase}?MonitoringRef=${encodeURIComponent(ref)}`;
  const url = `${PROXY_URL}?url=${encodeURIComponent(apiUrl)}`;

  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();
    const visits = (data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit) || [];
    if (!visits.length) {
      el.innerHTML = `<div class="status warning">Aucun passage à venir pour cet arrêt.</div>`;
      return;
    }
    el.innerHTML = visits.slice(0, 4).map(v => {
      const aimed = v.MonitoredVehicleJourney?.MonitoredCall?.AimedArrivalTime;
      const dt = aimed ? new Date(aimed) : null;
      const dest = getValue(v.MonitoredVehicleJourney?.DestinationName);
      const line = getValue(v.MonitoredVehicleJourney?.LineRef);
      const now = new Date();
      const mins = dt ? Math.round((dt - now) / 60000) : null;
      return `<div class="bus-row">
        <span class="bus-line-idfm">${line.replace(/\D/g,'')}</span>
        <span class="bus-destination">${dest}</span>
        <span class="bus-wait">${mins !== null ? (mins > 0 ? `dans ${mins} min` : "à l'instant") : ""}</span>
      </div>`;
    }).join("");
  } catch (e) {
    el.innerHTML = `<div class="status warning">⛔ Temps réel IDFM indisponible (${e.message})</div>`;
  }
}
