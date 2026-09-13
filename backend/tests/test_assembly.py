"""Offline unit tests for Lambda B (Trip Assembly). No DB, no Bedrock.

A FakeConn emulates just enough of asyncpg: an in-memory trip_events log,
a fixed component catalog (with lat/lng), a customers table, and a
sessions table, plus a no-op transaction context manager.
"""
from __future__ import annotations

import json

import pytest

from backend import config
from backend.assembly import agent, events, handler, notify, registration, sequencing


# --- sequencing -------------------------------------------------------------

def test_sequence_single_and_empty():
    assert sequencing.sequence([]) == []
    one = [{"id": "a", "lat": 1.0, "lng": 2.0}]
    assert sequencing.sequence(one) == one


def test_sequence_is_deterministic_and_nearest_neighbor():
    comps = [
        {"id": "far", "lat": 30.0, "lng": 30.0},
        {"id": "west", "lat": 0.0, "lng": 0.0},
        {"id": "mid", "lat": 0.0, "lng": 10.0},
    ]
    order = [c["id"] for c in sequencing.sequence(comps)]
    # anchor is west-most (lng=0) then nearest-neighbor
    assert order == ["west", "mid", "far"]
    # deterministic: same input -> same output
    assert order == [c["id"] for c in sequencing.sequence(list(reversed(comps)))]


def test_group_into_days_assigns_sequential_days():
    comps = [{"id": "a", "lat": 0, "lng": 0}, {"id": "b", "lat": 0, "lng": 1}]
    grouped = sequencing.sequence_and_group(comps)
    assert [(e["day"], e["component_id"]) for e in grouped] == [(1, "a"), (2, "b")]


# --- FakeConn ---------------------------------------------------------------

CATALOG = {
    "c1": {"id": "c1", "name": "Hanoi", "activity": "cultural_heritage",
           "duration_hint": "full_day", "lat": 21.0, "lng": 105.8},
    "c2": {"id": "c2", "name": "Sapa", "activity": "trekking",
           "duration_hint": "multi_night", "lat": 22.3, "lng": 103.8},
    "c3": {"id": "c3", "name": "Hoi An", "activity": "culinary",
           "duration_hint": "full_day", "lat": 15.9, "lng": 108.3},
}


class FakeTxn:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


class FakeConn:
    def __init__(self):
        self.events: list[dict] = []
        self._eid = 0
        self.drafts: dict[str, dict] = {}
        self.customers: list[dict] = []
        self.sessions: dict[str, dict] = {}

    def transaction(self):
        return FakeTxn()

    async def execute(self, query, *args):
        q = " ".join(query.split())
        if q.startswith("INSERT INTO tripplanner.trip_events"):
            trip_id, session_id, etype, payload = args
            self._eid += 1
            self.events.append({
                "id": self._eid, "trip_id": trip_id, "session_id": session_id,
                "event_type": etype, "payload": payload,
            })
        elif q.startswith("INSERT INTO tripplanner.trip_drafts"):
            trip_id, session_id, status, itinerary_json = args
            existing = self.drafts.get(trip_id)
            new_status = status
            if existing and existing["status"] == "sent":
                new_status = "sent"
            self.drafts[trip_id] = {
                "id": trip_id, "session_id": session_id,
                "status": new_status, "itinerary": itinerary_json,
            }
        elif q.startswith("UPDATE tripplanner.sessions"):
            customer_id, session_id = args
            self.sessions.setdefault(session_id, {"id": session_id})
            self.sessions[session_id]["customer_id"] = customer_id
            self.sessions[session_id]["expires_at"] = None
        return "OK"

    async def fetch(self, query, *args):
        q = " ".join(query.split())
        if q.startswith("SELECT event_type, payload FROM tripplanner.trip_events") and "ORDER BY id ASC" in q:
            trip_id = args[0]
            return [
                {"event_type": e["event_type"], "payload": e["payload"]}
                for e in self.events if e["trip_id"] == trip_id
            ]
        if q.startswith("SELECT c.id, c.name, c.activity"):
            ids = args[0]
            return [dict(CATALOG[i]) for i in ids if i in CATALOG]
        return []

    async def fetchrow(self, query, *args):
        q = " ".join(query.split())
        if q.startswith("SELECT event_type, payload FROM tripplanner.trip_events") and "ORDER BY id DESC" in q:
            trip_id = args[0]
            rows = [e for e in self.events if e["trip_id"] == trip_id]
            if not rows:
                return None
            last = rows[-1]
            return {"event_type": last["event_type"], "payload": last["payload"]}
        if q.startswith("SELECT customer_id FROM tripplanner.sessions"):
            sid = args[0]
            return self.sessions.get(sid)
        if q.startswith("SELECT id FROM tripplanner.customers"):
            phone, email = args
            for c in self.customers:
                if (phone and c.get("phone") == phone) or (email and c.get("email") == email):
                    return {"id": c["id"]}
            return None
        if q.startswith("INSERT INTO tripplanner.customers"):
            name, phone, email = args
            cid = f"cust-{len(self.customers)+1}"
            self.customers.append({"id": cid, "name": name, "phone": phone, "email": email})
            return {"id": cid}
        return None


# --- events / projection ----------------------------------------------------

@pytest.mark.asyncio
async def test_add_components_builds_projection():
    conn = FakeConn()
    await events.append_event(conn, "trip1", "s1", "add_component", {"component_id": "c1"})
    itinerary = await events.append_event(
        conn, "trip1", "s1", "add_component", {"component_id": "c3"}
    )
    # two components, sequenced deterministically, days 1..2
    assert {e["component_id"] for e in itinerary} == {"c1", "c3"}
    assert sorted(e["day"] for e in itinerary) == [1, 2]
    # projection persisted
    assert "trip1" in conn.drafts


@pytest.mark.asyncio
async def test_remove_component_updates_projection():
    conn = FakeConn()
    await events.append_event(conn, "t", "s1", "add_component", {"component_id": "c1"})
    await events.append_event(conn, "t", "s1", "add_component", {"component_id": "c2"})
    itinerary = await events.append_event(conn, "t", "s1", "remove_component", {"component_id": "c1"})
    assert {e["component_id"] for e in itinerary} == {"c2"}


@pytest.mark.asyncio
async def test_reorder_pins_explicit_order():
    conn = FakeConn()
    for cid in ("c1", "c2", "c3"):
        await events.append_event(conn, "t", "s1", "add_component", {"component_id": cid})
    itinerary = await events.append_event(
        conn, "t", "s1", "reorder", {"ordered_component_ids": ["c3", "c1", "c2"]}
    )
    assert [e["component_id"] for e in itinerary] == ["c3", "c1", "c2"]
    assert [e["day"] for e in itinerary] == [1, 2, 3]


@pytest.mark.asyncio
async def test_add_after_reorder_invalidates_explicit_order():
    conn = FakeConn()
    await events.append_event(conn, "t", "s1", "add_component", {"component_id": "c3"})
    await events.append_event(conn, "t", "s1", "reorder", {"ordered_component_ids": ["c3"]})
    # adding a new component after reorder -> back to deterministic sequencing
    itinerary = await events.append_event(conn, "t", "s1", "add_component", {"component_id": "c2"})
    # sequencing anchors west-most: c2 (lng 103.8) before c3 (lng 108.3)
    assert [e["component_id"] for e in itinerary] == ["c2", "c3"]


# --- registration -----------------------------------------------------------

@pytest.mark.asyncio
async def test_registration_creates_and_claims():
    conn = FakeConn()
    conn.sessions["s1"] = {"id": "s1"}
    cid = await registration.register_and_claim(conn, "s1", "Jo", "123", "jo@x.com")
    assert cid == "cust-1"
    assert conn.sessions["s1"]["customer_id"] == "cust-1"


@pytest.mark.asyncio
async def test_registration_dedupes_existing_email():
    conn = FakeConn()
    conn.sessions["s1"] = {"id": "s1"}
    conn.customers.append({"id": "existing", "name": "Jo", "phone": None, "email": "jo@x.com"})
    cid = await registration.register_and_claim(conn, "s1", "Jo", "", "jo@x.com")
    assert cid == "existing"  # reused, not a new insert


@pytest.mark.asyncio
async def test_registration_requires_contact():
    conn = FakeConn()
    with pytest.raises(ValueError):
        await registration.register_and_claim(conn, "s1", "Jo", "", "")


# --- notify -----------------------------------------------------------------

@pytest.mark.asyncio
async def test_notify_uses_config_email():
    sender = notify.LoggingSender()
    await notify.notify_advisor("trip1", [{"event_type": "sent", "payload": {}}], sender=sender)
    assert len(sender.sent) == 1
    assert sender.sent[0]["to"] == config.ADVISOR_NOTIFY_EMAIL


# --- agent (compose / renarrate) --------------------------------------------

def _fake_stream_invoker(_model, _body):
    # emulate Claude streaming chunks
    for t in ["Day 1 narration. ", "Day 2 narration."]:
        yield {"delta": {"type": "text_delta", "text": t}}


def test_compose_streams_text():
    itinerary = [{"day": 1, "name": "Hanoi", "text_extract": "x"}]
    out = "".join(agent.compose(itinerary, invoker=_fake_stream_invoker))
    assert "Day 1 narration." in out


def test_renarrate_preserves_given_order_in_prompt():
    # renarrate must not reorder — we assert the prompt reflects the given
    # order by capturing the body passed to the invoker.
    captured = {}

    def capture_invoker(model, body):
        captured["body"] = body
        return iter([])

    itinerary = [
        {"day": 1, "name": "Hoi An", "text_extract": "a"},
        {"day": 2, "name": "Hanoi", "text_extract": "b"},
    ]
    list(agent.renarrate(itinerary, invoker=capture_invoker))
    user_msg = captured["body"]["messages"][0]["content"]
    assert user_msg.index("Day 1: Hoi An") < user_msg.index("Day 2: Hanoi")


# --- handler routing --------------------------------------------------------

@pytest.mark.asyncio
async def test_handler_add_component():
    conn = FakeConn()
    resp = await handler.route(
        "POST", "/trip/t1/components",
        {"session_id": "s1", "component_id": "c1"}, conn=conn,
    )
    assert resp["statusCode"] == 200
    assert resp["headers"]["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_handler_add_missing_fields_400():
    conn = FakeConn()
    resp = await handler.route("POST", "/trip/t1/components", {"session_id": "s1"}, conn=conn)
    assert resp["statusCode"] == 400


@pytest.mark.asyncio
async def test_handler_send_requires_registration_when_flag_on(monkeypatch):
    monkeypatch.setattr(config, "REQUIRE_REGISTRATION_BEFORE_HANDOFF", True)
    conn = FakeConn()
    conn.sessions["s1"] = {"id": "s1", "customer_id": None}  # guest
    resp = await handler.route(
        "POST", "/trip/t1/send-to-advisor", {"session_id": "s1"}, conn=conn
    )
    assert resp["statusCode"] == 422
    assert json.loads(resp["body"])["error"] == "registration_required"


@pytest.mark.asyncio
async def test_handler_send_registers_then_sends_and_notifies(monkeypatch):
    monkeypatch.setattr(config, "REQUIRE_REGISTRATION_BEFORE_HANDOFF", True)
    conn = FakeConn()
    conn.sessions["s1"] = {"id": "s1", "customer_id": None}
    await events.append_event(conn, "t1", "s1", "add_component", {"component_id": "c1"})
    sender = notify.LoggingSender()
    resp = await handler.route(
        "POST", "/trip/t1/send-to-advisor",
        {"session_id": "s1", "customer": {"name": "Jo", "email": "jo@x.com"}},
        conn=conn, sender=sender,
    )
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"])["status"] == "sent"
    assert conn.sessions["s1"]["customer_id"] == "cust-1"   # registered + claimed
    assert len(sender.sent) == 1                             # advisor notified
    assert conn.drafts["t1"]["status"] == "sent"


@pytest.mark.asyncio
async def test_handler_narrate_returns_narration():
    conn = FakeConn()
    await events.append_event(conn, "t1", "s1", "add_component", {"component_id": "c1"})
    await events.append_event(conn, "t1", "s1", "add_component", {"component_id": "c3"})

    def fake_narrator(itinerary):
        # asserts the handler passed a non-empty, day-ordered itinerary
        assert itinerary and itinerary[0]["day"] == 1
        yield "Composed narration for "
        yield f"{len(itinerary)} days."

    resp = await handler.route(
        "POST", "/trip/t1/narrate", {"session_id": "s1"},
        conn=conn, narrator=fake_narrator,
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["mode"] == "compose"
    assert body["narration"] == "Composed narration for 2 days."
    assert len(body["itinerary"]) == 2


@pytest.mark.asyncio
async def test_handler_narrate_empty_trip_400():
    conn = FakeConn()
    resp = await handler.route(
        "POST", "/trip/empty/narrate", {"session_id": "s1"},
        conn=conn, narrator=lambda it: iter(["x"]),
    )
    assert resp["statusCode"] == 400
    assert json.loads(resp["body"])["error"] == "empty_trip"


@pytest.mark.asyncio
async def test_handler_narrate_requires_session_id():
    conn = FakeConn()
    resp = await handler.route("POST", "/trip/t1/narrate", {}, conn=conn)
    assert resp["statusCode"] == 400


@pytest.mark.asyncio
async def test_handler_narrate_bad_mode_400():
    conn = FakeConn()
    resp = await handler.route(
        "POST", "/trip/t1/narrate", {"session_id": "s1", "mode": "bogus"},
        conn=conn, narrator=lambda it: iter(["x"]),
    )
    assert resp["statusCode"] == 400


@pytest.mark.asyncio
async def test_handler_narrate_bedrock_failure_502():
    conn = FakeConn()
    await events.append_event(conn, "t1", "s1", "add_component", {"component_id": "c1"})

    def boom(itinerary):
        raise RuntimeError("bedrock down")
        yield  # pragma: no cover — make it a generator

    resp = await handler.route(
        "POST", "/trip/t1/narrate", {"session_id": "s1"},
        conn=conn, narrator=boom,
    )
    assert resp["statusCode"] == 502
    assert json.loads(resp["body"])["error"] == "narration_failed"


@pytest.mark.asyncio
async def test_handler_send_allows_edit_after_sent(monkeypatch):
    # after 'sent', another add keeps status 'sent' in projection (not locked)
    monkeypatch.setattr(config, "REQUIRE_REGISTRATION_BEFORE_HANDOFF", False)
    conn = FakeConn()
    conn.sessions["s1"] = {"id": "s1", "customer_id": "cust-x"}
    await events.append_event(conn, "t1", "s1", "add_component", {"component_id": "c1"})
    await handler.route("POST", "/trip/t1/send-to-advisor", {"session_id": "s1"}, conn=conn)
    # edit after send
    resp = await handler.route(
        "POST", "/trip/t1/components", {"session_id": "s1", "component_id": "c2"}, conn=conn
    )
    assert resp["statusCode"] == 200
    # projection stays 'sent' (edit allowed, not auto-re-notified)
    assert conn.drafts["t1"]["status"] == "sent"
