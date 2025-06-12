
// Exemple corrigé de slice pour horaires
function parseScheduleTimes(schedules) {
  if (!Array.isArray(schedules)) return [];
  return schedules
    .filter(t => typeof t === "string" && t.length >= 13)
    .map(t => t.slice(9,13))
    .sort();
}
