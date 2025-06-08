// Date/heure dynamique + adaptation taille si alerte trafic
function showTrafficAlert(msg) {
  const alert = document.getElementById('traffic-alert');
  if(alert) {
    alert.textContent = msg;
    alert.classList.remove('hidden');
    document.getElementById('datetime').classList.remove('datetime-big');
    document.getElementById('datetime').classList.add('datetime-small');
  }
}
function hideTrafficAlert() {
  const alert = document.getElementById('traffic-alert');
  if(alert) {
    alert.textContent = '';
    alert.classList.add('hidden');
    document.getElementById('datetime').classList.add('datetime-big');
    document.getElementById('datetime').classList.remove('datetime-small');
  }
}
function updateDateTime() {
  const now = new Date();
  const options = { weekday:'long', day:'numeric', month:'long' };
  document.getElementById('current-date').textContent = now.toLocaleDateString('fr-FR', options);
  document.getElementById('current-time').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('last-update').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateDateTime, 1000);
updateDateTime();

// Exemple : à appeler depuis ton JS métier si alerte
// showTrafficAlert("Trafic perturbé sur la ligne A");
// hideTrafficAlert();
