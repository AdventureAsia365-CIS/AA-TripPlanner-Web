import { NextRequest, NextResponse } from "next/server";

// BFF proxy to Lambda B (Trip Assembly). Keeps TRIP_API_URL server-side.
// Maps a single { op } POST body onto the Lambda's REST verbs/paths.
const TRIP_API_URL = process.env.TRIP_API_URL ?? "";
// Shared secret the Lambdas verify (X-TripPlanner-Key). Server-side only.
const TRIPPLANNER_API_KEY = process.env.TRIPPLANNER_API_KEY ?? "";

export async function POST(req: NextRequest) {
  if (!TRIP_API_URL) {
    return NextResponse.json(
      { error: "TRIP_API_URL not configured" },
      { status: 503 },
    );
  }
  const b = await req.json();
  const tripId = encodeURIComponent(b.trip_id ?? "");
  let method = "POST";
  let path = "";
  let payload: Record<string, unknown> = {};

  switch (b.op) {
    case "add":
      path = `/trip/${tripId}/components`;
      payload = { session_id: b.session_id, component_id: b.component_id };
      break;
    case "remove":
      method = "DELETE";
      path = `/trip/${tripId}/components/${encodeURIComponent(b.component_id)}`;
      payload = { session_id: b.session_id };
      break;
    case "reorder":
      method = "PATCH";
      path = `/trip/${tripId}/reorder`;
      payload = {
        session_id: b.session_id,
        ordered_component_ids: b.ordered_component_ids,
      };
      break;
    case "send":
      path = `/trip/${tripId}/send-to-advisor`;
      payload = { session_id: b.session_id, customer: b.customer };
      break;
    case "narrate":
      path = `/trip/${tripId}/narrate`;
      payload = { session_id: b.session_id, mode: b.mode };
      break;
    default:
      return NextResponse.json({ error: "unknown op" }, { status: 400 });
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (TRIPPLANNER_API_KEY) headers["x-tripplanner-key"] = TRIPPLANNER_API_KEY;

  const upstream = await fetch(`${TRIP_API_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(payload),
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
