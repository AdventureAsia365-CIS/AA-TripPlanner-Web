"""LLM steps for Trip Assembly: compose and renarrate (Sonnet-tier).

compose   — narration for a freshly sequenced trip.
renarrate — narration for a customer's manual reorder; never re-selects
            or reorders components.
Both stream via SSE and call the Bedrock satellite. Implemented in
Task 6. Skeleton only for scaffold.
"""
from __future__ import annotations


async def compose(ordered_components: list[dict]):
    raise NotImplementedError("Implemented in Task 6")


async def renarrate(ordered_components: list[dict]):
    raise NotImplementedError("Implemented in Task 6")
