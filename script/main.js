
import { getNextStops } from './modules/navitia.js';
import { renderStops } from './modules/ui.js';

async function update() {
  const ul = document.getElementById("gares-desservies");
  if (ul) ul.innerHTML = "<li>Chargement…</li>";
  const stops = await getNextStops();
  renderStops(stops);
}

update();
setInterval(update, 60000);
