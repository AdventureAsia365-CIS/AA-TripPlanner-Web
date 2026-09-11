"""LLM steps for Trip Assembly: compose and renarrate (Sonnet-tier).

compose   — narration for a freshly (re-)sequenced trip on a set change.
renarrate — narration for a customer's MANUAL reorder. It receives the
            fixed order and must NEVER re-select or reorder components,
            only write connective copy for the order given.

Both stream via the Bedrock satellite (invoke_stream). The streaming is
exposed as a generator of text deltas so the handler can forward SSE.
The Bedrock invoker is injectable so tests don't call AWS.
"""
from __future__ import annotations

from typing import Any, Callable, Iterator, Optional

from backend import config
from backend.shared import bedrock_satellite

# Injectable streaming invoker: (model_id, body) -> iterator of chunk dicts.
StreamInvoker = Callable[[str, dict], Iterator[dict]]

_COMPOSE_SYSTEM = (
    "You are an Adventure Asia trip narrator. You are given an ORDERED "
    "list of itinerary components (each already chosen by the traveller). "
    "Write brief, warm connective narration for each day IN THE ORDER "
    "GIVEN. You must not add, remove, or reorder components, and must not "
    "invent places, prices, or facts beyond the provided text."
)

_RENARRATE_SYSTEM = (
    "You are an Adventure Asia trip narrator. The traveller has MANUALLY "
    "set the order of the days below. Write brief connective narration "
    "that respects their exact order. Do NOT suggest a different order, "
    "and do NOT add, remove, or reorder components."
)


def _build_body(system: str, itinerary: list[dict]) -> dict:
    day_lines = []
    for e in itinerary:
        day_lines.append(
            f"Day {e['day']}: {e.get('name', '')} — {e.get('text_extract', '')}"
        )
    user = (
        "Itinerary (fixed order):\n"
        + "\n".join(day_lines)
        + "\n\nWrite one or two sentences of narration per day, in order."
    )
    return {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1200,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }


def _text_from_chunk(chunk: dict) -> str:
    """Extract text delta from a Claude streaming chunk (bedrock)."""
    # content_block_delta -> {"delta": {"type": "text_delta", "text": "..."}}
    delta = chunk.get("delta")
    if isinstance(delta, dict):
        return delta.get("text", "") or ""
    return ""


def _stream(system: str, itinerary: list[dict], invoker: StreamInvoker) -> Iterator[str]:
    body = _build_body(system, itinerary)
    for chunk in invoker(config.BEDROCK_MODEL_COMPOSE, body):
        text = _text_from_chunk(chunk)
        if text:
            yield text


def compose(
    itinerary: list[dict],
    *,
    invoker: Optional[StreamInvoker] = None,
) -> Iterator[str]:
    """Stream narration for a (re-)sequenced trip."""
    inv = invoker or bedrock_satellite.invoke_stream
    return _stream(_COMPOSE_SYSTEM, itinerary, inv)


def renarrate(
    itinerary: list[dict],
    *,
    invoker: Optional[StreamInvoker] = None,
) -> Iterator[str]:
    """Stream narration for a manually reordered trip. Never reorders."""
    inv = invoker or bedrock_satellite.invoke_stream
    return _stream(_RENARRATE_SYSTEM, itinerary, inv)
