"""Async Postgres connection pool (asyncpg), shared by both Lambdas.

The same RDS instance is shared with AA-CIS-App. This module only ever
connects; the SQL it runs is confined to tripplanner.* (read/write),
shared.destinations (read/write), and gold_aa_internal / acp_contract
(read-only, extraction pipeline only).
"""
from __future__ import annotations

from typing import Optional

import asyncpg

from backend import config

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Lazily create and return the process-wide connection pool."""
    global _pool
    if _pool is None:
        if not config.DATABASE_URL:
            raise RuntimeError(
                "TRIPPLANNER_DATABASE_URL is not set — cannot open DB pool."
            )
        _pool = await asyncpg.create_pool(
            dsn=config.DATABASE_URL,
            min_size=1,
            max_size=5,
            command_timeout=30,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
