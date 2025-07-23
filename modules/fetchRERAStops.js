async function loadRERAStops() {
  const container = document.getElementById("rer-a-stops-content");
  if (!container) return;

  try {
    // 1. Récupérer le prochain train depuis Joinville
    const stopMonitoringUrl = CONFIG.PROXY_BASE + encodeURIComponent(
      "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=" + CONFIG.STOPS.rerA_point
    );
    const res = await fetch(stopMonitoringUrl);
    const data = await res.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit;

    if (!visits || visits.length === 0) {
      container.innerText = "Aucun train à venir.";
      return;
    }

    // 2. Prendre le DatedVehicleJourneyRef du prochain train
    const vjId = visits[0]?.MonitoredVehicleJourney?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;
    if (!vjId) {
      container.innerText = "Aucun identifiant de train trouvé.";
      return;
    }

    // 3. Récupérer les arrêts de ce train
    const encodedVjId = encodeURIComponent("vehicle_journey:" + vjId);
    const journeyUrl = CONFIG.PROXY_BASE + encodeURIComponent(
      "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/" + encodedVjId
    );
    const journeyRes = await fetch(journeyUrl);
    const journeyData = await journeyRes.json();

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
      el.innerText = s.stop_point.name;
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

// Appelle la fonction au chargement
document.addEventListener("DOMContentLoaded", loadRERAStops);
