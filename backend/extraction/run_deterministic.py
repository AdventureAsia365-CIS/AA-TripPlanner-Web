"""Deterministic (no-Bedrock) extraction run — TEMPORARY seeding path.

Reads real tour_atoms (which already carry place / activity_type /
action / text), maps each pinnable atom to one itinerary_component,
grounds the activity with verify.py, geocodes the place via Mapbox
(cached in shared.destinations), and inserts with embedding=NULL.

Lets the map/browse/trip loop run against real data before the Bedrock
satellite trust is wired. Swap for `python -m backend.extraction.run`
(LLM + embeddings) once Bedrock is available — data-source change only.

Usage:
    set -a; . backend/.env; set +a
    PYTHONPATH=. .venv/bin/python -m backend.extraction.run_deterministic
"""
from __future__ import annotations

import asyncio

import httpx

from backend.extraction.deterministic import categorize_atom
from backend.extraction.geocode import geocode_place


async def _read_atoms(pool) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT a.tour_id, a.itinerary_day, a.place, a.activity_type, a.text
        FROM acp_contract.tour_atoms a
        JOIN gold_aa_internal.published_tours pt ON pt.tour_id = a.tour_id
        WHERE pt.master_status = 'active'
          AND a.deleted = false
          AND a.place IS NOT NULL
          AND a.itinerary_day IS NOT NULL
        ORDER BY a.tour_id, a.itinerary_day
        """
    )
    return [dict(r) for r in rows]


async def main() -> None:
    import uuid as _uuid

    from backend.extraction.geocode import preload_cache
    from backend.shared.db import close_pool, get_pool

    pool = await get_pool()
    http = httpx.AsyncClient(timeout=20)
    skipped = geo_fail = 0

    try:
        # Clean-slate seed: dev path, safe to reset the owned table so
        # re-runs don't duplicate. shared.destinations is a geocode cache,
        # left intact (expensive to rebuild).
        await pool.execute("TRUNCATE tripplanner.itinerary_components")
        # Preload the geocode cache once (1 query) so per-place lookups are
        # in-memory — critical over a high-latency tunnel.
        mem_cache = await preload_cache(pool)
        print(f"Geocode cache preloaded: {len(mem_cache)} known places.")
        atoms = await _read_atoms(pool)

        # Phase 1 — resolve each atom to (component, destination), geocoding
        # unique places once (cached in shared.destinations). This is the
        # slow, network-bound phase; it is resumable because the geocode
        # cache persists across runs.
        records: list[tuple] = []
        for a in atoms:
            comp = categorize_atom(a["place"], a["activity_type"], a["text"] or "")
            if comp is None:
                skipped += 1
                continue
            try:
                dest = await geocode_place(
                    comp.name, "", pool=pool, http=http, mem_cache=mem_cache
                )
            except Exception as e:
                geo_fail += 1
                print(f"  geocode skip: {comp.name!r} ({type(e).__name__})")
                continue
            records.append(
                (
                    str(a["tour_id"]),
                    a["itinerary_day"],
                    _uuid.UUID(str(dest.id)),
                    comp.name,
                    comp.activity.value,
                    comp.intensity_level.value,
                    list(comp.season_months),
                    comp.duration_hint.value,
                    comp.text_extract,
                    None,  # embedding
                )
            )

        # Phase 2 — one bulk insert (single round-trip) instead of ~1200.
        async with pool.acquire() as conn:
            await conn.copy_records_to_table(
                "itinerary_components",
                schema_name="tripplanner",
                columns=[
                    "source_tour_id",
                    "source_day_index",
                    "destination_id",
                    "name",
                    "activity",
                    "intensity_level",
                    "season_months",
                    "duration_hint",
                    "text_extract",
                    "embedding",
                ],
                records=records,
            )

        print(
            f"Deterministic seed complete: {len(records)} components seeded; "
            f"{skipped} skipped (transit/no place); "
            f"{geo_fail} geocode failures; from {len(atoms)} atoms."
        )
    finally:
        await http.aclose()
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
