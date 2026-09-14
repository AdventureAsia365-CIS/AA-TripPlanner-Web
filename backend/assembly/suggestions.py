"""Suggest what to pin next.

Given a trip's currently pinned components, recommend a few more
destinations the traveller is likely to want — ones that match the taste of
what they've already pinned and sit in the same countries, without repeating
a destination already in the trip.

Approach (reuses existing infra, no new services):
  - Read the pinned components' embeddings and average them into a single
    "taste" vector.
  - Rank other destinations by cosine distance of their best component to
    that taste vector (pgvector <=>), restricted to the countries the trip
    already touches, excluding destinations already pinned.

This lives in the Assembly Lambda (not Browse): it reads per-visitor trip
state, so it must never be cached across visitors.
"""
from __future__ import annotations

from typing import Any, Optional, Protocol

from backend.assembly import events as events_mod


class _Conn(Protocol):
    async def fetch(self, query: str, *args: Any) -> Any: ...
    async def fetchrow(self, query: str, *args: Any) -> Any: ...

    def transaction(self) -> Any: ...
    async def execute(self, query: str, *args: Any) -> Any: ...


SUGGEST_LIMIT = 6


def _avg_vector_literal(vectors: list[list[float]]) -> Optional[str]:
    """Average a list of equal-length float vectors into a pgvector literal
    '[a,b,...]', or None if there's nothing to average."""
    vecs = [v for v in vectors if v]
    if not vecs:
        return None
    dim = len(vecs[0])
    acc = [0.0] * dim
    n = 0
    for v in vecs:
        if len(v) != dim:
            continue
        for i, x in enumerate(v):
            acc[i] += float(x)
        n += 1
    if n == 0:
        return None
    return "[" + ",".join(repr(x / n) for x in acc) + "]"


async def suggest(conn: _Conn, trip_id: str, limit: int = SUGGEST_LIMIT) -> dict:
    """Return {suggestions: [{id, name, lat, lng, component_count, why}]}.

    Empty list when the trip has no pinned components with embeddings (we
    have nothing to base a taste vector on)."""
    components = await events_mod._current_components(conn, trip_id)  # noqa: SLF001
    if not components:
        return {"suggestions": []}

    pinned_dest_ids = {str(c["destination_id"]) for c in components if c.get("destination_id")}
    pinned_component_ids = [str(c["id"]) for c in components]

    # Pull the embeddings of the pinned components to build the taste vector,
    # plus the set of countries the trip already touches (for a same-region
    # bias). Both come from itinerary_components + destinations.
    rows = await conn.fetch(
        """
        SELECT c.embedding, d.country
        FROM tripplanner.itinerary_components c
        JOIN shared.destinations d ON d.id = c.destination_id
        WHERE c.id = ANY($1::uuid[])
        """,
        pinned_component_ids,
    )
    vectors = [list(r["embedding"]) for r in rows if r["embedding"] is not None]
    countries = sorted({r["country"] for r in rows if r["country"]})
    taste = _avg_vector_literal(vectors)
    if taste is None:
        # No embeddings to reason about — nothing to suggest.
        return {"suggestions": []}

    # Rank destinations (excluding already-pinned) by their best component's
    # cosine distance to the taste vector, biased to the trip's countries.
    # If the trip touches no known country, fall back to global ranking.
    dest_exclude = list(pinned_dest_ids) or ["00000000-0000-0000-0000-000000000000"]
    country_filter = "AND d.country = ANY($3::text[])" if countries else ""
    params: list[Any] = [taste, dest_exclude]
    if countries:
        params.append(countries)
    sql = f"""
        SELECT d.id, d.name, d.lat, d.lng, d.country,
               COUNT(c.id) AS component_count,
               MIN(c.embedding <=> $1::vector) AS best_distance
        FROM shared.destinations d
        JOIN tripplanner.itinerary_components c ON c.destination_id = d.id
        WHERE c.embedding IS NOT NULL
          AND d.id <> ALL($2::uuid[])
          {country_filter}
        GROUP BY d.id, d.name, d.lat, d.lng, d.country
        ORDER BY best_distance ASC
        LIMIT {int(limit)}
    """
    ranked = await conn.fetch(sql, *params)
    return {
        "suggestions": [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "lat": r["lat"],
                "lng": r["lng"],
                "country": r["country"],
                "component_count": r["component_count"],
                "why": "Similar to places you've pinned",
            }
            for r in ranked
        ]
    }
