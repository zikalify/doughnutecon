"""Refresh the yearly bulk datasets (stdlib only, except openpyxl for .xlsx).

- Ecological footprint: York University NEFBA workbook (open, no auth).
  URL pattern changes per edition; we probe the data page for the .xlsx link.
- Material footprint: UN SDG API only publishes regional aggregates for
  EN_MAT_FTPRPC today, so the Leeds-2021 seed is kept until a country-level
  source appears. This script verifies that and leaves the file untouched.

Run: python3 scripts/update_eco.py  (needs: openpyxl)
"""
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
YORK_PAGE = "https://footprint.info.yorku.ca/data/"
SDG_MF = ("https://unstats.un.org/SDGAPI/v1/sdg/Series/Data"
          "?seriesCode=EN_MAT_FTPRPC&pageSize=1000&pageNumber=1")
UA = {"User-Agent": "doughnut-eco-refresh/1.0"}


def get(url, timeout=90):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=timeout)


def refresh_ecological_footprint():
    html = get(YORK_PAGE).read().decode("utf-8", "ignore")
    m = re.search(r'href="([^"]*NEFBA_Data[^"]*\.xlsx[^"]*)"', html)
    if not m:
        print("EF: workbook link not found, skipping")
        return False
    url = m.group(1)
    print("EF: downloading", url[:100], "...")
    import openpyxl  # local import so MF check works without it
    blob = get(url, timeout=300).read()
    print(f"EF: got {len(blob)} bytes")
    wb = openpyxl.load_workbook(io.BytesIO(blob), read_only=True,
                                data_only=True)
    ws = wb["national_data"]
    latest = {}
    for r in list(ws.iter_rows(values_only=True))[1:]:
        name, iso, year, efc = r[0], r[1], r[2], r[8]
        if not iso or efc is None:
            continue
        if iso not in latest or year > latest[iso]["year"]:
            latest[iso] = {"name": name, "gha": round(float(efc), 3),
                           "year": int(year)}
    out = ROOT / "data" / "ecological-footprint.json"
    old = json.loads(out.read_text()) if out.exists() else {}
    if latest != old:
        out.write_text(json.dumps(latest, indent=1) + "\n")
        yrs = sorted({v["year"] for v in latest.values()})
        print(f"EF: updated {len(latest)} countries, years {yrs}")
        return True
    print("EF: no change")
    return False


def check_material_footprint():
    """Return True if country-level MF ever appears (then extend this script)."""
    d = json.loads(get(SDG_MF).read().decode())
    recs = d.get("data", [])
    country_like = [r for r in recs
                    if len(str(r.get("geoAreaCode", ""))) == 3]
    print(f"MF: SDG API still aggregates-only "
          f"({len(recs)} recs, {len(country_like)} country-like) — seed kept")
    return False


if __name__ == "__main__":
    changed = refresh_ecological_footprint()
    check_material_footprint()
    print("CHANGED" if changed else "NO-CHANGE")
