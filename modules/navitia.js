// modules/navitia.js
const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev";
const stopMonitoringUrl = `${proxy}/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:43135:`;

export async function getNextStops() {
  try {
    const resp = await fetch(stopMonitoringUrl);
    const data = await resp.json();

    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit;
    if (!visits || visits.length === 0) throw new Error("Aucun train trouvé");

    const monitoredCalls = visits[0]?.MonitoredVehicleJourney?.OnwardCalls?.OnwardCall || [];
    return monitoredCalls.map(call => ({
      name: call.StopPointName?.value || "???",
      expected: call.ExpectedArrivalTime,
      aimed: call.AimedArrivalTime,
      destination: visits[0]?.MonitoredVehicleJourney?.DestinationName?.value || ""
    }));
  } catch (err) {
    console.error("Erreur dans getNextStops :", err);
    return [];
  }
}
