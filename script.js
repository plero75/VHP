
const apiKey = "UR9WA8HSkj9Kd101Tss54lukUdfMeDNC";

function refreshDashboard() {
  // ➤ RER A (Joinville-le-Pont)
  fetch("https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/coverage/fr-idf/stop_areas/stop_area:STIF:StopArea:Q:43135:/stop_schedules?count=3", {
    headers: { apikey: apiKey }
  })
  .then(res => res.json())
  .then(data => {
    const rer = data.stop_schedules.map(s => {
      const time = new Date(s.date_times[0].date_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      return `<li>${s.display_informations.direction} — ${time}</li>`;
    }).join("");
    document.getElementById("rer-content").innerHTML = `<ul>${rer}</ul>`;
  });

  // ➤ Bus 77 et 201
  fetch("https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/coverage/fr-idf/stop_areas/stop_area:STIF:StopArea:Q:412833:/stop_schedules?count=5", {
    headers: { apikey: apiKey }
  })
  .then(res => res.json())
  .then(data => {
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
  });

  // ➤ Vélib’
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

  // ➤ Météo
  fetch("https://wttr.in/Paris?format=%C+%t")
    .then(res => res.text())
    .then(txt => {
      document.getElementById("weather-content").innerText = `Paris : ${txt}`;
    });

  // ➤ Circulation
  fetch("https://data.opendatasoft.com/api/explore/v2.1/catalog/datasets/etat-de-circulation-en-temps-reel-sur-le-reseau-national-routier-non-concede/records?limit=100")
    .then(res => res.json())
    .then(data => {
      const filtered = data.results.filter(x => x.nom_route.includes("A86") || x.nom_route.includes("Périph"));
      document.getElementById("traffic-content").innerHTML = filtered.map(e => `<li>${e.nom_route} — ${e.etat_trafic}</li>`).join("");
    });

  // ➤ Heure de dernière mise à jour
  document.getElementById("last-update").textContent = "Dernière mise à jour : " + new Date().toLocaleTimeString("fr-FR");
}

// Actualisation initiale
refreshDashboard();

// Actualisation toutes les 60 secondes
setInterval(refreshDashboard, 60000);
