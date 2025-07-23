// modules/ui.js
export function renderStops(stops) {
  const el = document.getElementById("content");
  el.innerHTML = "";

  if (!stops.length) {
    el.innerHTML = "<p>Aucun arrêt à afficher</p>";
    return;
  }

  stops.forEach(stop => {
    const div = document.createElement("div");
    div.innerHTML = `
      <div style="margin-bottom: 1em;">
        <strong>${stop.name}</strong><br>
        <span>🕐 ${new Date(stop.expected).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</span><br>
        <small>➡️ ${stop.destination}</small>
      </div>
    `;
    el.appendChild(div);
  });
}
