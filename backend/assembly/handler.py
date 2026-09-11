"""Lambda B entrypoint — Trip Assembly.

Routes (implemented in Task 6):
  POST   /trip/{trip_id}/components
  DELETE /trip/{trip_id}/components/{component_id}
  PATCH  /trip/{trip_id}/reorder
  POST   /trip/{trip_id}/send-to-advisor
Stateful per-visitor; calls Bedrock; never cached.
"""
from __future__ import annotations


def handler(event, context):
    raise NotImplementedError("Implemented in Task 6")
