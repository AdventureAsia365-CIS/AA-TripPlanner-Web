"""Country list for the Map/Browse Lambda (Lambda A).

Powers the country-first filter (product requirement: filter by COUNTRY,
then by activity). Returns only countries that actually have at least one
itinerary_component, with a per-country component count, so the UI never
shows an empty country.

Cacheable behind CloudFront (fixed TTL) — no per-visitor state. The result
is small and stable, so the frontend can populate a dropdown from it.
"""
from __future__ import annotations

from typing import Any, Protocol


class _Pool(Protocol):
    async def fetch(self, query: str, *args: Any) -> Any: ...


COUNTRIES_SQL = """
    SELECT d.country AS country, COUNT(c.id) AS component_count
    FROM shared.destinations d
    JOIN tripplanner.itinerary_components c ON c.destination_id = d.id
    WHERE d.country IS NOT NULL AND d.country <> ''
    GROUP BY d.country
    HAVING COUNT(c.id) > 0
    ORDER BY d.country ASC
"""


async def list_countries(*, pool: _Pool) -> dict:
    rows = await pool.fetch(COUNTRIES_SQL)
    return {
        "countries": [
            {"country": r["country"], "component_count": r["component_count"]}
            for r in rows
        ]
    }
