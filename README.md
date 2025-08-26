# VHP3 – Dashboard « Hippodrome de Vincennes »

Front **HTML/CSS/JS** + **proxy Cloudflare Worker** (injection clés PRIM, CORS, cache).

## Modules
- Prochains passages (RER A Joinville, Bus 77 Hippodrome, Bus 201 École du Breuil) – **4 passages par direction** (retards, supprimé, imminent) + **arrêts desservis** (OnwardCalls).
- Info trafic (bannières) par ligne/arrêt.
- Météo (Open-Meteo).
- Vélib’ (12163/1074333296, 12128/508042092).
- Prochaine course PMU (Paris-Vincennes) + **compte à rebours**.
- Fil d’actu FranceInfo.
- Fallback **GTFS** (premier/dernier départ) via script + GitHub Action.

## Proxy (Cloudflare Worker)
Variables d’environnement :
- `IDFM_APIKEY` (PRIM dynamiques — header `apikey`)
- `ODS_APIKEY` (OpenData/GTFS — header `Authorization: Apikey`)

Le Worker impose **un seul** `Access-Control-Allow-Origin: *`.

## Front
- Ouvrir `index.html` via un serveur (ex: `python -m http.server`).
- Config dans `config.js`.

## GTFS fallback
- Script `scripts/gtfs/extract_gtfs.py` → produit `data/gtfs-cache.json` (first/last par stop_id).
- GitHub Action `.github/workflows/gtfs-cache.yml` (quotidien).

## Règles UX
- Grid sans scroll, 4 passages/direction, retard = heure barrée + +X’, « supprimé » rouge, « imminent » < 90 s, arrêts desservis en défilement, bannière trafic, badge « mode théorique » si fallback.
