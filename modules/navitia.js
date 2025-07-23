
const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev";
const stopMonitoringUrl = `${proxy}/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:473951:`;

export async function getNextStops() {
  try {
    const resp1 = await fetch(stopMonitoringUrl);
    const data1 = await resp1.json();
    const visit = data1.Siri.ServiceDelivery.StopMonitoringDelivery?.[0]?.MonitoredStopVisit?.[0];
    const vjId = visit?.MonitoredVehicleJourney?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;
    if (!vjId) throw new Error("Aucun train détecté");

    const encId = encodeURIComponent(vjId);
    const resp2 = await fetch(`${proxy}/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${encId}/stop_times`);
    const data2 = await resp2.json();
    return data2.stop_times || [];
  } catch(err) {
    console.error(err);
    return [];
  }
}
