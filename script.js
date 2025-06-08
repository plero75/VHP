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

// Exemple d’utilisation :
// showTrafficAlert("Trafic perturbé sur la ligne A");
// hideTrafficAlert(); // Pour revenir à l’affichage grand

// Date/heure en direct
function updateDateTime() {
  const now = new Date();
  const options = { weekday:'long', day:'numeric', month:'long' };
  document.getElementById('current-date').textContent = now.toLocaleDateString('fr-FR', options);
  document.getElementById('current-time').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateDateTime, 1000);
updateDateTime();
