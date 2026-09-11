import { NextRequest, NextResponse } from "next/server";

// BFF proxy to Lambda A (Map/Browse). Keeps BROWSE_API_URL server-side
// so the Lambda URL is never exposed to the browser. Fleshed out in
// Task 7.
const BROWSE_API_URL = process.env.BROWSE_API_URL ?? "";

export async function GET(req: NextRequest) {
  if (!BROWSE_API_URL) {
    return NextResponse.json(
      { error: "BROWSE_API_URL not configured" },
      { status: 503 },
    );
  }
  const search = req.nextUrl.search;
  const upstream = await fetch(`${BROWSE_API_URL}/browse${search}`, {
    headers: { accept: "application/json" },
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
