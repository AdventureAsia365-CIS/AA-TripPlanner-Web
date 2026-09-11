"""Customer dedupe by phone/email + session claim on registration.

Checks tripplanner.customers for an existing phone/email BEFORE inserting,
then attaches customer_id to the EXISTING guest session (trip not lost).
Implemented in Task 6. Skeleton only for scaffold.
"""
from __future__ import annotations


async def register_and_claim(session_id: str, name: str, phone: str, email: str) -> str:
    raise NotImplementedError("Implemented in Task 6")
