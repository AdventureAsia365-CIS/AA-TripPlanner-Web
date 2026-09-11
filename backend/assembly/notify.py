"""Advisor notification.

Sends to a single configured address (config.ADVISOR_NOTIFY_EMAIL) via a
swappable sender abstraction. Implemented in Task 6. Skeleton only.
"""
from __future__ import annotations


async def notify_advisor(trip_id: str, event_log: list[dict]) -> None:
    raise NotImplementedError("Implemented in Task 6")
