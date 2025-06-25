// =============================
//  CONFIGURATION & CONSTANTES
// =============================

const VELIB_IDS = { vincennes: "1074333296", breuil: "508042092" };

const STOP_POINTS = {
  rer: {
    name: "RER A Joinville-le-Pont",
    icon: "img/picto-rer-a.svg"
  },
  bus77: {
    name: "BUS 77 Hippodrome de Vincennes",
    icon: "img/picto-bus.svg"
  },
  bus201: {
    name: "BUS 201 Ecole du Breuil",
    icon: "img/picto-bus.svg"
  }
};

// ===================
//   UTILS
// ===================

function formatTime(d, withSec = false) {
  if (!d) return "-";
  let date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "-";
  const opts = withSec ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : { hour: "2-digit", minute: "2-digit" };
  return date.toLocaleTimeString("fr-FR", opts);
}

function formatDateFr(d = new Date()) {
  return d.toLocaleDateString("fr-FR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ===================
//  AFFICHAGE DES BLOCS
// ===================

// Date/heure dans les spans existants
function updateDateBloc() {
  document.getElementById("current-date").textContent = formatDateFr();
  document.getElementById("current-time").textContent = formatTime(new Date());
}

// Météo (exemple statique)
function updateWeatherBloc(temp = 32, condition = "Soleil") {
  document.getElementById("weather-bloc").innerHTML =
    `<div class='bloc-titre'><img src='img/picto-meteo.svg' class='icon-inline'>Météo</div>
     <div>🌡️ Température : <b>${temp}°C</b></div>
     <div>☀️ ${condition}</div>`;
}

// Info trafic (lien Sytadin/Bison Futé, adapté à un site statique)
function updateInfoTraficBloc() {
  document.getElementById("info-trafic-bloc").innerHTML =
    `<div class='bloc-titre'>
        <img src='img/picto-info.svg' class='icon-inline'>
        Info trafic autour de l’hippodrome
     </div>
     <div style="margin-top:10px">
        Consultez en temps réel les conditions de circulation autour de l’hippodrome via :
        <ul>
          <li>
            <a href="https://www.sytadin.fr/" target="_blank" rel="noopener">Sytadin</a>
             (trafic, bouchons, perturbations)
          </li>
          <li>
            <a href="https://www.bison-fute.gouv.fr/paris-ile-de-france.html" target="_blank" rel="noopener">
                Bison Futé Paris/Île-de-France
            </a>
          </li>
        </ul>
     </div>
     <div style="margin-top:10px">
        <a href="https://www.sytadin.fr/" target="_blank" rel="noopener">
          <button style="padding:8px 16px;font-size:1em;">Voir la carte trafic Sytadin</button>
        </a>
     </div>`;
}

// Vélib (exemple statique, tu peux le remplacer par un fetch si tu as une API)
function updateVelibBloc(elementId, mechanical = 8, ebike = 2, free = 6) {
  document.getElementById(elementId).innerHTML = `
    <div class='title-line'><img src='img/picto-velib.svg' class='icon-inline'>Vélib'</div>
    🚲 Mécaniques : ${mechanical}<br>
    ⚡ Électriques : ${ebike}<br>
    🅿️ Places libres : ${free}
  `;
}

// Départs transports (exemple statique)
function renderDepartures(elementId, stopKey) {
  document.getElementById(elementId).innerHTML = `
    <div class='title-line'><img src='${STOP_POINTS[stopKey].icon}' class='icon-inline'>${STOP_POINTS[stopKey].name}</div>
    <ul>
      <li>08:13 (2 min) → Paris</li>
      <li>08:25 (14 min) → Paris</li>
      <li>08:37 (26 min) → Paris</li>
    </ul>
    <div class='schedule-extremes'>Premier départ : 05:09<br>Dernier départ : 00:39</div>
  `;
}

// ===================
//  Rafraîchissement global
// ===================

function refreshAll() {
  updateDateBloc();
  updateWeatherBloc();
  updateInfoTraficBloc();
  updateVelibBloc("velib-vincennes");
  updateVelibBloc("velib-breuil");
  renderDepartures("rer-content", "rer");
  renderDepartures("bus77-content", "bus77");
  renderDepartures("bus201-content", "bus201");
}

// Rafraîchissement toutes les 60 secondes
refreshAll();
setInterval(refreshAll, 60000);
