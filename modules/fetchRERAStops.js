export async function fetchRERAStops({ monitoringRef, proxyURL, targetElementId }) {
  const container = document.getElementById(targetElementId);
  if (!container) return;

  container.innerHTML = "🔄 Chargement des arrêts...";

  try {
    // 1. Récupérer le prochain train via le monitoringRef fourni
    const stopMonitoringUrl = proxyURL + encodeURIComponent(
      `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}`
    );
    const res = await fetch(stopMonitoringUrl);
    const data = await res.json();
    console.log("StopMonitoring response:", data);
    console.log("StopMonitoringDelivery:", data?.Siri?.ServiceDelivery?.StopMonitoringDelivery);
    console.log("MonitoredStopVisit:", data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit);

    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit;
    if (!visits || visits.length === 0) {
      container.innerText = "Aucun train à venir.";
      return;
    }

    // Log avec l'heure et l'identifiant du prochain train detecté
    const firstVisit = visits[0];
    const firstJourney = firstVisit?.MonitoredVehicleJourney;
    const call = firstJourney?.MonitoredCall;
    const nextTime =
      call?.ExpectedDepartureTime ||
      call?.ExpectedArrivalTime ||
      call?.AimedDepartureTime ||
      call?.AimedArrivalTime ||
      null;
    const timeStr = nextTime ? new Date(nextTime).toLocaleTimeString('fr-FR') : 'Heure inconnue';
    const nextId =
      firstJourney?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ||
      firstJourney?.DatedVehicleJourneyRef ||
      'ID inconnu';
    console.log(`[${new Date().toLocaleTimeString('fr-FR')}] Prochain train ${nextId} – heure prévue : ${timeStr}`);

    // 2. Prendre l'identifiant du prochain train (pris depuis le premier train à venir)
    const vjId =
      firstJourney?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ||
      firstJourney?.DatedVehicleJourneyRef ||
      null;
    if (!vjId) {
      container.innerText = "Aucun identifiant de train trouvé.";
      return;
    }

    // 3. Récupérer les arrêts de ce train
    const encodedVjId = encodeURIComponent("vehicle_journey:" + vjId);
    const journeyUrl = proxyURL + encodeURIComponent(
      `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${encodedVjId}`
    );
    const journeyRes = await fetch(journeyUrl);
    const journeyData = await journeyRes.json();
    console.log("VehicleJourney response:", journeyData);

    const stops = journeyData?.vehicle_journeys?.[0]?.stop_times;
    if (!stops || stops.length === 0) {
      container.innerText = "Aucun arrêt trouvé pour ce train.";
      return;
    }

    // 4. Afficher les prochains arrêts (non sautés)
    const futureStops = stops.filter(s => !s.skipped_stop);
    if (futureStops.length === 0) {
      container.innerText = "Tous les arrêts sont sautés pour ce train.";
      return;
    }

    container.innerHTML = "";
    futureStops.forEach((s, i) => {
      const el = document.createElement("span");
      el.style.marginRight = "20px";
      el.style.padding = "6px 12px";
      el.style.borderRadius = "20px";
      el.style.backgroundColor = "#007bff";
      el.style.color = "white";
      el.style.display = "inline-block";
      el.style.fontSize = "0.95rem";
      el.innerText = s.stop_point?.name || "Arrêt inconnu";
      container.appendChild(el);
      if (i < futureStops.length - 1) {
        const arrow = document.createElement("span");
        arrow.innerText = " ➜ ";
        arrow.style.color = "#222";
        arrow.style.fontWeight = "bold";
        container.appendChild(arrow);
      }
    });
  } catch (e) {
    container.innerText = "Erreur lors du chargement des arrêts.";
    console.error(e);
  }
}
