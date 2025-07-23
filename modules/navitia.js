
const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev";
const stopMonitoringUrl = `${proxy}/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:43135:`;
// 43135 = Joinville-le-Pont (RER A)

export async function getNextStops() {
  try {
    const resp1 = await fetch(stopMonitoringUrl);
    const data1 = await resp1.json();

    if (!data1?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.length) {
      throw new Error("Pas de données retournées depuis stop-monitoring");
    }

    const visit = data1.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit?.[0];
    const vjId = visit?.MonitoredVehicleJourney?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;

    if (!vjId) {
      throw new Error("Aucun train détecté ou pas d'ID de trajet");
    }

    const encId = encodeURIComponent(vjId);
    const resp2 = await fetch(`${proxy}/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${encId}/stop_times`);
    const data2 = await resp2.json();
    return data2.stop_times || [];
  } catch(err) {
    console.error("Erreur dans getNextStops :", err);
    return [];
  }
}
