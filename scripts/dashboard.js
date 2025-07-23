
import { updateClock } from '../modules/horloge.js';
import { renderStops } from '../modules/ui.js';
import { getNextStops } from '../modules/navitia.js';

function init() {
  updateClock();
  setInterval(updateClock, 1000);

  refresh();
  setInterval(refresh, 60000);
}

async function refresh() {
  try {
    const stops = await getNextStops();
    renderStops(stops);
  } catch (e) {
    console.error("Erreur dans refresh :", e);
  }
}

init();
