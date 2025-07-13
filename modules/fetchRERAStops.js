// modules/fetchRERAStops.js

export async function fetchRERAStops({
  monitoringRef = "STIF:StopPoint:Q:473951:",
  proxyURL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=",
  targetElementId = "rer-a-stops"
}) {
  const stopMonitoringURL = proxyURL + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}`);

  const container = document.getElementById(targetElementId);
  if (!container) return console.error(`Élément HTML #${targetElementId} introuvable.`);

  container.innerHTML = "Chargement des arrêts RER A…";

  try {
    const stopRes = await fetch(stopMonitoringURL);
    const stopData = await stopRes.json();
    const visits = stopData.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;

    for (let visit of visits) {
      const vjRef = visit.MonitoredVehicleJourney.FramedVehicleJourneyRef.DatedVehicleJourneyRef;
      const encodedVJ = encodeURIComponent(vjRef);
      const vjURL = proxyURL + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${encodedVJ}`);

      const vjRes = await fetch(vjURL);
      if (vjRes.ok) {
        const vjData = await vjRes.json();
        const stops = vjData.vehicle_journeys?.[0]?.stop_times;

        if (stops && stops.length > 0) {
          const html = stops.map(s => s.stop_point.name).join(" • ");
          container.innerHTML = `<marquee>${html}</marquee>`;
          return;
        }
      }
    }

    container.innerHTML = "Aucun train valide trouvé.";
  } catch (err) {
    console.error("Erreur dans fetchRERAStops :", err);
    container.innerHTML = "Erreur lors du chargement.";
  }
}
