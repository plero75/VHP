#!/usr/bin/env python3
import argparse, zipfile, io, csv, json, datetime

def parse_args():
  ap = argparse.ArgumentParser(description="Extract first/last departures per stop from GTFS")
  ap.add_argument("--zip", required=True, help="Path to GTFS zip")
  ap.add_argument("--out", required=True, help="Output JSON path")
  ap.add_argument("--stops", nargs="+", help="Optional list of stop_ids to restrict")
  return ap.parse_args()

def read_csv_from_zip(zf, name):
  with zf.open(name) as f:
    txt = io.TextIOWrapper(f, encoding="utf-8")
    return list(csv.DictReader(txt))

def hms_to_minutes(hms):
  hh, mm, ss = [int(x) for x in hms.split(":")]
  return hh*60 + mm

def main():
  args = parse_args()
  with zipfile.ZipFile(args.zip, "r") as zf:
    stops = read_csv_from_zip(zf, "stops.txt")
    stop_times = read_csv_from_zip(zf, "stop_times.txt")
    trips = read_csv_from_zip(zf, "trips.txt")
    calendar = read_csv_from_zip(zf, "calendar.txt")

  by_stop = {}
  for st in stop_times:
    sid = st["stop_id"]
    if args.stops and sid not in args.stops: continue
    t = st.get("departure_time") or st.get("arrival_time")
    if not t: continue
    by_stop.setdefault(sid, []).append(t)

  first_last = {}
  for sid, times in by_stop.items():
    mins = [hms_to_minutes(t) for t in times]
    first = min(mins)
    last  = max(mins)
    def fmt(m): return f"{m//60:02d}:{m%60:02d}"
    first_last[sid] = {"first": fmt(first), "last": fmt(last)}

  out = {
    "generated": datetime.datetime.utcnow().isoformat()+"Z",
    "first_last_by_stop": first_last
  }
  with open(args.out, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
  main()
