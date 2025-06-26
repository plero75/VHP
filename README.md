 Cahier des charges fonctionnel et technique

Projet : Affichage temps réel de la mobilité autour de l’Hippodrome de Vincennes

1. Objectif

Mettre à disposition du public un affichage dynamique présentant en temps réel :

Les horaires de passage du RER A à Joinville-le-Pont

Les horaires des bus 77 et 201 (Hippodrome de Vincennes, École du Breuil)

Les stations Vélib'

La météo locale

Le trafic routier et les infos trafic lignes RATP/SNCF

2. Données & API utilisées

A. Transports en commun (IDFM / PRIM)

Plateforme : https://prim.iledefrance-mobilites.fr

Authentification : Clé API unique (header HTTP : apikey: VOTRE_CLE_API)

Proxy : https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=

Format : JSON / SIRI Lite

B. Données à interroger :

Lieu

MonitoringRef

LineRef

RER A Joinville-le-Pont

STIF:StopArea:SP:475771:

STIF:Line::C01742:

Bus 77 Hippodrome (est)

STIF:StopPoint:Q:417601:

STIF:Line::C02251:

Bus 77 Hippodrome (ouest)

STIF:StopPoint:Q:417602:

STIF:Line::C02251:

Bus 201 École du Breuil

STIF:StopPoint:Q:423233: / Q:423235:

STIF:Line::C01219:

C. Récupération des retards

Différence entre ExpectedDepartureTime et AimedDepartureTime dans l’API stop-monitoring

D. Infos trafic (perturbations)

Endpoint : /general-message

Paramètres : LineRef=STIF:Line::C01742: etc.

Retourne les incidents, travaux, alertes temps réel

E. Premier et dernier passage

L'affichage devra inclure le premier et le dernier train ou bus de la journée, récupérés via :

les données statiques GTFS (stop_times.txt, trips.txt, calendar.txt)

ou en interrogeant l'API pour la plage horaire complète du jour.

F. Contraintes d’appels API

Limites imposées par IDFM PRIM :

100 000 requêtes/jour pour un même endpoint (requêtes unitaires)

300 requêtes/jour pour les requêtes globales (endpoint aggregé)

Les requêtes doivent être optimisées (fréquence, cache, appel groupé si possible)

3. Autres données

A. Météo

API recommandée : OpenWeatherMap ou Météo-France

Exemple d'URL OpenWeatherMap : https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric&lang=fr

Champs utilisés : température, conditions météo (description + icône), vitesse du vent

Format : JSON (température, icône, vent)

B. Trafic routier

Fournisseur possible : HERE Maps / TomTom / Sytadin (ou carte statique)

Sytadin : portail d'information trafic en Île-de-France (https://www.sytadin.fr)

Intégration via iframe (widget carte) ou récupération de données via scraping/API (si disponible)

Objectif : visualisation de l’état de congestion autour de l’Hippodrome (rayon 2-3 km)

C. Vélib'

Fournisseur : Smovengo / Vélib' Métropole via opendata.paris.fr

Données disponibles par station :

Nombre de vélos disponibles

Détail : nombre de vélos mécaniques et électriques

Nombre de bornes libres (places disponibles)

État de fonctionnement de la station (stationState ou status = OPEN/CLOSED)

Stations concernées :

Station

ID (stationcode)

Hippodrome Paris‑Vincennes

12163

Pyramide – École du Breuil

12128

Format API : JSON, fréquence recommandée de rafraîchissement : toutes les 60 secondes

4. Lieux desservis (mise à jour + stratégie d'appel API + limites observées)

🔁 Principe

Les gares et arrêts desservis doivent être récupérés dynamiquement pour chaque train ou course, car le parcours peut varier selon l’horaire, le service, ou des modifications ponctuelles (ex. terminus anticipé, itinéraire court).

⚙️ Optimisation : l'appel aux arrêts desservis se fait au moment de la détection d'un nouveau train ou bus (nouveau DatedVehicleJourneyRef dans l’API stop-monitoring).

🛑 Rechargement seulement si : un nouveau train/bus est détecté OU un changement d’état (retard, suppression, modification de terminus) est signalé via l’API trafic (general-message).

❗ Limites constatées :

Le champ StopPointName retourné dans MonitoredCall ne contient pas toujours la liste complète des arrêts desservis.

Pour une vue exhaustive, une requête dédiée vers /vehicle-journey/<ref>/stop_points (ou /trip/) est nécessaire — ce point peut ne pas être directement exposé.

En l'absence de support dans l’API temps réel, prévoir un fallback basé sur les données GTFS stop_times.txt liées au trip_id correspondant.Rechargement seulement si : une alerte trafic modifie le parcours (suppression/ajout d'arrêt, terminus déplacé, etc.), ou si une anomalie est détectée (retard > seuil critique).

