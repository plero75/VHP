
export function renderStops(stops) {
  const ul = document.getElementById("gares-desservies");
  if (!ul) return;
  if (stops.length === 0) {
    ul.innerHTML = "<li>Aucun train détecté</li>";
    return;
  }
  ul.innerHTML = stops.map(s => {
    const t = s.arrival_time ? new Date(s.arrival_time).toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"}) : "";
    return `<li><strong>${s.stop_point.stop_area.name}</strong> – ${t}</li>`;
  }).join("");
}
