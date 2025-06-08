
function refreshDashboard() {
  // RER A – Joinville
  fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https%3A//prim.iledefrance-mobilites.fr/marketplace/stop-monitoring%3FMonitoringRef%3DSTIF%3AStopArea%3ASP%3A43689%3A")
    .then(res => res.json())
    .then(data => {
      const results = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;
      const rer = results.map(s => {
        const aimed = new Date(s.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const dir = s.MonitoredVehicleJourney.DirectionName;
        return `<li>${dir} — ${aimed}</li>`;
      }).join("");
      document.getElementById("rer-content").innerHTML = `<ul>${rer}</ul>`;
    })
    .catch(err => {
      document.getElementById("rer-content").innerText = "Erreur chargement RER";
    });

  // Bus 77 et 201 – Hippodrome
  fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https%3A//prim.iledefrance-mobilites.fr/marketplace/stop-monitoring%3FMonitoringRef%3DSTIF%3AStopArea%3ASP%3A412833%3A")
    .then(res => res.json())
    .then(data => {
      const results = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;
      let bus77 = "", bus201 = "";
      results.forEach(s => {
        const aimed = new Date(s.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const line = s.MonitoredVehicleJourney.LineRef;
        const dir = s.MonitoredVehicleJourney.DirectionName;
        const li = `<li>${dir} — ${aimed}</li>`;
        if (line.includes("77")) bus77 += li;
        else if (line.includes("201")) bus201 += li;
      });
      document.getElementById("bus77-content").innerHTML = `<ul>${bus77}</ul>`;
      document.getElementById("bus201-content").innerHTML = `<ul>${bus201}</ul>`;
    })
    .catch(err => {
      document.getElementById("bus77-content").innerText = "Erreur chargement bus 77";
      document.getElementById("bus201-content").innerText = "Erreur chargement bus 201";
    });

  // VELIB
  fetch("https://opendata.paris.fr/api/v2/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode=12163")
    .then(res => res.json())
    .then(data => {
      const st = data.records[0].record.fields;
      document.getElementById("velib12163").innerText = `Hippodrome : ${st.numbikesavailable} vélos dont ${st.ebike} électriques — bornes : ${st.numdocksavailable}`;
    });
  fetch("https://opendata.paris.fr/api/v2/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode=12128")
    .then(res => res.json())
    .then(data => {
      const st = data.records[0].record.fields;
      document.getElementById("velib12128").innerText = `Pyramide : ${st.numbikesavailable} vélos dont ${st.ebike} électriques — bornes : ${st.numdocksavailable}`;
    });

  // METEO
  fetch("https://wttr.in/Paris?format=%C+%t")
    .then(res => res.text())
    .then(txt => {
      document.getElementById("weather-content").innerText = `Paris : ${txt}`;
    });

  // Horodatage
  document.getElementById("last-update").textContent = "Dernière mise à jour : " + new Date().toLocaleTimeString("fr-FR");
}

refreshDashboard();
setInterval(refreshDashboard, 60000);
