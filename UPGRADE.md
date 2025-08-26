
# UPGRADE – Alignement avec la Bible Dashboard Vincennes

Changements principaux :
- ✅ **Endpoints PRIM corrigés** : `/marketplace/stop-monitoring` (au lieu d'une URL tronquée), `general-message` conservé.
- ✅ **Namespaces IDFM** : StopArea et LineRef passent en `IDFM:` (Joinville `IDFM:70640`, Hippodrome `IDFM:463641`, Breuil `IDFM:463644`, RER A `line:IDFM:C01742`, Bus `line:IDFM:C02251`).
- ✅ **Regroupement par destination** + direction (clé `DirectionRef|DestinationName`) et entêtes mis à jour.
- ✅ **Gares desservies** du **prochain** départ par sens (appel `vehicle_journeys/{id}`) rendues sous forme de ligne défilante discrète sous le 1er item.
- ✅ **Badges et états** : `imminent`, `supprimé`, prévu ~~barré~~ + estimé, retard `+X′`.
- ✅ **Cadences de rafraîchissement** ajustées (StopMonitoring 30s, Velib 30s, Trafic 120s, Météo 10min, News 60s, Races 10min).
- ✅ **CSS** : styles `.calls`, `.strike`, badges.

À faire (facultatif / prochain sprint) :
- 🔸 Calcul "dernier passage" via extraction 1×/jour des horaires GTFS (workflow déjà présent).
- 🔸 Filtrage `general-message` côté requête (param `line=`) si support stable, sinon filtrage client conservé.
- 🔸 Poursuivre l’harmonisation des icônes et mentions légales selon la charte.
