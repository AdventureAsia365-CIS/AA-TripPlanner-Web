"""Extraction pipeline entrypoint (offline/batch, run manually).

read active tours -> read+group atoms -> LLM categorize -> verify
(retry once) -> geocode -> insert components. Nothing at runtime calls
this. Implemented in Task 3. Skeleton only for scaffold.

Usage: python -m backend.extraction.run
"""
from __future__ import annotations


async def main() -> None:
    raise NotImplementedError("Implemented in Task 3")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
