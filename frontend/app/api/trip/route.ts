import { NextRequest, NextResponse } from "next/server";

// BFF proxy to Lambda B (Trip Assembly). Keeps TRIP_API_URL server-side.
// Fleshed out in Task 7 (add/remove component, reorder, send-to-advisor,
// SSE passthrough).
const TRIP_API_URL = process.env.TRIP_API_URL ?? "";

export async function POST(req: NextRequest) {
  if (!TRIP_API_URL) {
    return NextResponse.json(
      { error: "TRIP_API_URL not configured" },
      { status: 503 },
    );
  }
  const body = await req.text();
  const upstream = await fetch(`${TRIP_API_URL}/trip`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
