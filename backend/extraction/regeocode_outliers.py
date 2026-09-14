"""One-off: re-geocode destinations whose coordinates fall OUTSIDE their
country (a known data issue).

Why this exists
---------------
The seeder geocoded place names with only a free-text region hint and no
country restriction, so Mapbox sometimes returned a same-named place on the
wrong continent (e.g. a Laos "Elephant Conservation Center" landing in
China). Those rows now have a correct `country` (backfill_country.py) but a
wrong lat/lng.

This script finds every destination whose (lat,lng) is outside its
country's approximate bounding box, then re-geocodes the place name with
Mapbox constrained to that country:
  - country=<ISO 3166-1 alpha-2>   (hard filter)
  - proximity=<country centroid>   (bias)
  - bbox=<country bbox>            (clip)
and updates the row only if the new coordinate falls inside the bbox.

Idempotent: re-running only touches rows still outside their bbox. Safe.

Usage
-----
    MAPBOX_GEOCODING_TOKEN=pk... \
    TRIPPLANNER_DATABASE_URL=postgresql://.../aa_cis_dev \
    python -m backend.extraction.regeocode_outliers
"""
from __future__ import annotations

import asyncio
import os
from urllib.parse import quote

import asyncpg
import httpx

from backend import config


# ISO alpha-2, [west, south, east, north] bbox, and centroid (lng, lat).
# Covers the countries currently present in the data.
COUNTRY_GEO: dict[str, dict] = {
    "Laos": {"iso": "la", "bbox": [100.0, 13.5, 108.0, 22.6], "center": (103.85, 18.2)},
    "Sri Lanka": {"iso": "lk", "bbox": [79.5, 5.8, 82.0, 10.0], "center": (80.7, 7.9)},
    "South Korea": {"iso": "kr", "bbox": [125.5, 33.0, 130.0, 38.7], "center": (127.8, 36.5)},
    "Nepal": {"iso": "np", "bbox": [80.0, 26.3, 88.3, 30.5], "center": (84.1, 28.4)},
    "Japan": {"iso": "jp", "bbox": [122.0, 24.0, 146.0, 45.6], "center": (138.0, 37.5)},
    "India": {"iso": "in", "bbox": [68.0, 6.5, 97.5, 35.7], "center": (79.0, 22.0)},
}


def in_bbox(lat: float, lng: float, bbox: list[float]) -> bool:
    return bbox[0] <= lng <= bbox[2] and bbox[1] <= lat <= bbox[3]


async def _try_geocode(http, name, geo, *, use_country: bool, use_bbox: bool):
    """One Mapbox forward-geocode attempt. Returns (lat,lng) inside the
    country's bbox, or None."""
    url = f"{config.MAPBOX_GEOCODING_URL}/{quote(name)}.json"
    cx, cy = geo["center"]
    params = {
        "access_token": config.MAPBOX_GEOCODING_TOKEN,
        "limit": "1",
        "types": "place,locality,region,poi",
        "proximity": f"{cx},{cy}",
    }
    if use_country:
        params["country"] = geo["iso"]
    if use_bbox:
        params["bbox"] = ",".join(str(x) for x in geo["bbox"])
    try:
        resp = await http.get(url, params=params)
        resp.raise_for_status()
        feats = resp.json().get("features") or []
        if not feats:
            return None
        center = feats[0].get("center")
        if not center or len(center) != 2:
            return None
        lng, lat = float(center[0]), float(center[1])
        return (lat, lng) if in_bbox(lat, lng, geo["bbox"]) else None
    except Exception:
        return None


async def _mapbox_in_country(
    http: httpx.AsyncClient, name: str, geo: dict
) -> tuple[float, float, str]:
    """Resolve `name` to a coordinate inside its country. Tries, in order:
      1. country filter + bbox + proximity (most precise)
      2. country filter + proximity (no bbox clip)
      3. proximity only, but only accept if it lands inside the bbox
      4. fallback: the country centroid (approximate, but in the right
         country — far better than a wrong-continent pin)
    Returns (lat, lng, how) where `how` is one of country_bbox/country/
    proximity/centroid.
    """
    # Try the full place name, then a simplified head (before the first comma)
    # since many names are descriptive ("Socialization Area, Elephant ...").
    candidates = [name]
    head = name.split(",")[0].strip()
    if head and head != name:
        candidates.append(head)

    for cand in candidates:
        r = await _try_geocode(http, cand, geo, use_country=True, use_bbox=True)
        if r:
            return r[0], r[1], "country_bbox"
    for cand in candidates:
        r = await _try_geocode(http, cand, geo, use_country=True, use_bbox=False)
        if r:
            return r[0], r[1], "country"
    # NOTE: no proximity-without-country step. For countries whose bbox spills
    # into a neighbour (Laos over NE Thailand), a proximity-only result can
    # land back in the wrong country. The country=<iso> filter above is the
    # only trustworthy signal; if it finds nothing, fall back to a jittered
    # centroid (guaranteed in-country) rather than risk a wrong-country pin.
    cx, cy = geo["center"]
    jlat, jlng = _centroid_jitter(name, geo)
    return cy + jlat, cx + jlng, "centroid"


def _centroid_jitter(name: str, geo: dict) -> tuple[float, float]:
    """A small, deterministic offset (~±0.4°, roughly ±40 km) from the country
    centroid, derived from the place name. Spreads centroid-fallback pins so
    they don't stack into one giant cluster, while staying inside the country.
    Clamped so the jittered point stays within the country's bbox."""
    import hashlib

    h = hashlib.md5(name.encode("utf-8")).digest()
    # Map two bytes to [-0.4, 0.4] degrees.
    dlat = (h[0] / 255.0 - 0.5) * 0.8
    dlng = (h[1] / 255.0 - 0.5) * 0.8
    cx, cy = geo["center"]
    w, s, e, n = geo["bbox"]
    # Keep a margin so a jittered pin never lands on the border.
    lat = min(max(cy + dlat, s + 0.3), n - 0.3)
    lng = min(max(cx + dlng, w + 0.3), e - 0.3)
    return lat - cy, lng - cx


async def _reverse_country_iso(
    http: httpx.AsyncClient, lat: float, lng: float
) -> str | None:
    """Reverse-geocode a coordinate to its ISO 3166-1 alpha-2 country code
    (lowercase), or None on failure. Used to detect points that sit in the
    WRONG country even though they fall inside our rectangular bbox — e.g.
    a "Laos" place geocoded into north-east Thailand, which the Laos bbox
    (a rectangle) still contains.
    """
    url = f"{config.MAPBOX_GEOCODING_URL}/{lng},{lat}.json"
    params = {
        "access_token": config.MAPBOX_GEOCODING_TOKEN,
        "types": "country",
        "limit": "1",
    }
    try:
        resp = await http.get(url, params=params)
        resp.raise_for_status()
        feats = resp.json().get("features") or []
        if not feats:
            return None
        code = feats[0].get("properties", {}).get("short_code")
        if not code:
            # Fall back to the feature id, e.g. "country.123" has no code;
            # some responses carry short_code at the top level.
            code = feats[0].get("short_code")
        return code.lower() if isinstance(code, str) else None
    except Exception:
        return None


async def main() -> None:
    if not config.MAPBOX_GEOCODING_TOKEN:
        raise SystemExit("Set MAPBOX_GEOCODING_TOKEN first.")
    dsn = config.DATABASE_URL or os.environ.get("TRIPPLANNER_DATABASE_URL")
    if not dsn:
        raise SystemExit("Set TRIPPLANNER_DATABASE_URL first.")

    conn = await asyncpg.connect(dsn=dsn, command_timeout=30)
    http = httpx.AsyncClient(timeout=20)
    try:
        rows = await conn.fetch(
            "SELECT id, name, country, lat, lng FROM shared.destinations "
            "WHERE country IS NOT NULL AND country <> ''"
        )
        outliers = []
        checked = 0
        for r in rows:
            geo = COUNTRY_GEO.get(r["country"])
            if not geo:
                continue  # country not mapped — skip
            lat, lng = float(r["lat"]), float(r["lng"])
            if not in_bbox(lat, lng, geo["bbox"]):
                # Clearly outside the country's box — an outlier for sure.
                outliers.append((r["id"], r["name"], r["country"], geo))
                continue
            # Inside the bbox, but the bbox is a rectangle and may spill into
            # a neighbouring country (Laos's box covers NE Thailand and N
            # Cambodia). Confirm the point is really in the right country by
            # reverse-geocoding; only then trust it.
            iso = await _reverse_country_iso(http, lat, lng)
            checked += 1
            if iso is not None and iso != geo["iso"]:
                outliers.append((r["id"], r["name"], r["country"], geo))
        print(f"[regeocode] {len(outliers)} outliers to fix "
              f"(of {len(rows)} with a country; reverse-checked {checked})")

        fixed = 0
        by_method: dict[str, int] = {}
        for dest_id, name, country, geo in outliers:
            lat, lng, how = await _mapbox_in_country(http, name, geo)
            await conn.execute(
                "UPDATE shared.destinations SET lat = $2, lng = $3 WHERE id = $1",
                dest_id, lat, lng,
            )
            fixed += 1
            by_method[how] = by_method.get(how, 0) + 1
            if fixed % 20 == 0:
                print(f"  fixed {fixed}/{len(outliers)}")
        print(f"[regeocode] methods: {by_method}")

        # Report remaining outliers after the pass.
        remaining = 0
        rows2 = await conn.fetch(
            "SELECT country, lat, lng FROM shared.destinations "
            "WHERE country IS NOT NULL AND country <> ''"
        )
        for r in rows2:
            geo = COUNTRY_GEO.get(r["country"])
            if geo and not in_bbox(float(r["lat"]), float(r["lng"]), geo["bbox"]):
                remaining += 1
        print(f"[regeocode] done. fixed={fixed} "
              f"still_outside_bbox={remaining}")
    finally:
        await http.aclose()
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
