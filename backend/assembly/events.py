"""Append-only trip_events writer + trip_drafts projection updater.

Every event append and its projection update happen in ONE transaction:
trip_events is the canonical source of truth, trip_drafts is a read
cache. Implemented in Task 6. Skeleton only for scaffold.
"""
from __future__ import annotations


async def append_event(trip_id: str, session_id: str, event_type: str, payload: dict) -> None:
    raise NotImplementedError("Implemented in Task 6")
