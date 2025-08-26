#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère les premiers/derniers passages par StopArea & ligne (par direction)
à partir d'un GTFS complet (IDFM). Compatible avec le format attendu par l'app.

Exemples :
  python build_first_last.py --zip IDFM-gtfs.zip \
    --date 2025-08-26 \
    --stopareas IDFM:70640 IDFM:463641 IDFM:463644 \
    --lines line:IDFM:C01742 line:IDFM:C02251 \
    --out data/first_last.json
"""
import argparse, zipfile, io, csv, json, datetime, sys
from collections import defaultdict
from typing import Dict, List, Set, Tuple

EUROPE_PARIS = "Europe/Paris"

def parse_args():
    ap = argparse.ArgumentParser(description="Compute first/last departures per StopArea/line/direction from GTFS")
    ap.add_argument("--zip", required=True, help="Path to GTFS zip")
    ap.add_argument("--out", required=True, help="Output JSON path")
    ap.add_argument("--date", required=True, help="Service date (YYYY-MM-DD) in Europe/Paris")
    ap.add_argument("--stopareas", nargs="+", required=True, help="List of StopArea IDs (e.g. IDFM:70640)")
    ap.add_argument("--lines", nargs="+", required=True, help="List of line refs (e.g. line:IDFM:C01742 line:IDFM:C02251)")
    return ap.parse_args()

def read_csv_from_zip(zf, name):
    with zf.open(name) as f:
        txt = io.TextIOWrapper(f, encoding="utf-8")
        return list(csv.DictReader(txt))

def parse_hms_to_minutes(hms: str) -> int:
    # gère HH:MM:SS y compris HH >= 24
    hh, mm, ss = [int(x) for x in hms.split(":")]
    return hh*60 + mm  # on ignore les secondes pour notre usage d’affichage

def minutes_to_hhmm(m: int) -> str:
    hh = (m // 60) % 24
    mm = m % 60
    return f"{hh:02d}:{mm:02d}"

def build_service_mask(calendar, calendar_dates, target_date: datetime.date) -> Set[str]:
    # services actifs ce jour-là (calendar + exceptions)
    wd = target_date.weekday()  # 0=Mon ... 6=Sun
    day_keys = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
    active = set()

    def date_in_range(row):
        start = datetime.date.fromisoformat(row["start_date"][:4]+"-"+row["start_date"][4:6]+"-"+row["start_date"][6:])
        end   = datetime.date.fromisoformat(row["end_date"][:4]+"-"+row["end_date"][4:6]+"-"+row["end_date"][6:])
        return start <= target_date <= end

    # Base calendar
    for row in calendar:
        if not date_in_range(row): 
            continue
        if row[day_keys[wd]] == "1":
            active.add(row["service_id"])

    # Exceptions
    for row in calendar_dates:
        d = row["date"]
        d_date = datetime.date.fromisoformat(d[:4]+"-"+d[4:6]+"-"+d[6:])
        if d_date != target_date:
            continue
        sid = row["service_id"]
        ex = row.get("exception_type")
        if ex == "1":
            active.add(sid)
        elif ex == "2":
            if sid in active:
                active.remove(sid)

    return active

def map_line_ref(routes_row: Dict[str,str]) -> str:
    """
    Essaie de restituer la LineRef Navitia/IDFM de type 'line:IDFM:C01742' à partir de routes.txt.
    Selon les jeux de données, le code peut être dans route_id, route_short_name, route_desc, agency_id, etc.
    On tente plusieurs heuristiques, puis on retourne un identifiant stable si trouvé.
    """
    for key in ["route_id","route_short_name","route_long_name","route_desc","agency_id"]:
        val = (routes_row.get(key) or "").strip()
        if val.startswith("line:IDFM:"):
            return val
        # heuristique Cnnnnn (ex: C01742)
        if val.startswith("C0") or val.startswith("C"):
            return f"line:IDFM:{val}"
    # fallback : route_id brut — on laissera le filtre --lines faire le tri
    return routes_row.get("route_id","").strip()

def main():
    args = parse_args()
    target_date = datetime.date.fromisoformat(args.date)

    with zipfile.ZipFile(args.zip, "r") as zf:
        stops       = read_csv_from_zip(zf, "stops.txt")
        stop_times  = read_csv_from_zip(zf, "stop_times.txt")
        trips       = read_csv_from_zip(zf, "trips.txt")
        routes      = read_csv_from_zip(zf, "routes.txt")
        calendar    = read_csv_from_zip(zf, "calendar.txt")
        try:
            calendar_dates = read_csv_from_zip(zf, "calendar_dates.txt")
        except KeyError:
            calendar_dates = []

    # index
    trips_by_id = {t["trip_id"]: t for t in trips}
    routes_by_id = {r["route_id"]: r for r in routes}

    # map StopArea → set(stop_id enfants)
    stoparea_children: Dict[str, Set[str]] = defaultdict(set)
    stop_by_id = {s["stop_id"]: s for s in stops}
    for s in stops:
        loc_type = s.get("location_type","0")
        pid = s.get("parent_station")  # enfant → parent
        sid = s["stop_id"]
        if pid:
            # parent_station peut être un StopArea (location_type 1) ; certains IDFM encodent l’IDFM:xxxxx dedans
            # On conserve tel quel : l’utilisateur passe --stopareas avec ces IDs
            stoparea_children[pid].add(sid)
        # Certains jeux IDFM mettent directement le StopArea en tant que stop_id (location_type=1).
        # Dans ce cas, rattache-le à lui-même pour ne rien rater :
        if loc_type == "1":
            stoparea_children[sid].add(sid)

    # services actifs ce jour
    active_services = build_service_mask(calendar, calendar_dates, target_date)

    # pré-indexation des lignes attendues
    expected_lines = set(args.lines)

    # agrégation : (stopArea, lineRef, direction_id) -> [minutes]
    agg: Dict[Tuple[str,str,str], List[int]] = defaultdict(list)

    # parcourir stop_times
    for st in stop_times:
        trip_id = st["trip_id"]
        trip = trips_by_id.get(trip_id)
        if not trip:
            continue
        service_id = trip.get("service_id")
        if service_id not in active_services:
            continue

        route_id = trip.get("route_id")
        route = routes_by_id.get(route_id, {})
        line_ref = map_line_ref(route)
        if expected_lines and line_ref not in expected_lines:
            # laisse quand même passer si route_id brut correspond (au cas où --lines contienne route_id)
            if line_ref not in expected_lines and route_id not in expected_lines:
                continue

        stop_id = st["stop_id"]
        # rattacher à un StopArea demandé
        # on cherche quel parent stoparea contient ce stop_id
        for stoparea in args.stopareas:
            children = stoparea_children.get(stoparea, set())
            if stop_id not in children:
                continue

            t = st.get("departure_time") or st.get("arrival_time")
            if not t:
                continue
            try:
                m = parse_hms_to_minutes(t)
            except Exception:
                continue

            dir_id = (trip.get("direction_id") or "0").strip()
            if dir_id not in ("0","1"):
                dir_id = "0"  # fallback

            agg[(stoparea, line_ref, dir_id)].append(m)

    # construire la sortie au format attendu
    out = {}
    for stoparea in args.stopareas:
        area_obj = {}
        # trouver toutes les lignes présentes pour ce stoparea
        keys_for_area = [k for k in agg.keys() if k[0] == stoparea]
        line_refs = sorted({k[1] for k in keys_for_area})
        for lr in line_refs:
            times0 = sorted(agg.get((stoparea, lr, "0"), []))
            times1 = sorted(agg.get((stoparea, lr, "1"), []))

            def mk(times):
                if not times:
                    return None, None
                return minutes_to_hhmm(times[0]), minutes_to_hhmm(times[-1])

            dirA_first, dirA_last = mk(times0)
            dirB_first, dirB_last = mk(times1)

            area_obj[lr] = {}
            if dirA_first: area_obj[lr]["dirA_first"] = dirA_first
            if dirA_last:  area_obj[lr]["dirA_last"]  = dirA_last
            if dirB_first: area_obj[lr]["dirB_first"] = dirB_first
            if dirB_last:  area_obj[lr]["dirB_last"]  = dirB_last

        if area_obj:
            out[stoparea] = area_obj

    payload = {
        "generated": datetime.datetime.utcnow().isoformat()+"Z",
        "date": args.date,
        "timezone": EUROPE_PARIS,
        **out
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
