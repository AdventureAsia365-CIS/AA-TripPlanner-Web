"""Mapbox forward geocoding with a cache in shared.destinations.

Each place name is geocoded at most once (unique index on lower(name)).
Implemented in Task 3. Skeleton only for scaffold.
"""
from __future__ import annotations


async def geocode_place(name: str, country: str) -> dict:
    raise NotImplementedError("Implemented in Task 3")
