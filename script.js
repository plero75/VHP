
function refreshDashboard() {
  // RER A
  fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https%3A//prim.iledefrance-mobilites.fr/marketplace/v2/navitia/coverage/fr-idf/stop_areas/stop_area%3ASTIF%3AStopArea%3ASP%3A43689%3A/stop_schedules%3Fcount%3D3")
    .then(res => res.json())
    .then(data => {
      if (!data.stop_schedules) return;
      const rer = data.stop_schedules.map(s => {
        const time = new Date(s.date_times[0].date_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        return `<li>${s.display_informations.direction} — ${time}</li>`;
      }).join("");
      document.getElementById("rer-content").innerHTML = `<ul>${rer}</ul>`;
    })
    .catch(err => {
      document.getElementById("rer-content").innerText = "Erreur de chargement RER";
    });

  // BUS 77 & 201
  fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https%3A//prim.iledefrance-mobilites.fr/marketplace/v2/navitia/coverage/fr-idf/stop_areas/stop_area%3ASTIF%3AStopArea%3ASP%3A412833%3A/stop_schedules%3Fcount%3D5")
    .then(res => res.json())
    .then(data => {
      if (!data.stop_schedules) return;
      let bus77 = "", bus201 = "";
      data.stop_schedules.forEach(s => {
        const time = new Date(s.date_times[0].date_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const line = s.display_informations.code;
        const direction = s.display_informations.direction;
        const li = `<li>${direction} — ${time}</li>`;
        if (line === "77") bus77 += li;
        if (line === "201") bus201 += li;
      });
      document.getElementById("bus77-content").innerHTML = `<ul>${bus77}</ul>`;
      document.getElementById("bus201-content").innerHTML = `<ul>${bus201}</ul>`;
    })
    .catch(err => {
      document.getElementById("bus77-content").innerText = "Erreur bus 77";
      document.getElementById("bus201-content").innerText = "Erreur bus 201";
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
