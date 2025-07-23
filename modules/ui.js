export function renderStops(stops) {
  const el = document.getElementById("content");
  el.innerHTML = "";
  stops.forEach(stop => {
    const div = document.createElement("div");
    div.innerHTML = `
      <strong>${stop.name}</strong>
      <br><span>🕐 ${new Date(stop.expected).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
      <br><small>➡️ ${stop.destination}</small>
    `;
    el.appendChild(div);
  });
}
