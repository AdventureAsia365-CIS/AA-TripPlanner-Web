"""Lambda A entrypoint — Map/Browse.

Routes (implemented in Task 5):
  GET /browse/tiles/{tile_id}
  GET /browse/destinations/{destination_id}
  GET /browse/search
Never calls Bedrock. Read routes are CDN-cacheable; /search is not.
"""
from __future__ import annotations


def handler(event, context):
    raise NotImplementedError("Implemented in Task 5")
